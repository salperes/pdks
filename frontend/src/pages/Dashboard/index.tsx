import { useEffect, useState, useCallback } from 'react';
import {
  Users,
  UserCheck,
  Cpu,
  Clock,
  RefreshCw,
  LogIn,
  LogOut,
  ArrowRight,
  Wifi,
  WifiOff,
  FileText,
  Settings,
  UserPlus,
  LayoutDashboard,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { formatTime } from '../../utils/date';
import type { AccessLog, Device, DashboardSummary } from '../../types';

/* ── Types ──────────────────────────────── */
interface HourlyStat {
  hour: number;
  in: number;
  out: number;
}

/* ── StatCard ───────────────────────────── */
const StatCard = ({
  icon: Icon,
  label,
  value,
  color,
  sub,
}: {
  icon: any;
  label: string;
  value: string | number;
  color: string;
  sub?: string;
}) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
    <div className="flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center`}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {value}
        </p>
        {sub && (
          <p className="text-xs text-gray-400 dark:text-gray-500">{sub}</p>
        )}
      </div>
    </div>
  </div>
);

/* ── QuickLink ──────────────────────────── */
const QuickLink = ({
  icon: Icon,
  label,
  to,
  color,
}: {
  icon: any;
  label: string;
  to: string;
  color: string;
}) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-full text-left"
    >
      <div
        className={`w-8 h-8 rounded ${color} flex items-center justify-center`}
      >
        <Icon className="w-4 h-4 text-white" />
      </div>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200 flex-1">
        {label}
      </span>
      <ArrowRight className="w-4 h-4 text-gray-400" />
    </button>
  );
};

