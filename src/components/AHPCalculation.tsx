
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Calculator, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Student {
  id: string;
  name: string;
  class: string;
  nis: string;
}

interface Criteria {
  id: string;
  name: string;
  weight: number;
}

interface Score {
  student_id: string;
  criteria_id: string;
  score: number;
}

interface AhpResult {
  id: string;
  student_id: string;
  student: Student;
  final_score: number;
  rank: number;
  criteriaScores: {[criteriaId: string]: number};
}

const AHPCalculation = () => {
  const [calculationStep, setCalculationStep] = useState(0);
  const [results, setResults] = useState<AhpResult[] | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkExistingResults();
  }, []);

  const checkExistingResults = async () => {
    try {
      console.log('Checking for existing AHP results...');
      
      const { data, error } = await supabase
        .from('ahp_results')
        .select(`
          id,
          student_id,
          final_score,
          rank,
          students (
            id,
            name,
            class,
            nis
          )
        `)
        .order('rank');

      if (error) {
        console.log('No existing results found or error:', error);
        return;
      }

      if (data && data.length > 0) {
        console.log('Found existing results:', data);
        
        const formattedResults: AhpResult[] = [];
        
        for (const result of data) {
          const student = result.students as Student;
          
          if (!student) {
            console.error('Student data is missing for result:', result);
            continue;
          }
          
          const { data: studentScores } = await supabase
            .from('student_scores')
            .select('criteria_id, score')
            .eq('student_id', student.id);
          
          const criteriaScores: {[criteriaId: string]: number} = {};
          if (studentScores) {
            studentScores.forEach(score => {
              criteriaScores[score.criteria_id] = score.score;
            });
          }
          
          formattedResults.push({
            id: result.id,
            student_id: result.student_id,
            student,
            final_score: result.final_score,
            rank: result.rank,
            criteriaScores
          });
        }
        
        setResults(formattedResults);
        setCalculationStep(3);
      }
    } catch (error) {
      console.error('Error checking existing results:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Loading criteria data...');
      
      // Load criteria with weights
      const { data: criteriaData, error: criteriaError } = await supabase
        .from('criteria')
        .select('id, name, weight');

      if (criteriaError) {
        console.error('Error loading criteria:', criteriaError);
        throw criteriaError;
      }

      console.log('Criteria data loaded:', criteriaData);

      // Check if criteria have weights
      const criteriaWithWeights = criteriaData?.filter(c => c.weight !== null && c.weight !== undefined && c.weight > 0);
      if (!criteriaWithWeights || criteriaWithWeights.length === 0) {
        setError("Bobot kriteria belum dihitung. Silahkan hitung bobot di halaman Kriteria terlebih dahulu.");
        toast({
          title: "Peringatan",
          description: "Bobot kriteria belum dihitung. Silahkan hitung bobot di halaman Kriteria terlebih dahulu.",
          variant: "destructive",
        });
        setLoading(false);
        return { success: false };
      }

      console.log('Loading students data...');
      
      // Load students
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, class, nis');

      if (studentsError) {
        console.error('Error loading students:', studentsError);
        throw studentsError;
      }
      
      console.log('Students data loaded:', studentsData);
      
      if (!studentsData || studentsData.length === 0) {
        setError("Belum ada data siswa. Silahkan tambahkan data siswa terlebih dahulu.");
        toast({
          title: "Peringatan",
          description: "Belum ada data siswa. Silahkan tambahkan data siswa terlebih dahulu.",
          variant: "destructive",
        });
        setLoading(false);
        return { success: false };
      }

      console.log('Loading scores data...');
      
      // Load scores
      const { data: scoresData, error: scoresError } = await supabase
        .from('student_scores')
        .select('student_id, criteria_id, score');

      if (scoresError) {
        console.error('Error loading scores:', scoresError);
        throw scoresError;
      }
      
      console.log('Scores data loaded:', scoresData);

      // Check if we have enough scores to proceed
      const totalRequiredScores = studentsData.length * criteriaData.length;
      const availableScores = scoresData?.length || 0;
      
      console.log(`Required scores: ${totalRequiredScores}, Available: ${availableScores}`);
      
      if (availableScores < totalRequiredScores * 0.5) {
        setError(`Diperlukan lebih banyak data nilai siswa. Tersedia: ${availableScores}/${totalRequiredScores} nilai.`);
        toast({
          title: "Peringatan",
          description: "Data nilai siswa masih kurang lengkap.",
          variant: "destructive",
        });
        setLoading(false);
        return { success: false };
      }

      return {
        success: true,
        criteria: criteriaData || [],
        students: studentsData || [],
        scores: scoresData || []
      };
    } catch (error: any) {
      console.error('Error loading data:', error);
      setError(error.message || 'Gagal memuat data');
      toast({
        title: "Error",
        description: "Gagal memuat data",
        variant: "destructive",
      });
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const calculateAHP = async () => {
    console.log('Starting AHP calculation...');
    
    const loadResult = await loadData();
    if (!loadResult.success) {
      console.log('Data loading failed, aborting calculation');
      return;
    }
    
    const { criteria: loadedCriteria, students: loadedStudents, scores: loadedScores } = loadResult;
    
    console.log('Data loaded successfully:', {
      criteria: loadedCriteria.length,
      students: loadedStudents.length,
      scores: loadedScores.length
    });
    
    setCalculationStep(1);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setCalculationStep(2);
      
      console.log('Starting AHP calculation with loaded data');

      // Get max scores for normalization
      const maxScores: {[key: string]: number} = {};
      loadedCriteria.forEach(criterion => {
        const criteriaScores = loadedScores.filter(s => s.criteria_id === criterion.id);
        const maxScore = criteriaScores.length > 0 ? Math.max(...criteriaScores.map(s => s.score)) : 100;
        maxScores[criterion.id] = Math.max(maxScore, 1);
      });
      
      console.log('Max scores per criteria:', maxScores);

      // Calculate AHP scores for each student
      const ahpResults = loadedStudents.map(student => {
        const studentScores: {[key: string]: number} = {};
        let ahpScore = 0;
        
        loadedCriteria.forEach(criterion => {
          const score = loadedScores.find(s => 
            s.student_id === student.id && s.criteria_id === criterion.id
          );
          
          const rawScore = score ? score.score : 0;
          studentScores[criterion.id] = rawScore;
          
          // Normalize score (0-1)
          const normalizedScore = rawScore / maxScores[criterion.id];
          
          // Apply weight
          const weightedScore = normalizedScore * (criterion.weight || 0);
          ahpScore += weightedScore;
          
          console.log(`Student ${student.name}, Criteria ${criterion.name}: Raw=${rawScore}, Normalized=${normalizedScore.toFixed(3)}, Weighted=${weightedScore.toFixed(3)}`);
        });
        
        console.log(`Student ${student.name} final AHP score: ${ahpScore.toFixed(3)}`);
        
        return {
          student,
          studentScores,
          ahpScore,
          rank: 0
        };
      });
      
      // Sort by AHP score (descending)
      ahpResults.sort((a, b) => b.ahpScore - a.ahpScore);
      
      // Assign ranks
      ahpResults.forEach((result, index) => {
        result.rank = index + 1;
      });
      
      console.log('Final AHP Results:', ahpResults);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      setCalculationStep(3);
      
      // Save results to database
      await saveResults(ahpResults);
      
      // Format results for display
      const formattedResults = ahpResults.map(result => ({
        id: `temp-${result.student.id}`,
        student_id: result.student.id,
        student: result.student,
        final_score: result.ahpScore,
        rank: result.rank,
        criteriaScores: result.studentScores
      }));
      
      // Update state with loaded data
      setCriteria(loadedCriteria);
      setStudents(loadedStudents);
      setScores(loadedScores);
      setResults(formattedResults);
      
      toast({
        title: "Perhitungan Selesai",
        description: `Hasil perhitungan AHP telah berhasil digenerate untuk ${ahpResults.length} siswa`,
      });
      
    } catch (error: any) {
      console.error('Error calculating AHP:', error);
      setError(error.message || 'Gagal menghitung AHP');
      toast({
        title: "Error",
        description: "Gagal menghitung AHP: " + (error.message || 'Unknown error'),
        variant: "destructive",
      });
      setCalculationStep(0);
    }
  };

  const saveResults = async (ahpResults: any[]) => {
    try {
      console.log('Saving AHP results to database...');
      
      // Delete existing results
      const { error: deleteError } = await supabase
        .from('ahp_results')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (deleteError) {
        console.log('Delete error (might be expected if no existing results):', deleteError);
      }
      
      // Insert new results
      const resultsToInsert = ahpResults.map(result => ({
        student_id: result.student.id,
        final_score: result.ahpScore,
        rank: result.rank
      }));
      
      console.log('Inserting results:', resultsToInsert);
      
      const { error: insertError } = await supabase
        .from('ahp_results')
        .insert(resultsToInsert);
        
      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }
      
      console.log('Results saved successfully');
    } catch (error: any) {
      console.error('Error saving results:', error);
      toast({
        title: "Peringatan",
        description: "Hasil perhitungan berhasil tetapi gagal disimpan ke database",
        variant: "destructive",
      });
    }
  };

  const resetCalculation = async () => {
    try {
      console.log('Resetting calculation...');
      
      const { error } = await supabase
        .from('ahp_results')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (error) {
        console.log('Reset error (might be expected):', error);
      }
      
      setCalculationStep(0);
      setResults(null);
      setError(null);
      setStudents([]);
      setCriteria([]);
      setScores([]);
      
      toast({
        title: "Reset Berhasil",
        description: "Hasil perhitungan telah dihapus",
      });
    } catch (error) {
      console.error('Error resetting calculation:', error);
      toast({
        title: "Error",
        description: "Gagal mereset perhitungan",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calculator className="h-5 w-5 mr-2" />
            Perhitungan AHP
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Peringatan</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {calculationStep === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-6">
                Mulai perhitungan AHP untuk menentukan ranking siswa berprestasi
              </p>
              <Button 
                onClick={calculateAHP} 
                size="lg" 
                className="px-8"
                disabled={loading}
              >
                {loading ? 'Memuat Data...' : 'Mulai Perhitungan'}
              </Button>
            </div>
          )}

          {calculationStep > 0 && calculationStep < 4 && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Proses Perhitungan</h3>
                <Progress value={calculationStep * 33.33} className="w-full" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded-lg ${calculationStep >= 1 ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                  <div className="flex items-center">
                    {calculationStep >= 1 && <CheckCircle className="h-5 w-5 text-green-600 mr-2" />}
                    <span className={calculationStep >= 1 ? 'text-green-800' : 'text-gray-600'}>
                      1. Ambil Data Siswa
                    </span>
                  </div>
                </div>
                
                <div className={`p-4 rounded-lg ${calculationStep >= 2 ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                  <div className="flex items-center">
                    {calculationStep >= 2 && <CheckCircle className="h-5 w-5 text-green-600 mr-2" />}
                    <span className={calculationStep >= 2 ? 'text-green-800' : 'text-gray-600'}>
                      2. Normalisasi Nilai
                    </span>
                  </div>
                </div>
                
                <div className={`p-4 rounded-lg ${calculationStep >= 3 ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                  <div className="flex items-center">
                    {calculationStep >= 3 && <CheckCircle className="h-5 w-5 text-green-600 mr-2" />}
                    <span className={calculationStep >= 3 ? 'text-green-800' : 'text-gray-600'}>
                      3. Hitung Skor AHP
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {results && results.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Hasil Perhitungan AHP</h3>
                <Button variant="outline" onClick={resetCalculation}>
                  Hitung Ulang
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Bobot Kriteria</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {criteria.map((criterion) => (
                      <div key={criterion.id} className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="font-semibold text-blue-900">{criterion.name}</div>
                        <div className="text-2xl font-bold text-blue-700">
                          {criterion.weight ? (criterion.weight * 100).toFixed(1) : 0}%
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ranking Siswa Berprestasi</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rank</TableHead>
                          <TableHead>Nama Siswa</TableHead>
                          <TableHead>NIS</TableHead>
                          <TableHead>Kelas</TableHead>
                          {criteria.map(criterion => (
                            <TableHead key={criterion.id}>{criterion.name}</TableHead>
                          ))}
                          <TableHead>Skor AHP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((result: AhpResult) => (
                          <TableRow key={result.student_id} className={result.rank <= 3 ? 'bg-yellow-50' : ''}>
                            <TableCell className="font-bold">
                              <div className="flex items-center">
                                #{result.rank}
                                {result.rank <= 3 && <span className="ml-2 text-yellow-600">🏆</span>}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{result.student.name}</TableCell>
                            <TableCell>{result.student.nis}</TableCell>
                            <TableCell>{result.student.class}</TableCell>
                            {criteria.map(criterion => (
                              <TableCell key={criterion.id}>
                                {result.criteriaScores[criterion.id] || 0}
                              </TableCell>
                            ))}
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-green-600">
                                  {(result.final_score * 100).toFixed(2)}%
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {results.length >= 3 && (
                <Card className="bg-green-50 border-green-200">
                  <CardHeader>
                    <CardTitle className="text-green-800">🎉 Top 3 Siswa Berprestasi</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {results.slice(0, 3).map((result, index) => (
                        <div key={result.student_id} className="text-center p-4 bg-white rounded-lg border-2 border-green-300">
                          <div className="text-3xl mb-2">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                          </div>
                          <div className="font-bold text-lg">{result.student.name}</div>
                          <div className="text-gray-600">{result.student.nis}</div>
                          <div className="text-green-600 font-bold text-xl mt-2">
                            {(result.final_score * 100).toFixed(2)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {calculationStep === 3 && (!results || results.length === 0) && (
            <Alert className="mt-4 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle>Tidak Ada Hasil</AlertTitle>
              <AlertDescription>
                Perhitungan selesai tetapi tidak ada hasil yang ditampilkan. Kemungkinan penyebabnya:
                <ul className="list-disc ml-5 mt-2 space-y-1">
                  <li>Data kriteria atau siswa tidak lengkap</li>
                  <li>Bobot kriteria belum dihitung</li>
                  <li>Terjadi kesalahan saat menyimpan hasil ke database</li>
                </ul>
                <Button className="mt-3" onClick={resetCalculation}>
                  Reset dan Coba Lagi
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AHPCalculation;
