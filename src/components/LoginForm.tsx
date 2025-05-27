
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { GraduationCap, Lock, User } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface LoginFormProps {
  onLogin: (userData: { username: string; role: string }) => void;
}

const LoginForm = ({ onLogin }: LoginFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      if (!email || !password) {
        setErrorMessage("Email dan password tidak boleh kosong");
        return;
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);
        if (error.message.includes('Invalid login credentials')) {
          setErrorMessage("Email atau password salah");
        } else {
          setErrorMessage(error.message || "Terjadi kesalahan saat login");
        }
        return;
      }

      if (data.user) {
        // Get user profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('username, role')
          .eq('id', data.user.id)
          .single();
          
        if (profileError && !profileError.message.includes('No rows found')) {
          console.error('Profile error:', profileError);
          setErrorMessage("Gagal memuat data profil");
          return;
        }

        const userData = { 
          username: profileData?.username || data.user.email || 'Admin', 
          role: profileData?.role || 'user' 
        };
        
        onLogin(userData);

        toast({
          title: "Login Berhasil",
          description: "Selamat datang di SPK Siswa Berprestasi",
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrorMessage("Terjadi kesalahan tidak terduga");
      toast({
        title: "Login Error",
        description: "Terjadi kesalahan saat login",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <GraduationCap className="h-12 w-12 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">SPK Siswa Berprestasi</h1>
          <p className="text-gray-600">SMPN 008 Guntung</p>
          <p className="text-sm text-gray-500 mt-2">Sistem Pendukung Keputusan - Metode AHP</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-semibold text-gray-800">Login Administrator</CardTitle>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm">
                {errorMessage}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700">Email</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Masukkan email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5"
                disabled={loading}
              >
                {loading ? 'Memproses...' : 'Login'}
              </Button>
            </form>
            
            <div className="mt-6 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 text-center mb-2">Demo Login:</p>
              <p className="text-xs text-gray-700 text-center">Email: <span className="font-mono">admin@axemple.com</span></p>
              <p className="text-xs text-gray-700 text-center">Password: <span className="font-mono">admin123</span></p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginForm;