/* ── HourlyChart ────────────────────────── */
const HourlyChart = ({ data }: { data: HourlyStat[] }) => {
  const max = Math.max(1, ...data.map((d) => d.in + d.out));
  // Sadece 06-22 arası göster
  const visible = data.filter((d) => d.hour >= 6 && d.hour <= 22);

  return (
    <div className="flex items-end gap-1 h-32">
      {visible.map((d) => {
        const total = d.in + d.out;
        const pct = (total / max) * 100;
        const inPct = total > 0 ? (d.in / total) * 100 : 0;
        return (
          <div key={d.hour} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full relative" style={{ height: '100px' }}>
              <div
                className="absolute bottom-0 w-full rounded-t overflow-hidden"
                style={{ height: `${pct}%` }}
                title={`${String(d.hour).padStart(2, '0')}:00 — Giriş: ${d.in}, Çıkış: ${d.out}`}
              >
                <div
                  className="bg-emerald-500 w-full"
                  style={{ height: `${inPct}%` }}
                />
                <div
                  className="bg-red-400 w-full"
                  style={{ height: `${100 - inPct}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] text-gray-400">{d.hour}</span>
          </div>
        );
      })}
    </div>
  );
};

/* ── Dashboard ──────────────────────────── */
export const DashboardPage = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentLogs, setRecentLogs] = useState<AccessLog[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [hourly, setHourly] = useState<HourlyStat[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    const results = await Promise.allSettled([
      api.get('/dashboard/summary'),
      api.get('/access-logs', { params: { limit: 20 } }),
      api.get('/devices'),
      api.get('/dashboard/hourly-stats'),
    ]);

    if (results[0].status === 'fulfilled') setSummary(results[0].value.data);
    if (results[1].status === 'fulfilled') {
      const d = results[1].value.data;
      setRecentLogs(d.data || d);
    }
    if (results[2].status === 'fulfilled') {
      const d = results[2].value.data;
      setDevices(Array.isArray(d) ? d : d.data || []);
    }
    if (results[3].status === 'fulfilled') setHourly(results[3].value.data);
  }, []);

  // İlk yükleme + 30 sn otomatik yenileme
  useEffect(() => {
    fetchAll();
    const timer = setInterval(fetchAll, 30000);
    return () => clearInterval(timer);
  }, [fetchAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setTimeout(() => setRefreshing(false), 600);
  };

  const activeDevices = devices.filter((d) => d.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-[#0078d4] flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Dashboard
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Personel Devam Kontrol Sistemi
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
            title="Yenile"
          >
            <RefreshCw
              className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Özet Kartlar */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Toplam Personel"
          value={summary?.totalPersonnel ?? '-'}
          color="bg-blue-500"
        />
        <StatCard
          icon={UserCheck}
          label="Bugün Gelen"
          value={summary?.todayArrived ?? '-'}
          color="bg-emerald-500"
        />
        <StatCard
          icon={LogIn}
          label="İçeride Olan"
          value={summary?.currentlyInside ?? '-'}
          color="bg-amber-500"
        />
        <StatCard
          icon={Cpu}
          label="Cihaz Durumu"
          value={
            summary
              ? `${summary.devicesOnline}/${summary.devicesTotal}`
              : '-'
          }
          color="bg-purple-500"
          sub={
            summary
              ? `${summary.devicesOnline} çevrimiçi`
              : undefined
          }
        />
      </div>

      {/* Saatlik İstatistik + Hızlı Erişim */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Saatlik Geçiş Grafiği */}
        <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Saatlik Geçiş İstatistikleri
            </h3>
            <div className="flex items-center gap-4 mt-1">
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Giriş
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                Çıkış
              </span>
            </div>
          </div>
          <div className="p-4">
            {hourly.length > 0 ? (
              <HourlyChart data={hourly} />
            ) : (
              <div className="h-32 flex items-center justify-center text-sm text-gray-400">
                Henüz veri yok
              </div>
            )}
          </div>
        </div>

        {/* Hızlı Erişim */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Hızlı Erişim
            </h3>
          </div>
          <div className="p-3 space-y-2">
            <QuickLink
              icon={Users}
              label="Personel Yönetimi"
              to="/personnel"
              color="bg-blue-500"
            />
            <QuickLink
              icon={FileText}
              label="Raporlar"
              to="/reports"
              color="bg-emerald-500"
            />
            <QuickLink
              icon={Cpu}
              label="Cihaz Yönetimi"
              to="/devices"
              color="bg-purple-500"
            />
            <QuickLink
              icon={UserPlus}
              label="Kullanıcı Yönetimi"
              to="/admin/users"
              color="bg-orange-500"
            />
            <QuickLink
              icon={Settings}
              label="Sistem Ayarları"
              to="/admin/settings"
              color="bg-gray-500"
            />
          </div>
        </div>
      </div>

      {/* Son Geçişler + Cihaz Durumu */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Son Geçişler */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Son Geçişler
            </h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-96 overflow-y-auto">
            {recentLogs.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Henüz geçiş kaydı yok
              </div>
            ) : (
              recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        log.direction === 'in'
                          ? 'bg-emerald-500'
                          : 'bg-red-500'
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {log.personnel
                          ? `${log.personnel.firstName} ${log.personnel.lastName}`
                          : `Kart #${log.deviceUserId}`}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {log.location?.name || log.device?.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${
                        log.direction === 'in'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}
                    >
                      {log.direction === 'in' ? (
                        <span className="flex items-center gap-1">
                          <LogIn className="w-3 h-3" /> GİRİŞ
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <LogOut className="w-3 h-3" /> ÇIKIŞ
                        </span>
                      )}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatTime(log.eventTime)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cihaz Durumları */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Cihaz Durumları
            </h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-96 overflow-y-auto">
            {activeDevices.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Aktif cihaz bulunamadı
              </div>
            ) : (
              activeDevices.map((device) => (
                <div
                  key={device.id}
                  className="px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {device.isOnline ? (
                      <Wifi className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-red-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {device.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {device.ipAddress}:{device.port}
                        {device.location && ` — ${device.location.name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${
                        device.isOnline
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}
                    >
                      {device.isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
                    </span>
                    {device.lastSyncAt && (
                      <span className="text-[10px] text-gray-400" title="Son senkronizasyon">
                        {formatTime(device.lastSyncAt)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
