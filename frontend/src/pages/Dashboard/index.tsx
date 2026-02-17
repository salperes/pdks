import { useEffect, useState } from 'react';
import { Users, UserCheck, Building2, Cpu, Clock } from 'lucide-react';
import { api } from '../../services/api';
import type { AccessLog, DashboardSummary } from '../../types';

const StatCard = ({ icon: Icon, label, value, color }: {
  icon: any;
  label: string;
  value: string | number;
  color: string;
}) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  </div>
);

export const DashboardPage = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentLogs, setRecentLogs] = useState<AccessLog[]>([]);

  useEffect(() => {
    api.get('/dashboard/summary').then((r) => setSummary(r.data)).catch(() => {});
    api.get('/access-logs', { params: { limit: 20 } })
      .then((r) => setRecentLogs(r.data.data || r.data))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-[#0078d4] flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Personel Devam Kontrol Sistemi
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Toplam Personel"
          value={summary?.totalPersonnel ?? '-'}
          color="bg-blue-500"
        />
        <StatCard
          icon={UserCheck}
          label="Bugun Gelen"
          value={summary?.todayArrived ?? '-'}
          color="bg-emerald-500"
        />
        <StatCard
          icon={Building2}
          label="Iceride Olan"
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
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Son Gecisler
            </h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-96 overflow-y-auto">
            {recentLogs.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Henuz gecis kaydi yok
              </div>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        log.direction === 'in' ? 'bg-emerald-500' : 'bg-red-500'
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
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {log.direction === 'in' ? 'GIRIS' : 'CIKIS'}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(log.eventTime).toLocaleTimeString('tr-TR')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Cihaz Durumlari
            </h3>
          </div>
          <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Cihaz verileri yukleniyor...
          </div>
        </div>
      </div>
    </div>
  );
};
