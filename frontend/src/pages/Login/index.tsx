import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';

export const LoginPage = () => {
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoError, setSsoError] = useState<string | null>(null);
  const ssoAttempted = useRef(false);

  // SSO token yakalama — Portal'dan gelen sso_token parametresini işle
  useEffect(() => {
    if (ssoAttempted.current || isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get('sso_token');
    if (!ssoToken) return;

    ssoAttempted.current = true;
    setSsoLoading(true);
    setSsoError(null);

    // URL'den token parametresini temizle (replay koruması)
    window.history.replaceState({}, '', window.location.pathname);

    api.get('/auth/sso', { params: { sso_token: ssoToken } })
      .then((res) => {
        const { accessToken, refreshToken, user } = res.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        useAuthStore.setState({ user, isAuthenticated: true });
      })
      .catch((err) => {
        setSsoError(err.response?.data?.message || 'SSO giriş başarısız');
      })
      .finally(() => setSsoLoading(false));
  }, [isAuthenticated]);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    clearError();
    login(username, password);
  };

  // SSO işlemi devam ederken loading ekranı göster
  if (ssoLoading) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#0078d4] mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Portal üzerinden giriş yapılıyor...</p>
        </div>
      </div>
    );
  }

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
          {ssoError && (
            <div className="mb-4 p-3 bg-[#fde7e9] border-l-4 border-[#a80000] rounded-r-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#a80000]" />
              <span className="text-sm text-[#a80000]">{ssoError}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-[#fde7e9] border-l-4 border-[#a80000] rounded-r-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#a80000]" />
              <span className="text-sm text-[#a80000]">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Kullanıcı Adı
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
                Şifre
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
              {isLoading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
