import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { Layout } from './components/layout/Layout';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { PersonnelPage } from './pages/Personnel';
import { DevicesPage } from './pages/Devices';
import { LocationsPage } from './pages/Locations';
import { AccessLogsPage } from './pages/AccessLogs';
import { UsersPage } from './pages/Admin/Users';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
    <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h1>
    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Bu sayfa yapilandiriliyor...</p>
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="personnel" element={<PersonnelPage />} />
            <Route path="access-logs" element={<AccessLogsPage />} />
            <Route path="reports" element={<PlaceholderPage title="Raporlar" />} />
            <Route path="devices" element={<DevicesPage />} />
            <Route path="locations" element={<LocationsPage />} />
            <Route path="admin/users" element={<UsersPage />} />
            <Route path="admin/settings" element={<PlaceholderPage title="Ayarlar" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
