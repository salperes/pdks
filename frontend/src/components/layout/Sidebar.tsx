import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Users,
  ClipboardList,
  Cpu,
  MapPin,
  BarChart3,
  Settings,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface NavItem {
  path: string;
  icon: LucideIcon;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/', icon: Home, label: 'Dashboard' },
  { path: '/personnel', icon: Users, label: 'Personel' },
  { path: '/access-logs', icon: ClipboardList, label: 'Gecis Kayitlari' },
  { path: '/reports', icon: BarChart3, label: 'Raporlar' },
];

const adminItems: NavItem[] = [
  { path: '/devices', icon: Cpu, label: 'Cihazlar' },
  { path: '/locations', icon: MapPin, label: 'Lokasyonlar' },
  { path: '/admin/users', icon: Users, label: 'Kullanicilar' },
  { path: '/admin/settings', icon: Settings, label: 'Ayarlar' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname === item.path;
    const Icon = item.icon;
    return (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={onClose}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
          isActive ? 'bg-[#1890FF] text-white' : 'text-gray-300 hover:bg-white/10'
        }`}
      >
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium">{item.label}</span>
      </NavLink>
    );
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed left-0 top-12 bottom-0 w-64 bg-[#001529] z-40 flex flex-col transform transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="flex-1 py-4 overflow-y-auto">
          <div className="space-y-1 px-3">{navItems.map(renderNavItem)}</div>

          {user?.role === 'admin' && (
            <div className="mt-6 px-3">
              <p className="px-3 mb-2 text-xs text-gray-400 uppercase tracking-wider">
                Yonetim
              </p>
              <div className="space-y-1">{adminItems.map(renderNavItem)}</div>
            </div>
          )}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 w-full text-gray-300 hover:bg-white/10 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Cikis Yap</span>
          </button>
        </div>
      </aside>
    </>
  );
};
