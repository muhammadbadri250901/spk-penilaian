import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Trophy, 
  Calculator, 
  BarChart3, 
  LogOut, 
  GraduationCap,
  Settings,
  FileText
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import StudentManagement from './StudentManagement';
import CriteriaManagement from './CriteriaManagement';
import AHPCalculation from './AHPCalculation';
import RankingResults from './RankingResults';
import { toast } from '@/hooks/use-toast';

interface DashboardProps {
  user: { username: string; role: string } | null;
  onLogout: () => void;
}

const Dashboard = ({ user, onLogout }: DashboardProps) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    students: 0,
    criteria: 0,
    calculations: 0,
    topStudents: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      // Get student count
      const { count: studentCount, error: studentError } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

      if (studentError) throw studentError;

      // Get criteria count
      const { count: criteriaCount, error: criteriaError } = await supabase
        .from('criteria')
        .select('*', { count: 'exact', head: true });

      if (criteriaError) throw criteriaError;

      // Get AHP calculations count
      const { count: calculationsCount, error: calcError } = await supabase
        .from('ahp_results')
        .select('*', { count: 'exact', head: true });

      if (calcError) throw calcError;

      // Get top students count (with rank <= 10)
      const { count: topStudentsCount, error: topError } = await supabase
        .from('ahp_results')
        .select('*', { count: 'exact', head: true })
        .lte('rank', 10);

      if (topError) throw topError;

      setStats({
        students: studentCount || 0,
        criteria: criteriaCount || 0,
        calculations: calculationsCount || 0,
        topStudents: topStudentsCount || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast({
        title: "Error",
        description: "Gagal memuat statistik dashboard",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const statsData = [
    { title: 'Total Siswa', value: stats.students.toString(), icon: Users, color: 'bg-blue-500' },
    { title: 'Kriteria', value: stats.criteria.toString(), icon: FileText, color: 'bg-green-500' },
    { title: 'Perhitungan AHP', value: stats.calculations.toString(), icon: Calculator, color: 'bg-purple-500' },
    { title: 'Siswa Terpilih', value: stats.topStudents.toString(), icon: Trophy, color: 'bg-yellow-500' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <GraduationCap className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">SPK Siswa Berprestasi</h1>
                <p className="text-sm text-gray-500">SMPN 008 Guntung</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">Selamat datang, {user?.username}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onLogout}
                className="flex items-center"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value);
          if (value === 'overview') {
            fetchStats();
          }
        }} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="overview" className="flex items-center">
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="students" className="flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Data Siswa
            </TabsTrigger>
            <TabsTrigger value="criteria" className="flex items-center">
              <Settings className="h-4 w-4 mr-2" />
              Kriteria
            </TabsTrigger>
            <TabsTrigger value="calculation" className="flex items-center">
              <Calculator className="h-4 w-4 mr-2" />
              Perhitungan AHP
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center">
              <Trophy className="h-4 w-4 mr-2" />
              Ranking
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {statsData.map((stat, index) => (
                    <Card key={index} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-center">
                          <div className={`${stat.color} p-3 rounded-lg`}>
                            <stat.icon className="h-6 w-6 text-white" />
                          </div>
                          <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Selamat Datang di SPK Siswa Berprestasi</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">
                      Sistem Pendukung Keputusan ini menggunakan metode Analytical Hierarchy Process (AHP) 
                      untuk membantu dalam pemilihan siswa berprestasi di SMPN 008 Guntung.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h3 className="font-semibold text-blue-900 mb-2">Metode AHP</h3>
                        <p className="text-sm text-blue-700">
                          Analytical Hierarchy Process membantu pengambilan keputusan dengan 
                          membandingkan kriteria secara berpasangan untuk menghasilkan bobot yang objektif.
                        </p>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <h3 className="font-semibold text-green-900 mb-2">Proses Penilaian</h3>
                        <p className="text-sm text-green-700">
                          Sistem akan menghitung eigen vector, consistency ratio, dan menghasilkan 
                          ranking siswa berdasarkan kriteria yang telah ditentukan.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="students">
            <StudentManagement />
          </TabsContent>

          <TabsContent value="criteria">
            <CriteriaManagement />
          </TabsContent>

          <TabsContent value="calculation">
            <AHPCalculation />
          </TabsContent>

          <TabsContent value="results">
            <RankingResults />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
