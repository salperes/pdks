import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export const LoginPage = () => {
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    clearError();
    login(username, password);
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-[#0078d4] flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
            PD
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">PDKS</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Personel Devam Kontrol Sistemi
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          {error && (
            <div className="mb-4 p-3 bg-[#fde7e9] border-l-4 border-[#a80000] rounded-r-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#a80000]" />
              <span className="text-sm text-[#a80000]">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Kullanici Adi
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Sifre
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-[#0078d4] hover:bg-[#106ebe] text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading ? 'Giris Yapiliyor...' : 'Giris Yap'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
