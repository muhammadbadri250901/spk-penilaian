import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Student {
  id: string;
  name: string;
  class: string;
}

interface AhpResult {
  id: string;
  student_id: string;
  student: Student;
  final_score: number;
  rank: number;
  criteria: {
    academic: number;
    behavior: number;
    achievement: number;
    leadership: number;
    attendance: number;
  };
}

const RankingResults = () => {
  const [results, setResults] = useState<AhpResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [criteriaMap, setCriteriaMap] = useState<{[key: string]: string}>({});

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      console.log('Fetching ranking results...');
      
      // Get criteria mapping first
      const { data: criteriaData, error: criteriaError } = await supabase
        .from('criteria')
        .select('id, name');

      if (criteriaError) {
        console.error('Error fetching criteria:', criteriaError);
        throw criteriaError;
      }

      // Create a map of criteria names to IDs
      const criteriaMapping: {[key: string]: string} = {};
      criteriaData?.forEach(criteria => {
        criteriaMapping[criteria.name] = criteria.id;
      });
      setCriteriaMap(criteriaMapping);
      console.log('Criteria mapping:', criteriaMapping);

      // Get AHP results
      const { data: ahpData, error: ahpError } = await supabase
        .from('ahp_results')
        .select(`
          id, 
          final_score, 
          rank,
          student_id, 
          students (
            id, 
            name, 
            class
          )
        `)
        .order('rank');

      if (ahpError) {
        console.error('Error fetching AHP results:', ahpError);
        throw ahpError;
      }

      console.log('AHP results:', ahpData);

      if (!ahpData || ahpData.length === 0) {
        console.log('No AHP results found');
        setLoading(false);
        return;
      }

      // Get all student scores
      const studentIds = ahpData.map(result => result.student_id);
      const { data: scoresData, error: scoresError } = await supabase
        .from('student_scores')
        .select('student_id, criteria_id, score')
        .in('student_id', studentIds);

      if (scoresError) {
        console.error('Error fetching scores:', scoresError);
        throw scoresError;
      }

      console.log('Scores data:', scoresData);

      // Process the results
      const processedResults: AhpResult[] = [];
      
      for (const result of ahpData) {
        const student = result.students as Student;
        
        if (!student) {
          console.error('Student data is missing for result:', result);
          continue;
        }
        
        // Get scores for this student
        const studentScores = scoresData?.filter(
          score => score.student_id === student.id
        ) || [];
        
        // Map scores to criteria
        const academicId = criteriaMapping['Akademik'];
        const behaviorId = criteriaMapping['Perilaku'];
        const achievementId = criteriaMapping['Prestasi'];
        const leadershipId = criteriaMapping['Kepemimpinan'];
        const attendanceId = criteriaMapping['Kehadiran'];

        const getScore = (criteriaId: string) => {
          const score = studentScores.find(s => s.criteria_id === criteriaId);
          return score ? score.score : 0;
        };

        processedResults.push({
          id: result.id,
          student_id: result.student_id,
          student,
          final_score: result.final_score,
          rank: result.rank,
          criteria: {
            academic: getScore(academicId),
            behavior: getScore(behaviorId),
            achievement: getScore(achievementId),
            leadership: getScore(leadershipId),
            attendance: getScore(attendanceId)
          }
        });
      }
      
      console.log('Processed results:', processedResults);
      setResults(processedResults);
    } catch (error) {
      console.error('Error fetching ranking results:', error);
      toast({
        title: "Error",
        description: "Gagal memuat hasil ranking",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return <Star className="h-6 w-6 text-blue-500" />;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'from-yellow-400 to-yellow-600';
      case 2:
        return 'from-gray-300 to-gray-500';
      case 3:
        return 'from-amber-400 to-amber-600';
      default:
        return 'from-blue-400 to-blue-600';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-16">
        <Trophy className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-medium text-gray-600 mb-2">Belum Ada Hasil Ranking</h3>
        <p className="text-gray-500">
          Silahkan lakukan perhitungan AHP terlebih dahulu pada tab Perhitungan AHP
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Trophy className="h-5 w-5 mr-2 text-yellow-500" />
            Hasil Ranking Siswa Berprestasi
          </CardTitle>
          <p className="text-sm text-gray-600">
            Berdasarkan perhitungan metode AHP dengan 5 kriteria penilaian
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {results.map((student) => (
              <Card key={student.id} className={`${student.rank <= 3 ? 'ring-2 ring-yellow-200' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-full bg-gradient-to-r ${getRankColor(student.rank)}`}>
                        {getRankIcon(student.rank)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-xl font-bold text-gray-900">{student.student.name}</h3>
                          <Badge variant={student.rank <= 3 ? 'default' : 'secondary'}>
                            Rank #{student.rank}
                          </Badge>
                        </div>
                        <p className="text-gray-600">Kelas {student.student.class}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-green-600">
                        {(student.final_score * 100).toFixed(2)}%
                      </div>
                      <p className="text-sm text-gray-500">Skor AHP</p>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-5 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-sm font-medium text-blue-700">Akademik</div>
                      <div className="text-lg font-bold text-blue-900">{student.criteria.academic}</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-sm font-medium text-green-700">Perilaku</div>
                      <div className="text-lg font-bold text-green-900">{student.criteria.behavior}</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-sm font-medium text-purple-700">Prestasi</div>
                      <div className="text-lg font-bold text-purple-900">{student.criteria.achievement}</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <div className="text-sm font-medium text-orange-700">Kepemimpinan</div>
                      <div className="text-lg font-bold text-orange-900">{student.criteria.leadership}</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <div className="text-sm font-medium text-red-700">Kehadiran</div>
                      <div className="text-lg font-bold text-red-900">{student.criteria.attendance}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {results.length >= 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Ringkasan Hasil</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-lg text-white">
                <Trophy className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-xl font-bold">Juara 1</h3>
                <p className="text-lg">{results[0].student.name}</p>
                <p className="text-sm opacity-90">Skor: {(results[0].final_score * 100).toFixed(2)}%</p>
              </div>
              
              <div className="text-center p-6 bg-gradient-to-r from-gray-300 to-gray-500 rounded-lg text-white">
                <Medal className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-xl font-bold">Juara 2</h3>
                <p className="text-lg">{results[1].student.name}</p>
                <p className="text-sm opacity-90">Skor: {(results[1].final_score * 100).toFixed(2)}%</p>
              </div>
              
              <div className="text-center p-6 bg-gradient-to-r from-amber-400 to-amber-600 rounded-lg text-white">
                <Award className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-xl font-bold">Juara 3</h3>
                <p className="text-lg">{results[2].student.name}</p>
                <p className="text-sm opacity-90">Skor: {(results[2].final_score * 100).toFixed(2)}%</p>
              </div>
            </div>

            <div className="mt-8 p-6 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-3">Interpretasi Hasil:</h4>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>• Siswa dengan skor AHP tertinggi memiliki performa terbaik secara keseluruhan</li>
                <li>• Bobot kriteria diambil dari perhitungan di halaman Kriteria</li>
                <li>• Hasil ini dapat digunakan sebagai dasar pemilihan siswa berprestasi</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RankingResults;
