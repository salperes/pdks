# UI Template - MSS Portal Design System

Bu doküman, MSS Portal projesinde kullanılan UI tasarım dilini ve pattern'lerini içerir. Diğer projelerde veya modüllerde tutarlı bir tasarım dili kullanmak için referans olarak kullanılabilir.

---

## 📋 İçindekiler

1. [Teknoloji Stack](#teknoloji-stack)
2. [Renk Paleti](#renk-paleti)
3. [Tema Sistemi](#tema-sistemi)
4. [Tipografi](#tipografi)
5. [Spacing Sistemi](#spacing-sistemi)
6. [İkon Kullanımı](#ikon-kullanımı)
7. [Layout Yapısı](#layout-yapısı)
8. [Navigasyon](#navigasyon)
9. [Component Pattern'leri](#component-patternleri)
10. [Form Elemanları](#form-elemanları)
11. [State Management](#state-management)
12. [API Service Pattern](#api-service-pattern)
13. [Responsive Design](#responsive-design)

---

## Teknoloji Stack

```json
{
  "framework": "React 18+",
  "language": "TypeScript",
  "buildTool": "Vite",
  "styling": "Tailwind CSS",
  "stateManagement": "Zustand",
  "dataFetching": "TanStack Query (React Query)",
  "httpClient": "Axios",
  "icons": "Lucide React",
  "routing": "React Router v7"
}
```

### Gerekli Dependencies

```bash
# Core
npm install react react-dom react-router-dom

# Styling
npm install -D tailwindcss postcss autoprefixer
npm install lucide-react

# State & Data
npm install zustand @tanstack/react-query axios
```

### Tailwind Config

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
};
```

---

## Renk Paleti

### Ana Renkler

| Renk | HEX | Kullanım |
|------|-----|----------|
| **Primary Blue** | `#0078d4` | Ana butonlar, aktif durumlar, linkler |
| **Primary Hover** | `#106ebe` | Buton hover durumu |
| **Dark Navy** | `#001529` | Header, Sidebar arka planı |
| **Ant Blue** | `#1890FF` | Avatar, aktif nav item |
| **Background Light** | `#F0F2F5` | Sayfa arka planı (light mode) |
| **Background Dark** | `#111827` (gray-900) | Sayfa arka planı (dark mode) |

### Durum Renkleri

```typescript
const statusColors = {
  // Error/Danger
  error: {
    bg: 'bg-[#fde7e9]',
    border: 'border-[#a80000]',
    text: 'text-[#a80000]',
  },
  // Success
  success: {
    bg: 'bg-emerald-100',
    border: 'border-emerald-500',
    text: 'text-emerald-700',
  },
  // Warning
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-500',
    text: 'text-amber-700',
  },
  // Info
  info: {
    bg: 'bg-blue-50',
    border: 'border-[#0078d4]',
    text: 'text-[#0078d4]',
  },
};
```

### Öncelik Renkleri (Announcements vb.)

```typescript
const priorityConfig = {
  critical: {
    border: 'border-l-red-500',
    bg: 'bg-red-50',
    text: 'text-red-700',
    label: 'Kritik'
  },
  important: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    label: 'Önemli'
  },
  info: {
    border: 'border-l-[#0078d4]',
    bg: 'bg-blue-50',
    text: 'text-[#0078d4]',
    label: 'Bilgi'
  },
};
```

### Kategori Renkleri

```typescript
const categoryConfig = {
  general: { color: 'bg-gray-100 text-gray-700', label: 'Genel' },
  hr: { color: 'bg-purple-100 text-purple-700', label: 'İK' },
  it: { color: 'bg-cyan-100 text-cyan-700', label: 'BT' },
  finance: { color: 'bg-emerald-100 text-emerald-700', label: 'Finans' },
};
```

---

## Tema Sistemi

### Theme Store (Zustand)

```typescript
// src/store/themeStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const applyTheme = (theme: Theme) => {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      toggleTheme: () => {
        const newTheme = get().theme === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
        set({ theme: newTheme });
      },
      setTheme: (theme: Theme) => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    }
  )
);
```

### Dark Mode Class Pattern

```tsx
// Light/Dark mode geçişi için standart pattern
<div className="bg-white dark:bg-gray-800">
  <h1 className="text-gray-900 dark:text-white">Başlık</h1>
  <p className="text-gray-500 dark:text-gray-400">Açıklama</p>
  <div className="border-gray-200 dark:border-gray-700">
    {/* İçerik */}
  </div>
</div>
```

### Theme Toggle Button

```tsx
import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../store/themeStore';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors"
      title={theme === 'light' ? 'Karanlık Mod' : 'Aydınlık Mod'}
    >
      {theme === 'light' ? (
        <Moon className="w-5 h-5 text-white/80" />
      ) : (
        <Sun className="w-5 h-5 text-white/80" />
      )}
    </button>
  );
};
```

---

## Tipografi

### Başlıklar

```tsx
// H1 - Sayfa başlıkları
<h1 className="text-2xl font-bold text-gray-900 dark:text-white">
  Sayfa Başlığı
</h1>

// H2 - Section başlıkları
<h2 className="text-xl font-semibold text-gray-900 dark:text-white">
  Bölüm Başlığı
</h2>

// H3 - Alt başlıklar
<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
  Alt Başlık
</h3>

// H4 - Card başlıkları
<h4 className="text-base font-medium text-gray-900 dark:text-white">
  Card Başlığı
</h4>
```

### Body Text

```tsx
// Normal text
<p className="text-gray-900 dark:text-gray-100">Normal metin</p>

// Muted text (açıklamalar)
<p className="text-sm text-gray-500 dark:text-gray-400">Açıklama metni</p>

// Extra small (tarih, meta)
<span className="text-xs text-gray-400 dark:text-gray-500">Meta bilgi</span>

// Uppercase label
<span className="text-xs text-gray-400 uppercase tracking-wider">
  LABEL
</span>
```

### Font Weights

- `font-normal` (400) - Body text
- `font-medium` (500) - Buttons, labels
- `font-semibold` (600) - Headings
- `font-bold` (700) - Page titles

---

## Spacing Sistemi

### Standart Değerler

| Token | Değer | Kullanım |
|-------|-------|----------|
| `p-2` | 8px | Tight padding (badges) |
| `p-3` | 12px | Button padding |
| `p-4` | 16px | Card padding (compact) |
| `p-6` | 24px | Card padding (standard) |
| `gap-2` | 8px | Tight gap |
| `gap-3` | 12px | Standard gap |
| `gap-4` | 16px | Section gap |
| `gap-6` | 24px | Large gap |
| `space-y-4` | 16px | List items |
| `space-y-6` | 24px | Page sections |

### Sabit Boyutlar

```typescript
const sizes = {
  headerHeight: 'h-12',      // 48px
  sidebarWidth: 'w-64',      // 256px
  iconSmall: 'w-4 h-4',      // 16px
  iconMedium: 'w-5 h-5',     // 20px
  iconLarge: 'w-6 h-6',      // 24px
  iconXL: 'w-8 h-8',         // 32px
  avatarSmall: 'w-8 h-8',    // 32px
  avatarMedium: 'w-10 h-10', // 40px
  avatarLarge: 'w-12 h-12',  // 48px
};
```

---

## İkon Kullanımı

### Lucide React İkonları

```bash
npm install lucide-react
```

### Yaygın Kullanılan İkonlar

```tsx
import {
  // Navigation
  Home,
  Bell,
  FileText,
  Grid3X3,
  Users,
  Settings,
  Menu,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,

  // Actions
  Search,
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  Eye,
  LogOut,

  // Status
  AlertCircle,
  Check,
  X,
  Loader2,

  // Content Types
  Folder,
  File,
  Image,
  BookOpen,
  Shield,
  Code,
  BarChart3,
  ClipboardList,

  // UI
  Sun,
  Moon,
  Maximize2,
  Minimize2,
} from 'lucide-react';
```

### İkon Boyutları

```tsx
// Small - Form labels, inline
<Icon className="w-4 h-4" />

// Medium - Navigation, buttons (en yaygın)
<Icon className="w-5 h-5" />

// Large - Page headers
<Icon className="w-6 h-6" />

// Extra Large - Loading states, hero
<Icon className="w-8 h-8" />

// Page Header Icon Container
<Icon className="w-10 h-10" />
```

### İkon Renkleri

```tsx
// Active/Selected
<Icon className="text-white" />

// Muted/Inactive
<Icon className="text-gray-400" />

// Primary
<Icon className="text-[#0078d4]" />

// Loading/Spinner
<Loader2 className="w-8 h-8 text-[#0078d4] animate-spin" />
```

---

## Layout Yapısı

### Ana Layout

```
┌─────────────────────────────────────────────────────────┐
│  Header (h-12, bg-[#001529], fixed, z-50)               │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│   Sidebar    │         Main Content Area                │
│   (w-64)     │         (lg:ml-64, pt-12)               │
│   fixed      │         bg-[#F0F2F5]                    │
│   z-40       │         p-6                             │
│              │                                          │
│              │         <Outlet />                       │
│              │                                          │
└──────────────┴──────────────────────────────────────────┘
```

### Layout Component

```tsx
// src/components/Layout.tsx
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export const Layout = () => {
  return (
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-gray-900">
      {/* Header */}
      <Header />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="lg:ml-64 pt-12">
        <main className="p-6 min-h-[calc(100vh-48px)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
```

### Sayfa Layout Pattern

```tsx
export const ExamplePage = () => {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded bg-[#0078d4] flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Sayfa Başlığı
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Sayfa açıklaması
            </p>
          </div>
        </div>
      </div>

      {/* Filters/Controls (optional) */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Search, filters, action buttons */}
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* Items, cards, tables */}
      </div>
    </div>
  );
};
```

---

## Navigasyon

### Header Component

```tsx
// src/components/Header.tsx
import { Menu, Search, Bell, Settings, HelpCircle, Sun, Moon, LogOut } from 'lucide-react';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';

export const Header = () => {
  const { theme, toggleTheme } = useThemeStore();
  const { user, logout } = useAuthStore();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-12 bg-[#001529] z-50 flex items-center justify-between px-4">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu Toggle */}
        <button className="lg:hidden w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-lg">
          <Menu className="w-5 h-5 text-white" />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Logo" className="w-8 h-8" />
          <span className="text-white font-semibold hidden md:block">
            MSS Portal
          </span>
        </div>
      </div>

      {/* Center - Search */}
      <div className="hidden md:flex flex-1 max-w-md mx-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Ara..."
            className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-white/40"
          />
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-1">
        {/* Theme Toggle */}
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

        {/* Settings */}
        <button className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-lg">
          <Settings className="w-5 h-5 text-white/80" />
        </button>

        {/* Notifications */}
        <button className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-lg relative">
          <Bell className="w-5 h-5 text-white/80" />
          {/* Notification dot */}
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* Help */}
        <button className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-lg">
          <HelpCircle className="w-5 h-5 text-white/80" />
        </button>

        {/* User Menu */}
        <div className="relative ml-2">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 hover:bg-white/10 rounded-lg px-2 py-1"
          >
            <div className="w-8 h-8 rounded-full bg-[#1890FF] flex items-center justify-center text-white text-sm font-medium">
              {user && getInitials(user.displayName)}
            </div>
          </button>

          {/* Dropdown */}
          {isUserMenuOpen && (
            <div className="absolute top-12 right-0 w-72 bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
              {/* User Info */}
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1890FF] flex items-center justify-center text-white font-medium">
                    {user && getInitials(user.displayName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {user?.displayName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="py-2">
                <button className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3">
                  <Settings className="w-4 h-4 text-gray-400" />
                  Ayarlar
                </button>
                <button
                  onClick={logout}
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
  );
};
```

### Sidebar Component

```tsx
// src/components/Sidebar.tsx
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Bell, FileText, Grid3X3, Users, LogOut, LucideIcon } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface NavItem {
  path: string;
  icon: LucideIcon;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/', icon: Home, label: 'Ana Sayfa' },
  { path: '/announcements', icon: Bell, label: 'Duyurular' },
  { path: '/documents', icon: FileText, label: 'Belgeler' },
  { path: '/applications', icon: Grid3X3, label: 'Uygulamalar' },
];

const adminItems: NavItem[] = [
  { path: '/admin/users', icon: Users, label: 'Kullanıcı Yönetimi' },
  { path: '/admin/announcements', icon: Bell, label: 'Duyuru Yönetimi' },
];

export const Sidebar = () => {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <aside className="fixed left-0 top-12 bottom-0 w-64 bg-[#001529] z-40 hidden lg:flex flex-col">
      {/* User Profile */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1890FF] flex items-center justify-center text-white font-medium">
            {user && getInitials(user.displayName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.displayName}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {user?.department}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-[#1890FF] text-white'
                    : 'text-gray-300 hover:bg-white/10'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Admin Section */}
        {user?.isAdmin && (
          <div className="mt-6 px-3">
            <p className="px-3 mb-2 text-xs text-gray-400 uppercase tracking-wider">
              Yönetim
            </p>
            <div className="space-y-1">
              {adminItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-[#1890FF] text-white'
                        : 'text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-white/10">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 w-full text-gray-300 hover:bg-white/10 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Çıkış Yap</span>
        </button>
      </div>
    </aside>
  );
};
```

---

## Component Pattern'leri

### Card Component

```tsx
// Basic Card
<div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
  {children}
</div>

// Card with Header
<div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
  <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
    <h3 className="font-semibold text-gray-900 dark:text-white">Başlık</h3>
  </div>
  <div className="p-6">
    {children}
  </div>
</div>
```

### Button Variants

```tsx
// Primary Button
<button className="px-4 py-2.5 bg-[#0078d4] hover:bg-[#106ebe] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
  Kaydet
</button>

// Secondary Button
<button className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors">
  İptal
</button>

// Danger Button
<button className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors">
  Sil
</button>

// Ghost Button
<button className="px-4 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium rounded-lg transition-colors">
  Geri
</button>

// Icon Button
<button className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
  <Edit2 className="w-5 h-5 text-gray-500" />
</button>

// Full Width Button
<button className="w-full py-2.5 px-4 bg-[#0078d4] hover:bg-[#106ebe] text-white font-medium rounded-lg transition-colors">
  Giriş Yap
</button>
```

### Alert/Message Components

```tsx
// Error Alert
<div className="p-4 bg-[#fde7e9] border-l-4 border-[#a80000] rounded-r-lg">
  <div className="flex items-start gap-3">
    <AlertCircle className="w-5 h-5 text-[#a80000] flex-shrink-0 mt-0.5" />
    <div>
      <p className="font-semibold text-[#a80000]">Hata</p>
      <p className="text-sm text-[#a80000]/80">Hata mesajı burada</p>
    </div>
  </div>
</div>

// Success Alert
<div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg">
  <div className="flex items-start gap-3">
    <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
    <div>
      <p className="font-semibold text-emerald-700">Başarılı</p>
      <p className="text-sm text-emerald-600">İşlem başarıyla tamamlandı.</p>
    </div>
  </div>
</div>

// Warning Alert
<div className="p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg">
  <div className="flex items-start gap-3">
    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
    <div>
      <p className="font-semibold text-amber-700">Uyarı</p>
      <p className="text-sm text-amber-600">Dikkat edilmesi gereken durum.</p>
    </div>
  </div>
</div>

// Info Alert
<div className="p-4 bg-blue-50 border-l-4 border-[#0078d4] rounded-r-lg">
  <div className="flex items-start gap-3">
    <AlertCircle className="w-5 h-5 text-[#0078d4] flex-shrink-0 mt-0.5" />
    <div>
      <p className="font-semibold text-[#0078d4]">Bilgi</p>
      <p className="text-sm text-blue-600">Bilgilendirme mesajı.</p>
    </div>
  </div>
</div>
```

### Badge/Tag Components

```tsx
// Basic Badge
<span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium">
  Label
</span>

// Status Badge
<span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
  Aktif
</span>

// Category Badge (using config)
const CategoryBadge = ({ category }: { category: string }) => {
  const config = categoryConfig[category] || categoryConfig.general;
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};
```

### Avatar Component

```tsx
interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  imageUrl?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
};

export const Avatar = ({ name, size = 'md', imageUrl }: AvatarProps) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`${sizeClasses[size]} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-[#1890FF] flex items-center justify-center text-white font-medium`}
    >
      {getInitials(name)}
    </div>
  );
};
```

### Modal Component

```tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal = ({ isOpen, onClose, title, children, footer }: ModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
```

### Dropdown Menu

```tsx
interface DropdownProps {
  trigger: React.ReactNode;
  items: Array<{
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
    danger?: boolean;
  }>;
}

export const Dropdown = ({ trigger, items }: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          <div className="py-1">
            {items.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={index}
                  onClick={() => {
                    item.onClick();
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    item.danger
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
```

### Loading States

```tsx
// Full Page Loading
<div className="flex items-center justify-center min-h-[400px]">
  <Loader2 className="w-8 h-8 text-[#0078d4] animate-spin" />
</div>

// Inline Loading
<div className="flex items-center gap-2">
  <Loader2 className="w-4 h-4 text-[#0078d4] animate-spin" />
  <span className="text-sm text-gray-500">Yükleniyor...</span>
</div>

// Button Loading
<button
  disabled={isLoading}
  className="px-4 py-2.5 bg-[#0078d4] hover:bg-[#106ebe] text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
>
  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
  {isLoading ? 'Kaydediliyor...' : 'Kaydet'}
</button>

// Skeleton Loading
<div className="animate-pulse">
  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
</div>
```

### Empty State

```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
    <FileText className="w-8 h-8 text-gray-400" />
  </div>
  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
    Veri Bulunamadı
  </h3>
  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
    Henüz herhangi bir kayıt bulunmuyor. Yeni kayıt eklemek için butona tıklayın.
  </p>
  <button className="mt-4 px-4 py-2 bg-[#0078d4] hover:bg-[#106ebe] text-white font-medium rounded-lg transition-colors">
    <Plus className="w-4 h-4 inline mr-2" />
    Yeni Ekle
  </button>
</div>
```

---

## Form Elemanları

### Text Input

```tsx
<div className="space-y-1">
  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
    Label
  </label>
  <input
    type="text"
    placeholder="Placeholder"
    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent transition-colors"
  />
</div>

// Underline Style (Login page)
<input
  type="text"
  placeholder="Kullanıcı Adı"
  className="w-full px-3 py-2 border-b-2 border-gray-300 dark:border-gray-600 bg-[#f2f2f2] dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:border-[#0078d4] focus:bg-white dark:focus:bg-gray-600 transition-colors"
/>
```

### Select

```tsx
<div className="space-y-1">
  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
    Kategori
  </label>
  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent">
    <option value="">Seçiniz</option>
    <option value="general">Genel</option>
    <option value="hr">İK</option>
    <option value="it">BT</option>
  </select>
</div>
```

### Textarea

```tsx
<div className="space-y-1">
  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
    Açıklama
  </label>
  <textarea
    rows={4}
    placeholder="Açıklama giriniz..."
    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent resize-none"
  />
</div>
```

### Checkbox

```tsx
<label className="flex items-center gap-2 cursor-pointer">
  <input
    type="checkbox"
    className="w-4 h-4 text-[#0078d4] border-gray-300 rounded focus:ring-[#0078d4] focus:ring-2"
  />
  <span className="text-sm text-gray-700 dark:text-gray-300">
    Kabul ediyorum
  </span>
</label>
```

### Search Input

```tsx
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
  <input
    type="text"
    placeholder="Ara..."
    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent"
  />
</div>
```

### Form Group

```tsx
<form className="space-y-4">
  {/* Text Input */}
  <div className="space-y-1">
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
      Başlık <span className="text-red-500">*</span>
    </label>
    <input
      type="text"
      required
      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0078d4]"
    />
  </div>

  {/* Select */}
  <div className="space-y-1">
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
      Kategori
    </label>
    <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0078d4]">
      <option value="">Seçiniz</option>
    </select>
  </div>

  {/* Actions */}
  <div className="flex items-center justify-end gap-3 pt-4">
    <button
      type="button"
      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
    >
      İptal
    </button>
    <button
      type="submit"
      className="px-4 py-2 bg-[#0078d4] hover:bg-[#106ebe] text-white rounded-lg"
    >
      Kaydet
    </button>
  </div>
</form>
```

---

## State Management

### Zustand Store Pattern

```typescript
// src/store/exampleStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ExampleState {
  // Data
  items: Item[];
  selectedItem: Item | null;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions
  setItems: (items: Item[]) => void;
  selectItem: (item: Item) => void;
  clearError: () => void;

  // Async Actions
  fetchItems: () => Promise<void>;
  createItem: (data: CreateItemDto) => Promise<void>;
}

export const useExampleStore = create<ExampleState>()(
  persist(
    (set, get) => ({
      // Initial State
      items: [],
      selectedItem: null,
      isLoading: false,
      error: null,

      // Sync Actions
      setItems: (items) => set({ items }),
      selectItem: (item) => set({ selectedItem: item }),
      clearError: () => set({ error: null }),

      // Async Actions
      fetchItems: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.get('/items');
          set({ items: response.data, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Bir hata oluştu',
            isLoading: false
          });
        }
      },

      createItem: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/items', data);
          set((state) => ({
            items: [...state.items, response.data],
            isLoading: false,
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Bir hata oluştu',
            isLoading: false
          });
        }
      },
    }),
    {
      name: 'example-storage',
      partialize: (state) => ({
        // Only persist certain fields
        selectedItem: state.selectedItem,
      }),
    }
  )
);
```

### Auth Store

```typescript
// src/store/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  department: string;
  isAdmin: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (username, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/login', { username, password });
          const { accessToken, refreshToken, user } = response.data;

          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);

          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'Giriş başarısız',
            isLoading: false,
          });
        }
      },

      logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, isAuthenticated: false });
      },

      fetchUser: async () => {
        try {
          const response = await api.get('/auth/me');
          set({ user: response.data, isAuthenticated: true });
        } catch {
          get().logout();
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
```

---

## API Service Pattern

### Axios Instance

```typescript
// src/services/api.ts
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor - Add JWT Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor - Handle 401 & Token Refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken } = response.data;
        localStorage.setItem('accessToken', accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
```

### Feature API Service

```typescript
// src/services/featureApi.ts
import { api } from './api';

export interface Item {
  id: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface CreateItemDto {
  title: string;
  description: string;
}

export interface UpdateItemDto {
  title?: string;
  description?: string;
}

export const featureApi = {
  getAll: () => api.get<Item[]>('/items'),
  getById: (id: string) => api.get<Item>(`/items/${id}`),
  create: (data: CreateItemDto) => api.post<Item>('/items', data),
  update: (id: string, data: UpdateItemDto) => api.patch<Item>(`/items/${id}`, data),
  delete: (id: string) => api.delete(`/items/${id}`),
};
```

### TanStack Query Usage

```typescript
// src/hooks/useItems.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { featureApi, CreateItemDto, UpdateItemDto } from '../services/featureApi';

export const useItems = () => {
  return useQuery({
    queryKey: ['items'],
    queryFn: () => featureApi.getAll().then((res) => res.data),
  });
};

export const useItem = (id: string) => {
  return useQuery({
    queryKey: ['items', id],
    queryFn: () => featureApi.getById(id).then((res) => res.data),
    enabled: !!id,
  });
};

export const useCreateItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateItemDto) => featureApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
};

export const useUpdateItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateItemDto }) =>
      featureApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
};

export const useDeleteItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => featureApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
};
```

---

## Responsive Design

### Breakpoints

```typescript
// Tailwind default breakpoints
const breakpoints = {
  sm: '640px',   // Small devices
  md: '768px',   // Tablets
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
  '2xl': '1536px', // Extra large
};
```

### Common Patterns

```tsx
// Hide/Show by breakpoint
<div className="lg:hidden">Mobile only</div>
<div className="hidden lg:block">Desktop only</div>
<div className="hidden md:flex">Tablet and up</div>

