import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import { ReportsPage } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import { SupervisorPage } from './pages/Supervisor';
import { WorkSchedulesPage } from './pages/WorkSchedules';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  if (!isAuthenticated) {
    // SSO token parametresini login sayfasına taşı
    const loginPath = location.search ? `/login${location.search}` : '/login';
    return <Navigate to={loginPath} replace />;
  }
  return <>{children}</>;
};

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
            <Route path="reports" element={<ReportsPage />} />
            <Route path="devices" element={<DevicesPage />} />
            <Route path="supervisor" element={<SupervisorPage />} />
            <Route path="locations" element={<LocationsPage />} />
            <Route path="admin/users" element={<UsersPage />} />
            <Route path="admin/work-schedules" element={<WorkSchedulesPage />} />
            <Route path="admin/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
