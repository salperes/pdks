import { useState, useCallback } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  Search,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Building2,
  Loader2,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatDate, formatTime } from '../../utils/date';

/* ────────────────── types ────────────────── */

interface DailyRecord {
  personnelId: string;
  firstName: string;
  lastName: string;
  department: string;
  firstIn: string | null;
  lastOut: string | null;
  totalHours: number;
  isPresent: boolean;
  isLate: boolean;
  isEarlyLeave: boolean;
  punchCount: number;
}

interface DailyReport {
  date: string;
  workStart: string;
  workEnd: string;
  records: DailyRecord[];
  summary: {
    totalPersonnel: number;
    present: number;
    absent: number;
    late: number;
    earlyLeave: number;
  };
}

interface MonthlyRecord {
  personnelId: string;
  firstName: string;
  lastName: string;
  department: string;
  daysPresent: number;
  daysAbsent: number;
  lateCount: number;
  earlyLeaveCount: number;
  totalHours: number;
  attendanceRate: number;
}

interface MonthlyReport {
  year: number;
  month: number;
  workDays: number;
  workStart: string;
  workEnd: string;
  records: MonthlyRecord[];
  summary: {
    totalPersonnel: number;
    avgAttendanceRate: number;
    totalLate: number;
    totalEarlyLeave: number;
  };
}

interface DepartmentRecord {
  department: string;
  totalPersonnel: number;
  presentPersonnel: number;
  avgAttendanceRate: number;
  lateCount: number;
  earlyLeaveCount: number;
  avgHoursPerDay: number;
}

interface DepartmentReport {
  startDate: string;
  endDate: string;
  workDays: number;
  records: DepartmentRecord[];
}

type TabKey = 'daily' | 'monthly' | 'department';

/* ────────────────── helpers ────────────────── */

const todays = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const formatTimeNullable = (iso: string | null) => {
  if (!iso) return '-';
  return formatTime(iso);
};

const fmtDateLabel = (iso: string) => formatDate(iso);

const monthNames: Record<number, string> = {
  1: 'Ocak',
  2: 'Şubat',
  3: 'Mart',
  4: 'Nisan',
  5: 'Mayıs',
  6: 'Haziran',
  7: 'Temmuz',
  8: 'Ağustos',
  9: 'Eylül',
  10: 'Ekim',
  11: 'Kasım',
  12: 'Aralık',
};

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const bom = '\uFEFF';
  const csv =
    bom + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ────────────────── sub-components ────────────────── */

const StatCard = ({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  color: string;
}) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
    <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  </div>
);

