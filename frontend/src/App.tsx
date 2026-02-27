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
import { OperatorPanelPage } from './pages/OperatorPanel';

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

/** Operatör rolü sadece /operator-panel erişebilir */
const OperatorRedirect = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore();
  if (user?.role === 'operator') {
    return <Navigate to="/operator-panel" replace />;
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
            <Route index element={<OperatorRedirect><DashboardPage /></OperatorRedirect>} />
            <Route path="personnel" element={<OperatorRedirect><PersonnelPage /></OperatorRedirect>} />
            <Route path="access-logs" element={<OperatorRedirect><AccessLogsPage /></OperatorRedirect>} />
            <Route path="reports" element={<OperatorRedirect><ReportsPage /></OperatorRedirect>} />
            <Route path="devices" element={<OperatorRedirect><DevicesPage /></OperatorRedirect>} />
            <Route path="supervisor" element={<OperatorRedirect><SupervisorPage /></OperatorRedirect>} />
            <Route path="operator-panel" element={<OperatorPanelPage />} />
            <Route path="locations" element={<OperatorRedirect><LocationsPage /></OperatorRedirect>} />
            <Route path="admin/users" element={<OperatorRedirect><UsersPage /></OperatorRedirect>} />
            <Route path="admin/work-schedules" element={<OperatorRedirect><WorkSchedulesPage /></OperatorRedirect>} />
            <Route path="admin/settings" element={<OperatorRedirect><SettingsPage /></OperatorRedirect>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
