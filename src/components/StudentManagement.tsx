
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Student {
  id: string;
  name: string;
  nis: string;
  class: string;
  academicScore?: number;
  behaviorScore?: number;
  achievementScore?: number;
  leadershipScore?: number;
  attendanceScore?: number;
}

interface Score {
  criteria_id: string;
  score: number;
}

const StudentManagement = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [criteria, setCriteria] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentScores, setStudentScores] = useState<{[key: string]: {[criteriaId: string]: number}}>({});

  const [formData, setFormData] = useState({
    name: '',
    nis: '',
    class: '',
    academicScore: '',
    behaviorScore: '',
    achievementScore: '',
    leadershipScore: '',
    attendanceScore: ''
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    fetchStudents();
    fetchCriteria();
  }, []);

  const fetchStudents = async () => {
    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*');

      if (studentsError) {
        throw studentsError;
      }

      // Get all scores
      const { data: scoresData, error: scoresError } = await supabase
        .from('student_scores')
        .select('student_id, criteria_id, score');

      if (scoresError) {
        throw scoresError;
      }

      // Organize scores by student_id and criteria_id
      const scoresByStudent: {[key: string]: {[criteriaId: string]: number}} = {};
      scoresData?.forEach(score => {
        if (!scoresByStudent[score.student_id]) {
          scoresByStudent[score.student_id] = {};
        }
        scoresByStudent[score.student_id][score.criteria_id] = score.score;
      });

      setStudentScores(scoresByStudent);
      setStudents(studentsData || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data siswa",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCriteria = async () => {
    try {
      const { data, error } = await supabase
        .from('criteria')
        .select('id, name')
        .order('name');

      if (error) {
        throw error;
      }

      setCriteria(data || []);
    } catch (error) {
      console.error('Error fetching criteria:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const studentData = {
        name: formData.name,
        nis: formData.nis,
        class: formData.class
      };

      let studentId = editingId;
      
      if (editingId) {
        // Update existing student
        const { error } = await supabase
          .from('students')
          .update(studentData)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        // Insert new student
        const { data, error } = await supabase
          .from('students')
          .insert(studentData)
          .select();

        if (error) throw error;
        studentId = data[0].id;
      }

      // Map criteria names to their IDs
      const criteriaMap: {[key: string]: string} = {
        'Akademik': criteria.find(c => c.name === 'Akademik')?.id || '',
        'Perilaku': criteria.find(c => c.name === 'Perilaku')?.id || '',
        'Prestasi': criteria.find(c => c.name === 'Prestasi')?.id || '',
        'Kepemimpinan': criteria.find(c => c.name === 'Kepemimpinan')?.id || '',
        'Kehadiran': criteria.find(c => c.name === 'Kehadiran')?.id || ''
      };

      // Update or insert scores
      if (studentId) {
        const scores = [
          { student_id: studentId, criteria_id: criteriaMap['Akademik'], score: Number(formData.academicScore) },
          { student_id: studentId, criteria_id: criteriaMap['Perilaku'], score: Number(formData.behaviorScore) },
          { student_id: studentId, criteria_id: criteriaMap['Prestasi'], score: Number(formData.achievementScore) },
          { student_id: studentId, criteria_id: criteriaMap['Kepemimpinan'], score: Number(formData.leadershipScore) },
          { student_id: studentId, criteria_id: criteriaMap['Kehadiran'], score: Number(formData.attendanceScore) }
        ];

        // First delete existing scores
        await supabase
          .from('student_scores')
          .delete()
          .eq('student_id', studentId);

        // Then insert new scores
        const { error: scoreError } = await supabase
          .from('student_scores')
          .insert(scores.filter(s => s.criteria_id && !isNaN(s.score)));

        if (scoreError) throw scoreError;
      }

      toast({
        title: editingId ? "Data Diperbarui" : "Data Ditambahkan",
        description: editingId ? "Data siswa berhasil diperbarui" : "Data siswa baru berhasil ditambahkan",
      });

      fetchStudents();
      resetForm();
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Error saving student:', error);
      toast({
        title: "Error",
        description: error.message || "Gagal menyimpan data siswa",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      nis: '',
      class: '',
      academicScore: '',
      behaviorScore: '',
      achievementScore: '',
      leadershipScore: '',
      attendanceScore: ''
    });
    setEditingId(null);
  };

  const handleEdit = async (student: Student) => {
    setEditingId(student.id);
    
    // Get scores for this student
    const scores = studentScores[student.id] || {};
    
    // Find criteria IDs
    const academicId = criteria.find(c => c.name === 'Akademik')?.id;
    const behaviorId = criteria.find(c => c.name === 'Perilaku')?.id;
    const achievementId = criteria.find(c => c.name === 'Prestasi')?.id;
    const leadershipId = criteria.find(c => c.name === 'Kepemimpinan')?.id;
    const attendanceId = criteria.find(c => c.name === 'Kehadiran')?.id;

    setFormData({
      name: student.name,
      nis: student.nis,
      class: student.class,
      academicScore: academicId && scores[academicId] ? scores[academicId].toString() : '',
      behaviorScore: behaviorId && scores[behaviorId] ? scores[behaviorId].toString() : '',
      achievementScore: achievementId && scores[achievementId] ? scores[achievementId].toString() : '',
      leadershipScore: leadershipId && scores[leadershipId] ? scores[leadershipId].toString() : '',
      attendanceScore: attendanceId && scores[attendanceId] ? scores[attendanceId].toString() : ''
    });
    
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      // Delete student (cascade will delete related scores)
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setStudents(students.filter(s => s.id !== id));
      toast({
        title: "Data Dihapus",
        description: "Data siswa berhasil dihapus",
      });
    } catch (error: any) {
      console.error('Error deleting student:', error);
      toast({
        title: "Error",
        description: error.message || "Gagal menghapus data siswa",
        variant: "destructive",
      });
    }
  };

  const getStudentScore = (studentId: string, criteriaName: string) => {
    const criteriaId = criteria.find(c => c.name === criteriaName)?.id;
    if (criteriaId && studentScores[studentId] && studentScores[studentId][criteriaId]) {
      return studentScores[studentId][criteriaId];
    }
    return '-';
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Manajemen Data Siswa</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="flex items-center">
                <Plus className="h-4 w-4 mr-2" />
                Tambah Siswa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? 'Edit Data Siswa' : 'Tambah Data Siswa'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nama Lengkap</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="nis">NIS</Label>
                  <Input
                    id="nis"
                    value={formData.nis}
                    onChange={(e) => setFormData({...formData, nis: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="class">Kelas</Label>
                  <Input
                    id="class"
                    value={formData.class}
                    onChange={(e) => setFormData({...formData, class: e.target.value})}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="academic">Nilai Akademik</Label>
                    <Input
                      id="academic"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.academicScore}
                      onChange={(e) => setFormData({...formData, academicScore: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="behavior">Nilai Perilaku</Label>
                    <Input
                      id="behavior"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.behaviorScore}
                      onChange={(e) => setFormData({...formData, behaviorScore: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="achievement">Nilai Prestasi</Label>
                    <Input
                      id="achievement"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.achievementScore}
                      onChange={(e) => setFormData({...formData, achievementScore: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="leadership">Nilai Kepemimpinan</Label>
                    <Input
                      id="leadership"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.leadershipScore}
                      onChange={(e) => setFormData({...formData, leadershipScore: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="attendance">Nilai Kehadiran</Label>
                  <Input
                    id="attendance"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.attendanceScore}
                    onChange={(e) => setFormData({...formData, attendanceScore: e.target.value})}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  {editingId ? 'Update' : 'Simpan'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>NIS</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Akademik</TableHead>
                  <TableHead>Perilaku</TableHead>
                  <TableHead>Prestasi</TableHead>
                  <TableHead>Kepemimpinan</TableHead>
                  <TableHead>Kehadiran</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-6 text-gray-500">
                      Belum ada data siswa. Klik "Tambah Siswa" untuk menambahkan data.
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>{student.nis}</TableCell>
                      <TableCell>{student.class}</TableCell>
                      <TableCell>{getStudentScore(student.id, 'Akademik')}</TableCell>
                      <TableCell>{getStudentScore(student.id, 'Perilaku')}</TableCell>
                      <TableCell>{getStudentScore(student.id, 'Prestasi')}</TableCell>
                      <TableCell>{getStudentScore(student.id, 'Kepemimpinan')}</TableCell>
                      <TableCell>{getStudentScore(student.id, 'Kehadiran')}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(student)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(student.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentManagement;