// Responsive flex direction
<div className="flex flex-col lg:flex-row gap-4">
  <div className="lg:w-1/3">Sidebar</div>
  <div className="lg:w-2/3">Content</div>
</div>

// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {items.map((item) => (
    <Card key={item.id} />
  ))}
</div>

// Responsive padding
<div className="p-4 md:p-6 lg:p-8">
  Content
</div>

// Responsive text
<h1 className="text-xl md:text-2xl lg:text-3xl font-bold">
  Başlık
</h1>
```

### Mobile Sidebar Pattern

```tsx
const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

return (
  <>
    {/* Mobile Overlay */}
    {isMobileMenuOpen && (
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={() => setIsMobileMenuOpen(false)}
      />
    )}

    {/* Sidebar */}
    <aside
      className={`
        fixed left-0 top-12 bottom-0 w-64 bg-[#001529] z-40
        transform transition-transform duration-300
        lg:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
    >
      {/* Sidebar content */}
    </aside>
  </>
);
```

---

## Z-Index Hiyerarşisi

```typescript
const zIndex = {
  base: 0,           // Normal content
  dropdown: 10,      // Dropdowns
  sticky: 20,        // Sticky headers
  fixed: 30,         // Fixed elements
  modalBackdrop: 40, // Modal backdrop
  modal: 50,         // Modal content
  popover: 60,       // Popovers, tooltips
  toast: 70,         // Toast notifications
};
```

---

## Dosya Yapısı Önerisi

```
src/
├── components/
│   ├── common/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── Avatar.tsx
│   │   ├── Badge.tsx
│   │   ├── Alert.tsx
│   │   ├── Dropdown.tsx
│   │   ├── Loading.tsx
│   │   └── EmptyState.tsx
│   ├── forms/
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Textarea.tsx
│   │   ├── Checkbox.tsx
│   │   └── SearchInput.tsx
│   ├── layout/
│   │   ├── Layout.tsx
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── PageHeader.tsx
│   └── index.ts
├── pages/
│   ├── Dashboard.tsx
│   ├── Login.tsx
│   └── ...
├── store/
│   ├── authStore.ts
│   ├── themeStore.ts
│   └── ...
├── services/
│   ├── api.ts
│   └── ...
├── hooks/
│   └── ...
├── types/
│   └── ...
├── App.tsx
├── main.tsx
└── index.css
```

---

## Kullanım Rehberi

### Yeni Proje Başlatma

1. **Vite + React projesi oluştur:**
   ```bash
   npm create vite@latest my-project -- --template react-ts
   cd my-project
   ```

2. **Dependencies yükle:**
   ```bash
   npm install zustand @tanstack/react-query axios react-router-dom lucide-react
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

3. **Tailwind config'i kopyala** (bu dokümandan)

4. **Global CSS ekle** (`index.css`):
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;

   body {
     @apply bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100;
   }
   ```

5. **Store'ları oluştur** (themeStore, authStore)

6. **Layout component'ini kopyala**

7. **Sayfa component'lerini oluştur**

---

## Notlar

- Bu tasarım sistemi **Microsoft Office + Ant Design** stilinden ilham almıştır
- Tüm component'ler **dark mode** destekler
- **Türkçe** lokalizasyon kullanılmaktadır
- **Erişilebilirlik** (a11y) göz önünde bulundurulmuştur
- **Mobile-first** responsive tasarım uygulanmıştır

---

*Son güncelleme: 2024*