const Spinner = () => (
  <div className="flex flex-col items-center gap-3 py-16">
    <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-600 border-t-[#0078d4] rounded-full animate-spin" />
    <span className="text-sm text-gray-500 dark:text-gray-400">Yükleniyor...</span>
  </div>
);

const Empty = ({ text }: { text: string }) => (
  <div className="flex flex-col items-center gap-3 py-16">
    <BarChart3 className="w-10 h-10 text-gray-300 dark:text-gray-600" />
    <span className="text-sm text-gray-500 dark:text-gray-400">{text}</span>
  </div>
);

/* ────────────────── main component ────────────────── */

export const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('daily');
  const [search, setSearch] = useState('');

  // ─── Daily state ───
  const [dailyDate, setDailyDate] = useState(todays());
  const [dailyData, setDailyData] = useState<DailyReport | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);

  // ─── Monthly state ───
  const [monthVal, setMonthVal] = useState(thisMonth());
  const [monthlyData, setMonthlyData] = useState<MonthlyReport | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // ─── Department state ───
  const [deptStart, setDeptStart] = useState(monthStart());
  const [deptEnd, setDeptEnd] = useState(todays());
  const [deptData, setDeptData] = useState<DepartmentReport | null>(null);
  const [deptLoading, setDeptLoading] = useState(false);

  /* ────── fetch handlers ────── */

  const fetchDaily = useCallback(async () => {
    setDailyLoading(true);
    try {
      const res = await api.get<DailyReport>('/reports/daily-attendance', {
        params: { date: dailyDate },
      });
      setDailyData(res.data);
    } catch {
      setDailyData(null);
    } finally {
      setDailyLoading(false);
    }
  }, [dailyDate]);

  const fetchMonthly = useCallback(async () => {
    setMonthlyLoading(true);
    try {
      const [y, m] = monthVal.split('-').map(Number);
      const res = await api.get<MonthlyReport>('/reports/monthly-summary', {
        params: { year: y, month: m },
      });
      setMonthlyData(res.data);
    } catch {
      setMonthlyData(null);
    } finally {
      setMonthlyLoading(false);
    }
  }, [monthVal]);

  const fetchDept = useCallback(async () => {
    setDeptLoading(true);
    try {
      const res = await api.get<DepartmentReport>('/reports/department-summary', {
        params: { startDate: deptStart, endDate: deptEnd },
      });
      setDeptData(res.data);
    } catch {
      setDeptData(null);
    } finally {
      setDeptLoading(false);
    }
  }, [deptStart, deptEnd]);

  /* ────── CSV export handlers ────── */

  const exportDailyCSV = () => {
    if (!dailyData) return;
    const headers = [
      'Ad',
      'Soyad',
      'Departman',
      'Giriş',
      'Çıkış',
      'Süre (saat)',
      'Durum',
      'Geç Kaldı',
      'Erken Çıktı',
    ];
    const rows = dailyData.records.map((r) => [
      r.firstName,
      r.lastName,
      r.department || '-',
      formatTimeNullable(r.firstIn),
      formatTimeNullable(r.lastOut),
      String(r.totalHours),
      r.isPresent ? 'Geldi' : 'Gelmedi',
      r.isLate ? 'Evet' : 'Hayır',
      r.isEarlyLeave ? 'Evet' : 'Hayır',
    ]);
    downloadCSV(`gunluk-devam-${dailyData.date}.csv`, headers, rows);
  };

  const exportMonthlyCSV = () => {
    if (!monthlyData) return;
    const headers = [
      'Ad',
      'Soyad',
      'Departman',
      'Gelen Gün',
      'Devamsız',
      'Geç Kalma',
      'Erken Çıkma',
      'Toplam Saat',
      'Devam Oranı (%)',
    ];
    const rows = monthlyData.records.map((r) => [
      r.firstName,
      r.lastName,
      r.department || '-',
      String(r.daysPresent),
      String(r.daysAbsent),
      String(r.lateCount),
      String(r.earlyLeaveCount),
      String(r.totalHours),
      String(r.attendanceRate),
    ]);
    downloadCSV(
      `aylik-ozet-${monthlyData.year}-${String(monthlyData.month).padStart(2, '0')}.csv`,
      headers,
      rows,
    );
  };

  const exportDeptCSV = () => {
    if (!deptData) return;
    const headers = [
      'Departman',
      'Personel Sayısı',
      'Gelen Kişi',
      'Devam Oranı (%)',
      'Geç Kalma',
      'Erken Çıkma',
      'Ort. Saat/Gün',
    ];
    const rows = deptData.records.map((r) => [
      r.department,
      String(r.totalPersonnel),
      String(r.presentPersonnel),
      String(r.avgAttendanceRate),
      String(r.lateCount),
      String(r.earlyLeaveCount),
      String(r.avgHoursPerDay),
    ]);
    downloadCSV(
      `departman-analizi-${deptData.startDate}_${deptData.endDate}.csv`,
      headers,
      rows,
    );
  };

  /* ────── filtered records ────── */

  const filterByName = <T extends { firstName: string; lastName: string }>(
    list: T[],
  ) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (r) =>
        r.firstName.toLowerCase().includes(q) ||
        r.lastName.toLowerCase().includes(q),
    );
  };

  const filterDeptByName = (list: DepartmentRecord[]) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((r) => r.department.toLowerCase().includes(q));
  };

  /* ────── tab definitions ────── */

  const tabs: { key: TabKey; label: string; icon: typeof BarChart3 }[] = [
    { key: 'daily', label: 'Günlük Devam', icon: Calendar },
    { key: 'monthly', label: 'Aylık Özet', icon: Clock },
    { key: 'department', label: 'Departman Analizi', icon: Building2 },
  ];

  /* ────── shared styles ────── */

  const thClass =
    'text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider';
  const tdClass = 'px-4 py-3 text-sm text-gray-700 dark:text-gray-300';
  const btnPrimary =
    'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#0078d4] text-white hover:bg-[#106eba] transition-colors disabled:opacity-50';
  const btnOutline =
    'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50';
  const inputClass =
    'rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent';

  /* ────────────────────────────────────── */
  /* ────────────── RENDER ──────────────── */
  /* ────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* ====== Header ====== */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0078d4] flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Raporlar
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Devam kontrol raporları ve analizler
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-9 w-full sm:w-64`}
            />
          </div>
        </div>
      </div>

      {/* ====== Tabs ====== */}
      <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-1.5">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-[#0078d4] text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ====== Tab Content ====== */}

      {/* ── DAILY TAB ── */}
      {activeTab === 'daily' && (
        <>
          {/* Filter bar */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Tarih
                </label>
                <input
                  type="date"
                  value={dailyDate}
                  onChange={(e) => setDailyDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                onClick={fetchDaily}
                disabled={dailyLoading}
                className={btnPrimary}
              >
                {dailyLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Sorgula
              </button>
              {dailyData && (
                <button onClick={exportDailyCSV} className={btnOutline}>
                  <Download className="w-4 h-4" />
                  CSV İndir
                </button>
              )}
              {dailyData && (
                <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
                  Mesai: {dailyData.workStart} - {dailyData.workEnd}
                </span>
              )}
            </div>
          </div>

          {/* Summary cards */}
          {dailyData && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <StatCard
                icon={Users}
                label="Toplam Personel"
                value={dailyData.summary.totalPersonnel}
                color="bg-[#0078d4]"
              />
              <StatCard
                icon={CheckCircle}
                label="Gelen"
                value={dailyData.summary.present}
                color="bg-emerald-500"
              />
              <StatCard
                icon={XCircle}
                label="Gelmeyen"
                value={dailyData.summary.absent}
                color="bg-red-500"
              />
              <StatCard
                icon={AlertTriangle}
                label="Geç Kalan"
                value={dailyData.summary.late}
                color="bg-amber-500"
              />
              <StatCard
                icon={Clock}
                label="Erken Çıkan"
                value={dailyData.summary.earlyLeave}
                color="bg-orange-500"
              />
            </div>
          )}

          {/* Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {dailyLoading ? (
              <Spinner />
            ) : !dailyData ? (
              <Empty text="Tarih seçip Sorgula butonuna tıklayın" />
            ) : (
              <>
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {fmtDateLabel(dailyData.date)} — Günlük Devam Raporu
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                        <th className={thClass}>Personel</th>
                        <th className={thClass}>Departman</th>
                        <th className={thClass}>Giriş</th>
                        <th className={thClass}>Çıkış</th>
                        <th className={thClass}>Süre</th>
                        <th className={thClass}>Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filterByName(dailyData.records).length === 0 ? (
                        <tr>
                          <td colSpan={6}>
                            <Empty text="Kayıt bulunamadı" />
                          </td>
                        </tr>
                      ) : (
                        filterByName(dailyData.records).map((r) => (
                          <tr
                            key={r.personnelId}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <td className={`${tdClass} font-medium text-gray-900 dark:text-white`}>
                              {r.firstName} {r.lastName}
                            </td>
                            <td className={tdClass}>{r.department || '-'}</td>
                            <td className={tdClass}>{formatTimeNullable(r.firstIn)}</td>
                            <td className={tdClass}>{formatTimeNullable(r.lastOut)}</td>
                            <td className={tdClass}>
                              {r.totalHours > 0 ? `${r.totalHours} sa` : '-'}
                            </td>
                            <td className={tdClass}>
                              <div className="flex flex-wrap gap-1">
                                {!r.isPresent && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                                    <XCircle className="w-3 h-3" />
                                    Gelmedi
                                  </span>
                                )}
                                {r.isPresent && !r.isLate && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                                    <CheckCircle className="w-3 h-3" />
                                    Geldi
                                  </span>
                                )}
                                {r.isLate && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                                    <AlertTriangle className="w-3 h-3" />
                                    Geç
                                  </span>
                                )}
                                {r.isEarlyLeave && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
                                    <Clock className="w-3 h-3" />
                                    Erken Çıktı
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── MONTHLY TAB ── */}
      {activeTab === 'monthly' && (
        <>
          {/* Filter bar */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Ay
                </label>
                <input
                  type="month"
                  value={monthVal}
                  onChange={(e) => setMonthVal(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                onClick={fetchMonthly}
                disabled={monthlyLoading}
                className={btnPrimary}
              >
                {monthlyLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Sorgula
              </button>
              {monthlyData && (
                <button onClick={exportMonthlyCSV} className={btnOutline}>
                  <Download className="w-4 h-4" />
                  CSV İndir
                </button>
              )}
              {monthlyData && (
                <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
                  İş günü: {monthlyData.workDays} | Mesai: {monthlyData.workStart} -{' '}
                  {monthlyData.workEnd}
                </span>
              )}
            </div>
          </div>

          {/* Summary mini-cards */}
          {monthlyData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                icon={Users}
                label="Toplam Personel"
                value={monthlyData.summary.totalPersonnel}
                color="bg-[#0078d4]"
              />
              <StatCard
                icon={CheckCircle}
                label="Ort. Devam Oranı"
                value={`%${monthlyData.summary.avgAttendanceRate}`}
                color="bg-emerald-500"
              />
              <StatCard
                icon={AlertTriangle}
                label="Toplam Geç Kalma"
                value={monthlyData.summary.totalLate}
                color="bg-amber-500"
              />
              <StatCard
                icon={Clock}
                label="Toplam Erken Çıkma"
                value={monthlyData.summary.totalEarlyLeave}
                color="bg-orange-500"
              />
            </div>
          )}

          {/* Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {monthlyLoading ? (
              <Spinner />
            ) : !monthlyData ? (
              <Empty text="Ay seçip Sorgula butonuna tıklayın" />
            ) : (
              <>
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {monthNames[monthlyData.month]} {monthlyData.year} — Aylık Devam Özeti
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                        <th className={thClass}>Personel</th>
                        <th className={thClass}>Departman</th>
                        <th className={`${thClass} text-center`}>Gelen Gün</th>
                        <th className={`${thClass} text-center`}>Devamsız</th>
                        <th className={`${thClass} text-center`}>Geç</th>
                        <th className={`${thClass} text-center`}>Erken Çıkma</th>
                        <th className={`${thClass} text-right`}>Toplam Saat</th>
                        <th className={`${thClass} text-right`}>Devam Oranı</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filterByName(monthlyData.records).length === 0 ? (
                        <tr>
                          <td colSpan={8}>
                            <Empty text="Kayıt bulunamadı" />
                          </td>
                        </tr>
                      ) : (
                        filterByName(monthlyData.records).map((r) => (
                          <tr
                            key={r.personnelId}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <td className={`${tdClass} font-medium text-gray-900 dark:text-white`}>
                              {r.firstName} {r.lastName}
                            </td>
                            <td className={tdClass}>{r.department || '-'}</td>
                            <td className={`${tdClass} text-center`}>
                              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                {r.daysPresent}
                              </span>
                            </td>
                            <td className={`${tdClass} text-center`}>
                              <span
                                className={
                                  r.daysAbsent > 0
                                    ? 'font-medium text-red-600 dark:text-red-400'
                                    : ''
                                }
                              >
                                {r.daysAbsent}
                              </span>
                            </td>
                            <td className={`${tdClass} text-center`}>
                              <span
                                className={
                                  r.lateCount > 0
                                    ? 'font-medium text-amber-600 dark:text-amber-400'
                                    : ''
                                }
                              >
                                {r.lateCount}
                              </span>
                            </td>
                            <td className={`${tdClass} text-center`}>
                              <span
                                className={
                                  r.earlyLeaveCount > 0
                                    ? 'font-medium text-orange-600 dark:text-orange-400'
                                    : ''
                                }
                              >
                                {r.earlyLeaveCount}
                              </span>
                            </td>
                            <td className={`${tdClass} text-right`}>{r.totalHours}</td>
                            <td className={`${tdClass} text-right`}>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  r.attendanceRate >= 90
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                                    : r.attendanceRate >= 70
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                                      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                }`}
                              >
                                %{r.attendanceRate}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── DEPARTMENT TAB ── */}
      {activeTab === 'department' && (
        <>
          {/* Filter bar */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Başlangıç
                </label>
                <input
                  type="date"
                  value={deptStart}
                  onChange={(e) => setDeptStart(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Bitiş
                </label>
                <input
                  type="date"
                  value={deptEnd}
                  onChange={(e) => setDeptEnd(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                onClick={fetchDept}
                disabled={deptLoading}
                className={btnPrimary}
              >
                {deptLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Sorgula
              </button>
              {deptData && (
                <button onClick={exportDeptCSV} className={btnOutline}>
                  <Download className="w-4 h-4" />
                  CSV İndir
                </button>
              )}
              {deptData && (
                <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
                  İş günü: {deptData.workDays}
                </span>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {deptLoading ? (
              <Spinner />
            ) : !deptData ? (
              <Empty text="Tarih aralığı seçip Sorgula butonuna tıklayın" />
            ) : (
              <>
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {fmtDateLabel(deptData.startDate)} — {fmtDateLabel(deptData.endDate)} | Departman Analizi
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                        <th className={thClass}>Departman</th>
                        <th className={`${thClass} text-center`}>Personel</th>
                        <th className={`${thClass} text-center`}>Gelen Kişi</th>
                        <th className={`${thClass} text-center`}>Devam Oranı</th>
                        <th className={`${thClass} text-center`}>Geç Kalma</th>
                        <th className={`${thClass} text-center`}>Erken Çıkma</th>
                        <th className={`${thClass} text-right`}>Ort. Saat/Gün</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filterDeptByName(deptData.records).length === 0 ? (
                        <tr>
                          <td colSpan={7}>
                            <Empty text="Kayıt bulunamadı" />
                          </td>
                        </tr>
                      ) : (
                        filterDeptByName(deptData.records).map((r) => (
                          <tr
                            key={r.department}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <td className={`${tdClass} font-medium text-gray-900 dark:text-white`}>
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-gray-400" />
                                {r.department}
                              </div>
                            </td>
                            <td className={`${tdClass} text-center`}>{r.totalPersonnel}</td>
                            <td className={`${tdClass} text-center`}>{r.presentPersonnel}</td>
                            <td className={`${tdClass} text-center`}>
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      r.avgAttendanceRate >= 90
                                        ? 'bg-emerald-500'
                                        : r.avgAttendanceRate >= 70
                                          ? 'bg-amber-500'
                                          : 'bg-red-500'
                                    }`}
                                    style={{ width: `${Math.min(r.avgAttendanceRate, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium">%{r.avgAttendanceRate}</span>
                              </div>
                            </td>
                            <td className={`${tdClass} text-center`}>
                              <span
                                className={
                                  r.lateCount > 0
                                    ? 'font-medium text-amber-600 dark:text-amber-400'
                                    : ''
                                }
                              >
                                {r.lateCount}
                              </span>
                            </td>
                            <td className={`${tdClass} text-center`}>
                              <span
                                className={
                                  r.earlyLeaveCount > 0
                                    ? 'font-medium text-orange-600 dark:text-orange-400'
                                    : ''
                                }
                              >
                                {r.earlyLeaveCount}
                              </span>
                            </td>
                            <td className={`${tdClass} text-right font-medium`}>
                              {r.avgHoursPerDay} sa
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};
