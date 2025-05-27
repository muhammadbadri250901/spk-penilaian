
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Criteria {
  id: string;
  name: string;
  description: string;
  weight?: number;
}

const CriteriaManagement = () => {
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [loading, setLoading] = useState(true);
  const [pairwiseMatrix, setPairwiseMatrix] = useState<number[][]>([]);
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [consistencyRatio, setConsistencyRatio] = useState<number | null>(null);
  const [isConsistent, setIsConsistent] = useState<boolean | null>(null);

  const ahpScale = [
    { value: 9, label: '9 - Mutlak lebih penting' },
    { value: 8, label: '8 - Sangat lebih penting (+)' },
    { value: 7, label: '7 - Sangat lebih penting' },
    { value: 6, label: '6 - Lebih penting (+)' },
    { value: 5, label: '5 - Lebih penting' },
    { value: 4, label: '4 - Agak lebih penting (+)' },
    { value: 3, label: '3 - Agak lebih penting' },
    { value: 2, label: '2 - Sama penting (+)' },
    { value: 1, label: '1 - Sama penting' },
    { value: 0.5, label: '1/2 - Sama penting (-)' },
    { value: 0.33, label: '1/3 - Agak kurang penting' },
    { value: 0.25, label: '1/4 - Agak kurang penting (-)' },
    { value: 0.2, label: '1/5 - Kurang penting' },
    { value: 0.17, label: '1/6 - Kurang penting (-)' },
    { value: 0.14, label: '1/7 - Sangat kurang penting' },
    { value: 0.13, label: '1/8 - Sangat kurang penting (-)' },
    { value: 0.11, label: '1/9 - Mutlak kurang penting' }
  ];

  useEffect(() => {
    fetchCriteria();
  }, []);

  useEffect(() => {
    if (criteria.length > 0) {
      initializeMatrix();
      fetchPairwiseValues();
    }
  }, [criteria]);

  const fetchCriteria = async () => {
    try {
      const { data, error } = await supabase
        .from('criteria')
        .select('*')
        .order('name');

      if (error) throw error;

      setCriteria(data || []);
    } catch (error) {
      console.error('Error fetching criteria:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data kriteria",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPairwiseValues = async () => {
    if (criteria.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('criteria_comparison')
        .select('criteria1_id, criteria2_id, value');

      if (error) throw error;

      if (data && data.length > 0) {
        const newMatrix = [...pairwiseMatrix];
        
        data.forEach(comparison => {
          const i = criteria.findIndex(c => c.id === comparison.criteria1_id);
          const j = criteria.findIndex(c => c.id === comparison.criteria2_id);
          
          if (i !== -1 && j !== -1) {
            newMatrix[i][j] = comparison.value;
            newMatrix[j][i] = 1 / comparison.value;
          }
        });
        
        setPairwiseMatrix(newMatrix);
      }
    } catch (error) {
      console.error('Error fetching comparison values:', error);
    }
  };

  const initializeMatrix = () => {
    const size = criteria.length;
    const matrix = Array(size).fill(null).map(() => Array(size).fill(1));
    setPairwiseMatrix(matrix);
  };

  const updateMatrix = async (i: number, j: number, value: number) => {
    try {
      const newMatrix = [...pairwiseMatrix];
      newMatrix[i][j] = value;
      newMatrix[j][i] = 1 / value;
      setPairwiseMatrix(newMatrix);

      // Reset consistency status when matrix changes
      setConsistencyRatio(null);
      setIsConsistent(null);

      // Save to database
      const criteria1Id = criteria[i].id;
      const criteria2Id = criteria[j].id;

      // Check if comparison exists
      const { data: existingData } = await supabase
        .from('criteria_comparison')
        .select('id')
        .eq('criteria1_id', criteria1Id)
        .eq('criteria2_id', criteria2Id);

      if (existingData && existingData.length > 0) {
        // Update existing comparison
        await supabase
          .from('criteria_comparison')
          .update({ value })
          .eq('criteria1_id', criteria1Id)
          .eq('criteria2_id', criteria2Id);
      } else {
        // Insert new comparison
        await supabase
          .from('criteria_comparison')
          .insert({
            criteria1_id: criteria1Id,
            criteria2_id: criteria2Id,
            value
          });
      }
    } catch (error) {
      console.error('Error updating matrix:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan perbandingan",
        variant: "destructive",
      });
    }
  };

  const calculateWeights = async () => {
    try {
      setSavingMatrix(true);
      // Normalisasi matriks
      const normalizedMatrix = pairwiseMatrix.map((row, i) => {
        const columnSum = pairwiseMatrix.reduce((sum, r) => sum + r[i], 0);
        return row.map(value => value / columnSum);
      });

      // Hitung eigen vector (rata-rata baris)
      const weights = normalizedMatrix.map(row => 
        row.reduce((sum, value) => sum + value, 0) / row.length
      );

      // Hitung Consistency Index (CI)
      const lambda = weights.reduce((sum, weight, i) => {
        const weightedSum = pairwiseMatrix[i].reduce((s, value, j) => s + value * weights[j], 0);
        return sum + weightedSum / weight;
      }, 0) / criteria.length;

      const ci = (lambda - criteria.length) / (criteria.length - 1);
      
      // Random Index (RI) for different matrix sizes
      const riValues = [0, 0, 0.58, 0.9, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49];
      const ri = criteria.length <= 10 ? riValues[criteria.length - 1] : 1.5;
      
      // Calculate Consistency Ratio
      const cr = ci / ri;
      
      setConsistencyRatio(cr);
      setIsConsistent(cr <= 0.1);
      
      console.log('Weights:', weights);
      console.log('Lambda Max:', lambda);
      console.log('CI:', ci);
      console.log('CR:', cr);

      // Save weights to database only if consistent or forced
      if (cr <= 0.1) {
        // Update weights in database
        const updatedCriteria = criteria.map((criterion, index) => ({
          ...criterion,
          weight: weights[index]
        }));

        for (const criterion of updatedCriteria) {
          await supabase
            .from('criteria')
            .update({ weight: criterion.weight })
            .eq('id', criterion.id);
        }

        setCriteria(updatedCriteria);

        toast({
          title: "Perhitungan Berhasil",
          description: `Consistency Ratio: ${(cr * 100).toFixed(2)}% (Konsisten - Sangat Baik!)`,
        });
        return { weights, cr, isConsistent: true };
      } else {
        toast({
          title: "Peringatan",
          description: `Consistency Ratio: ${(cr * 100).toFixed(2)}% (Tidak Konsisten - Perbaiki Perbandingan!)`,
          variant: "destructive",
        });
        return { weights, cr, isConsistent: false };
      }
    } catch (error) {
      console.error('Error calculating weights:', error);
      toast({
        title: "Error",
        description: "Gagal menghitung bobot kriteria",
        variant: "destructive",
      });
      return null;
    } finally {
      setSavingMatrix(false);
    }
  };

  const forceUpdateWeights = async () => {
    if (consistencyRatio === null) return;
    
    try {
      setSavingMatrix(true);
      
      // Normalisasi matriks
      const normalizedMatrix = pairwiseMatrix.map((row, i) => {
        const columnSum = pairwiseMatrix.reduce((sum, r) => sum + r[i], 0);
        return row.map(value => value / columnSum);
      });

      // Hitung eigen vector (rata-rata baris)
      const weights = normalizedMatrix.map(row => 
        row.reduce((sum, value) => sum + value, 0) / row.length
      );
      
      // Update weights in database despite inconsistency
      const updatedCriteria = criteria.map((criterion, index) => ({
        ...criterion,
        weight: weights[index]
      }));

      for (const criterion of updatedCriteria) {
        await supabase
          .from('criteria')
          .update({ weight: criterion.weight })
          .eq('id', criterion.id);
      }

      setCriteria(updatedCriteria);
      
      toast({
        title: "Bobot Tersimpan",
        description: `Bobot tersimpan meskipun CR: ${(consistencyRatio * 100).toFixed(2)}% (tidak konsisten)`,
      });
      
    } catch (error) {
      console.error('Error forcing weights update:', error);
      toast({
        title: "Error",
        description: "Gagal memperbarui bobot kriteria",
        variant: "destructive",
      });
    } finally {
      setSavingMatrix(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Kriteria Penilaian</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {criteria.map((criterion) => (
              <div key={criterion.id} className="p-4 border rounded-lg bg-gray-50">
                <h3 className="font-semibold text-gray-900">{criterion.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{criterion.description}</p>
                {criterion.weight !== undefined && criterion.weight > 0 && (
                  <p className="text-sm font-semibold text-blue-700 mt-2">
                    Bobot: {(criterion.weight * 100).toFixed(2)}%
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Matriks Perbandingan Berpasangan</CardTitle>
          <p className="text-sm text-gray-600">
            Bandingkan setiap kriteria dengan kriteria lainnya menggunakan skala AHP
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border p-2 bg-gray-50">Kriteria</th>
                  {criteria.map((c) => (
                    <th key={c.id} className="border p-2 bg-gray-50 text-sm">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {criteria.map((rowCriteria, i) => (
                  <tr key={rowCriteria.id}>
                    <td className="border p-2 font-medium bg-gray-50">
                      {rowCriteria.name}
                    </td>
                    {criteria.map((colCriteria, j) => (
                      <td key={colCriteria.id} className="border p-1">
                        {i === j ? (
                          <div className="text-center py-2">1</div>
                        ) : i < j ? (
                          <Select
                            value={pairwiseMatrix[i] && pairwiseMatrix[i][j] ? pairwiseMatrix[i][j].toString() : "1"}
                            onValueChange={(value) => updateMatrix(i, j, parseFloat(value))}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ahpScale.map((scale) => (
                                <SelectItem key={scale.value} value={scale.value.toString()}>
                                  {scale.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="text-center py-2 text-gray-600">
                            {pairwiseMatrix[i] && pairwiseMatrix[i][j] ? pairwiseMatrix[i][j].toFixed(2) : ""}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {consistencyRatio !== null && (
            <Alert className={`mt-4 ${isConsistent ? 'bg-green-50' : 'bg-amber-50'}`}>
              <AlertCircle className={isConsistent ? 'text-green-600' : 'text-amber-600'} />
              <AlertTitle className={isConsistent ? 'text-green-800' : 'text-amber-800'}>
                {isConsistent ? 'Perbandingan Konsisten ✅' : 'Perbandingan Tidak Konsisten ⚠️'}
              </AlertTitle>
              <AlertDescription className={isConsistent ? 'text-green-700' : 'text-amber-700'}>
                <p><strong>Consistency Ratio (CR): {(consistencyRatio * 100).toFixed(2)}%</strong></p>
                {isConsistent ? (
                  <p className="mt-1">Sangat baik! CR kurang dari 10% menunjukkan perbandingan yang konsisten dan dapat diandalkan.</p>
                ) : (
                  <div className="mt-2">
                    <p>CR melebihi 10% (0.1). Sebaiknya perbaiki perbandingan berpasangan agar lebih konsisten.</p>
                    <p className="text-sm mt-1">
                      <strong>Panduan CR:</strong><br/>
                      • 0-5%: Sangat konsisten<br/>
                      • 5-10%: Konsisten (dapat diterima)<br/>
                      • &gt;10%: Tidak konsisten (perlu diperbaiki)
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-3" 
                      onClick={forceUpdateWeights}
                      disabled={savingMatrix}
                    >
                      {savingMatrix ? 'Menyimpan...' : 'Gunakan Bobot Meskipun Tidak Konsisten'}
                    </Button>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="mt-6 flex justify-center">
            <Button 
              onClick={calculateWeights} 
              className="px-8" 
              disabled={savingMatrix}
            >
              {savingMatrix ? 'Memproses...' : 'Hitung Bobot Kriteria'}
            </Button>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Petunjuk Skala AHP:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-800">
              <div>• 1 = Sama penting</div>
              <div>• 3 = Agak lebih penting</div>
              <div>• 5 = Lebih penting</div>
              <div>• 7 = Sangat lebih penting</div>
              <div>• 9 = Mutlak lebih penting</div>
              <div>• 2,4,6,8 = Nilai antara</div>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              <strong>Tips:</strong> Mulai dengan perbandingan yang jelas, lalu sesuaikan secara bertahap untuk mencapai CR &lt; 10%
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CriteriaManagement;
