import { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, Sun, Moon, LogOut, Key, Bell, X, AlertTriangle, Clock, UserX } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { APP_VERSION } from '../../version';
import { api } from '../../services/api';
import { formatDate } from '../../utils/date';

interface HeaderProps {
  onMenuToggle: () => void;
}

interface Notification {
  id: number;
  type: 'unknown_card' | 'late_arrival' | 'after_hours';
  message: string;
  createdAt: string;
  isRead: boolean;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const getInitials = (name: string) =>
  name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

const notifIcon = (type: string) => {
  if (type === 'unknown_card') return <UserX className="w-4 h-4 text-amber-500" />;
  if (type === 'late_arrival') return <Clock className="w-4 h-4 text-orange-500" />;
  return <AlertTriangle className="w-4 h-4 text-red-500" />;
};

const timeAgo = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'Az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)}dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}s önce`;
  return formatDate(iso);
};

export const Header = ({ onMenuToggle }: HeaderProps) => {
  const { theme, toggleTheme } = useThemeStore();
  const { user, logout } = useAuthStore();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Password change
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');

  // Notifications
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Toast
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  };

  // Poll notification count
  const fetchUnreadCount = useCallback(() => {
    api.get('/notifications/count').then((r) => {
      setUnreadCount(r.data.count ?? 0);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const handleOpenNotifs = async () => {
    setShowNotifs(!showNotifs);
    setIsUserMenuOpen(false);
    if (!showNotifs) {
      try {
        const res = await api.get('/notifications');
        setNotifs(res.data);
      } catch { /* ignore */ }
    }
  };

  const handleMarkRead = async () => {
    try {
      await api.post('/notifications/mark-read');
      setUnreadCount(0);
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch { /* ignore */ }
  };

  // Password change
  const handleChangePassword = async () => {
    setPwError('');
    if (pwForm.newPw.length < 6) {
      setPwError('Yeni şifre en az 6 karakter olmalıdır');
      return;
    }
    if (pwForm.newPw !== pwForm.confirm) {
      setPwError('Yeni şifreler eşleşmiyor');
      return;
    }
    setPwLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: pwForm.current,
        newPassword: pwForm.newPw,
      });
      showToast('Şifre başarıyla değiştirildi. Yeniden giriş yapın.');
      setShowPwModal(false);
      setPwForm({ current: '', newPw: '', confirm: '' });
      setTimeout(() => logout(), 1500);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Şifre değiştirme başarısız';
      setPwError(typeof msg === 'string' ? msg : msg[0] || 'Hata');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <>
      {/* Toast */}
      {toasts.length > 0 && (
        <div className="fixed top-14 right-4 z-[60] space-y-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${
                t.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}

      <header className="fixed top-0 left-0 right-0 h-12 bg-[#001529] z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            className="lg:hidden w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-lg"
          >
            <Menu className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#0078d4] flex items-center justify-center text-white text-xs font-bold">
              PD
            </div>
            <span className="text-white font-semibold hidden md:block">PDKS</span>
            <span className="text-white/40 text-xs hidden md:block">v{APP_VERSION}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-lg"
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5 text-white/80" />
            ) : (
              <Sun className="w-5 h-5 text-white/80" />
            )}
          </button>

          {/* Notification bell */}
          <div className="relative">
            <button
              onClick={handleOpenNotifs}
              className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-lg relative"
            >
              <Bell className="w-5 h-5 text-white/80" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute top-12 right-0 w-80 bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Bildirimler</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkRead}
                      className="text-xs text-[#0078d4] hover:underline"
                    >
                      Tümünü okundu yap
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifs.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-400">
                      Bildirim yok
                    </div>
                  ) : (
                    notifs.map((n) => (
                      <div
                        key={n.id}
                        className={`flex items-start gap-3 px-3 py-2.5 border-b border-gray-50 dark:border-gray-700 ${
                          !n.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                        }`}
                      >
                        <div className="mt-0.5">{notifIcon(n.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                            {n.message}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {timeAgo(n.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative ml-2">
            <button
              onClick={() => { setIsUserMenuOpen(!isUserMenuOpen); setShowNotifs(false); }}
              className="flex items-center gap-2 hover:bg-white/10 rounded-lg px-2 py-1"
            >
              <div className="w-8 h-8 rounded-full bg-[#1890FF] flex items-center justify-center text-white text-sm font-medium">
                {user && getInitials(user.fullName)}
              </div>
              <span className="text-white text-sm hidden md:block">{user?.fullName}</span>
            </button>

            {isUserMenuOpen && (
              <div className="absolute top-12 right-0 w-64 bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.fullName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role}</p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => { setShowPwModal(true); setIsUserMenuOpen(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                  >
                    <Key className="w-4 h-4 text-gray-400" />
                    Şifre Değiştir
                  </button>
                  <button
                    onClick={() => { logout(); setIsUserMenuOpen(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                  >
                    <LogOut className="w-4 h-4" />
                    Çıkış Yap
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Password Change Modal */}
      {showPwModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPwModal(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#0078d4] flex items-center justify-center">
                  <Key className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Şifre Değiştir</h2>
              </div>
              <button onClick={() => setShowPwModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {pwError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                  {pwError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mevcut Şifre</label>
                <input
                  type="password"
                  value={pwForm.current}
                  onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0078d4]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Yeni Şifre</label>
                <input
                  type="password"
                  value={pwForm.newPw}
                  onChange={(e) => setPwForm((f) => ({ ...f, newPw: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0078d4]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Yeni Şifre (Tekrar)</label>
                <input
                  type="password"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0078d4]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowPwModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                İptal
              </button>
              <button
                onClick={handleChangePassword}
                disabled={pwLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[#0078d4] text-white hover:bg-[#106eba] disabled:opacity-50"
              >
                {pwLoading ? 'Kaydediliyor...' : 'Şifreyi Değiştir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
