import { useState } from 'react';
import { Menu, Sun, Moon, LogOut, Settings } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';

interface HeaderProps {
  onMenuToggle: () => void;
}

const getInitials = (name: string) =>
  name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

export const Header = ({ onMenuToggle }: HeaderProps) => {
  const { theme, toggleTheme } = useThemeStore();
  const { user, logout } = useAuthStore();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
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

        <div className="relative ml-2">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
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
                <button className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3">
                  <Settings className="w-4 h-4 text-gray-400" />
                  Ayarlar
                </button>
                <button
                  onClick={() => { logout(); setIsUserMenuOpen(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                >
                  <LogOut className="w-4 h-4" />
                  Cikis Yap
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
