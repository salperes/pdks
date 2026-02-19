import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Settings,
  Clock,
  RefreshCw,
  Calendar,
  Plus,
  Trash2,
  Download,
  Users,
  Cpu,
  MapPin,
  ClipboardList,
  Database,
  CheckCircle,
  Loader2,
  Server,
  X,
  FileText,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { api } from '../../services/api';
import { APP_VERSION } from '../../version';
import { formatDateTimeSec, formatDate } from '../../utils/date';

/* ────────────────── types ────────────────── */

interface SettingsData {
  workStartTime: string;
  workEndTime: string;
  timezoneOffset: number;
  syncInterval: number;
  backupEnabled: boolean;
  backupRetentionDays: number;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
}

interface SystemInfo {
  personnelCount: number;
  deviceCount: number;
  locationCount: number;
  accessLogCount: number;
  dbStatus: string;
}

interface AuditLog {
  id: string;
  createdAt: string;
  username: string;
  action: string;
  target: string;
  detail: string;
}

interface BackupRecord {
  filename: string;
  createdAt: string;
  size: number;
  status: 'success' | 'failed';
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

/* ────────────────── helpers ────────────────── */

const formatDateTime = (iso: string) => formatDateTimeSec(iso);

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const actionBadge = (action: string) => {
  switch (action) {
    case 'CREATE':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'UPDATE':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'DELETE':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'LOGIN':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
};

/* ────────────────── main component ────────────────── */

export const SettingsPage = () => {
  /* ── state ── */
  const [settings, setSettings] = useState<SettingsData>({
    workStartTime: '08:00',
    workEndTime: '17:00',
    timezoneOffset: 3,
    syncInterval: 120,
    backupEnabled: false,
    backupRetentionDays: 30,
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(true);
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [addingHoliday, setAddingHoliday] = useState(false);

  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [sysInfoLoading, setSysInfoLoading] = useState(true);

  const [backupLoading, setBackupLoading] = useState(false);

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(true);

  // Backup history state
  const [backupHistory, setBackupHistory] = useState<BackupRecord[]>([]);
  const [backupHistoryLoading, setBackupHistoryLoading] = useState(true);
  const [dbBackupLoading, setDbBackupLoading] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

  /* ── helpers ── */
  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  /* ── fetch ── */
  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get('/settings');
      setSettings({
        workStartTime: res.data.workStartTime,
        workEndTime: res.data.workEndTime,
        timezoneOffset: res.data.timezoneOffset,
        syncInterval: res.data.syncInterval,
        backupEnabled: res.data.backupEnabled ?? false,
        backupRetentionDays: res.data.backupRetentionDays ?? 30,
      });
    } catch { /* ignore */ }
    setSettingsLoading(false);
  }, []);

  const fetchHolidays = useCallback(async () => {
    try {
      const res = await api.get('/settings/holidays');
      setHolidays(res.data);
    } catch { /* ignore */ }
    setHolidaysLoading(false);
  }, []);

  const fetchSysInfo = useCallback(async () => {
    try {
      const res = await api.get('/settings/system-info');
      setSysInfo(res.data);
    } catch { /* ignore */ }
    setSysInfoLoading(false);
  }, []);

  const fetchAuditLogs = useCallback(async (page: number) => {
    setAuditLoading(true);
    try {
      const res = await api.get(`/audit-logs?page=${page}&limit=20`);
      setAuditLogs(res.data.data ?? res.data.items ?? res.data);
      setAuditTotal(res.data.total ?? 0);
    } catch { /* ignore */ }
    setAuditLoading(false);
  }, []);

  const fetchBackupHistory = useCallback(async () => {
    setBackupHistoryLoading(true);
    try {
      const res = await api.get('/backup/history');
      setBackupHistory(res.data);
    } catch { /* ignore */ }
    setBackupHistoryLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchHolidays();
    fetchSysInfo();
    fetchBackupHistory();
  }, [fetchSettings, fetchHolidays, fetchSysInfo, fetchBackupHistory]);

  useEffect(() => {
    fetchAuditLogs(auditPage);
  }, [auditPage, fetchAuditLogs]);

  /* ── handlers ── */
  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api.patch('/settings', settings);
      addToast('Ayarlar kaydedildi.', 'success');
    } catch {
      addToast('Ayarlar kaydedilemedi.', 'error');
    }
    setSaving(false);
  };

  const handleAddHoliday = async () => {
    if (!newDate || !newName.trim()) return;
    setAddingHoliday(true);
    try {
      await api.post('/settings/holidays', { date: newDate, name: newName.trim() });
      setNewDate('');
      setNewName('');
      addToast('Tatil günü eklendi.', 'success');
      fetchHolidays();
    } catch {
      addToast('Tatil günü eklenemedi.', 'error');
    }
    setAddingHoliday(false);
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      await api.delete(`/settings/holidays/${id}`);
      addToast('Tatil günü silindi.', 'success');
      fetchHolidays();
    } catch {
      addToast('Tatil günü silinemedi.', 'error');
    }
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await api.get('/settings/backup');
      const json = JSON.stringify(res.data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pdks-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Yedek dosyası indirildi.', 'success');
    } catch {
      addToast('Yedek alınamadı.', 'error');
    }
    setBackupLoading(false);
  };

  const handleDbBackup = async () => {
    setDbBackupLoading(true);
    try {
      await api.post('/backup/trigger');
      addToast('Veritabanı yedekleme başlatıldı.', 'success');
      fetchBackupHistory();
    } catch {
      addToast('Veritabanı yedekleme başlatılamadı.', 'error');
    }
    setDbBackupLoading(false);
  };

  const handleExportAuditCsv = async () => {
    try {
      const res = await api.get('/audit-logs?page=1&limit=10000');
      const logs: AuditLog[] = res.data.data ?? res.data.items ?? res.data;
      const header = 'Tarih,Kullanıcı,İşlem,Hedef,Detay';
      const rows = logs.map(
        (l) =>
          `"${formatDateTime(l.createdAt)}","${l.username}","${l.action}","${l.target}","${(l.detail ?? '').replace(/"/g, '""')}"`
      );
      const csv = [header, ...rows].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Denetim günlüğü dışa aktarıldı.', 'success');
    } catch {
      addToast('Denetim günlüğü dışa aktarılamadı.', 'error');
    }
  };

  const fmtHolidayDate = (d: string) => formatDate(d);

  const auditTotalPages = Math.max(1, Math.ceil(auditTotal / 20));

  /* ── shared styles ── */
  const cardClass =
    'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6';
  const inputClass =
    'rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent';
  const btnPrimary =
    'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#0078d4] text-white hover:bg-[#106eba] transition-colors disabled:opacity-50';
  const thClass =
    'px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider';
  const tdClass = 'px-4 py-3 text-sm text-gray-700 dark:text-gray-300';

  /* ── render ── */
  return (
    <div className="space-y-6">
      {/* ====== Header ====== */}
      <div className={cardClass}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0078d4] flex items-center justify-center">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Ayarlar</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Sistem yapılandırması ve yönetim
            </p>
          </div>
        </div>
      </div>

      {/* ====== Work Hours + Sync (side by side) ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Work Hours */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-[#0078d4]" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Varsayılan Çalışma Saatleri
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 -mt-2">
            Mesai programı atanmamış lokasyonlar bu saatleri kullanır.
            Lokasyonlara özel mesai programları Mesai Programları sayfasından tanımlanabilir.
          </p>
          {settingsLoading ? (
            <div className="flex items-center gap-2 py-8">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              <span className="text-sm text-gray-500">Yükleniyor...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    Mesai Başlangıcı
                  </label>
                  <input
                    type="time"
                    value={settings.workStartTime}
                    onChange={(e) =>
                      setSettings({ ...settings, workStartTime: e.target.value })
                    }
                    className={`${inputClass} w-full`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    Mesai Bitişi
                  </label>
                  <input
                    type="time"
                    value={settings.workEndTime}
                    onChange={(e) =>
                      setSettings({ ...settings, workEndTime: e.target.value })
                    }
                    className={`${inputClass} w-full`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Saat Dilimi
                </label>
                <select
                  value={settings.timezoneOffset}
                  onChange={(e) =>
                    setSettings({ ...settings, timezoneOffset: Number(e.target.value) })
                  }
                  className={`${inputClass} w-full`}
                >
                  {Array.from({ length: 27 }, (_, i) => i - 12).map((offset) => (
                    <option key={offset} value={offset}>
                      UTC{offset >= 0 ? '+' : ''}
                      {offset}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Sync Settings */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="w-5 h-5 text-[#0078d4]" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Senkronizasyon
            </h2>
          </div>
          {settingsLoading ? (
            <div className="flex items-center gap-2 py-8">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              <span className="text-sm text-gray-500">Yükleniyor...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Otomatik Sync Aralığı (saniye)
                </label>
                <input
                  type="number"
                  min={30}
                  max={3600}
                  value={settings.syncInterval}
                  onChange={(e) =>
                    setSettings({ ...settings, syncInterval: Number(e.target.value) })
                  }
                  className={`${inputClass} w-full`}
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  Cihazlardan otomatik veri çekme sıklığı (30 – 3600 saniye)
                </p>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                Sync aralığı değişikliği bir sonraki yeniden başlatmada geçerli olur.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Save Settings Button */}
      {!settingsLoading && (
        <div className="flex justify-end">
          <button onClick={handleSaveSettings} disabled={saving} className={btnPrimary}>
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Ayarları Kaydet
          </button>
        </div>
      )}

      {/* ====== Holidays ====== */}
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-[#0078d4]" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tatil Günleri
          </h2>
        </div>

        {/* Add form */}
        <div className="flex flex-wrap items-end gap-3 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Tarih
            </label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Tatil Adı
            </label>
            <input
              type="text"
              placeholder="Ör: Yılbaşı"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
          <button
            onClick={handleAddHoliday}
            disabled={addingHoliday || !newDate || !newName.trim()}
            className={btnPrimary}
          >
            {addingHoliday ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Ekle
          </button>
        </div>

        {/* Holiday list */}
        {holidaysLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            <span className="text-sm text-gray-500">Yükleniyor...</span>
          </div>
        ) : holidays.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <Calendar className="w-8 h-8 text-gray-300 dark:text-gray-600" />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Tanımlı tatil günü yok
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {holidays.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
              >
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {h.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-3">
                    {fmtHolidayDate(h.date)}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteHoliday(h.id)}
                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ====== System Info ====== */}
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-4">
          <Server className="w-5 h-5 text-[#0078d4]" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Sistem Bilgisi
          </h2>
        </div>

        {sysInfoLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            <span className="text-sm text-gray-500">Yükleniyor...</span>
          </div>
        ) : sysInfo ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              {
                icon: Settings,
                label: 'Versiyon',
                value: `v${APP_VERSION}`,
                color: 'bg-[#0078d4]',
              },
              {
                icon: Database,
                label: 'Veritabanı',
                value: sysInfo.dbStatus === 'connected' ? 'Bağlı' : 'Bağlantı Yok',
                color:
                  sysInfo.dbStatus === 'connected' ? 'bg-emerald-500' : 'bg-red-500',
              },
              {
                icon: Users,
                label: 'Personel',
                value: String(sysInfo.personnelCount),
                color: 'bg-blue-500',
              },
              {
                icon: Cpu,
                label: 'Cihaz',
                value: String(sysInfo.deviceCount),
                color: 'bg-violet-500',
              },
              {
                icon: MapPin,
                label: 'Lokasyon',
                value: String(sysInfo.locationCount),
                color: 'bg-amber-500',
              },
              {
                icon: ClipboardList,
                label: 'Geçiş Kaydı',
                value: Number(sysInfo.accessLogCount).toLocaleString('tr-TR'),
                color: 'bg-teal-500',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl"
                >
                  <div
                    className={`w-10 h-10 rounded-lg ${item.color} flex items-center justify-center`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {item.value}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Bilgi alınamadı.</p>
        )}
      </div>

      {/* ====== Audit Log ====== */}
      <div className={cardClass}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#0078d4]" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Denetim Günlüğü
            </h2>
          </div>
          <button onClick={handleExportAuditCsv} className={btnPrimary}>
            <Download className="w-4 h-4" />
            CSV Dışa Aktar
          </button>
        </div>

        {auditLoading ? (
          <div className="flex items-center gap-2 py-8">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            <span className="text-sm text-gray-500">Yükleniyor...</span>
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <FileText className="w-8 h-8 text-gray-300 dark:text-gray-600" />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Denetim kaydı bulunamadı
            </span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className={thClass}>Tarih</th>
                    <th className={thClass}>Kullanıcı</th>
                    <th className={thClass}>İşlem</th>
                    <th className={thClass}>Hedef</th>
                    <th className={thClass}>Detay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className={`${tdClass} whitespace-nowrap`}>
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className={tdClass}>{log.username}</td>
                      <td className={tdClass}>
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${actionBadge(log.action)}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className={tdClass}>{log.target}</td>
                      <td className={`${tdClass} max-w-xs truncate`}>{log.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Toplam {auditTotal} kayıt &mdash; Sayfa {auditPage} / {auditTotalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                  disabled={auditPage <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Önceki
                </button>
                <button
                  onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
                  disabled={auditPage >= auditTotalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sonraki
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ====== Backup ====== */}
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-4">
          <Download className="w-5 h-5 text-[#0078d4]" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Yedekleme</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Sistem ayarları ve tatil günlerini JSON formatında indirin. Tam veritabanı yedeği
          için sunucu üzerinden <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">pg_dump</code> kullanın.
        </p>
        <button
          onClick={handleBackup}
          disabled={backupLoading}
          className={btnPrimary}
        >
          {backupLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Ayar Yedeğini İndir
        </button>

        {/* Divider */}
        <hr className="my-6 border-gray-200 dark:border-gray-700" />

        {/* Database Backup Sub-section */}
        <div className="flex items-center gap-2 mb-4">
          <HardDrive className="w-5 h-5 text-[#0078d4]" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Veritabanı Yedekleme
          </h3>
        </div>

        <div className="space-y-4 mb-6">
          {/* Backup Enabled Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Otomatik Yedekleme
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Zamanlı otomatik veritabanı yedeklemesini etkinleştir
              </p>
            </div>
            <button
              onClick={() =>
                setSettings((prev) => ({ ...prev, backupEnabled: !prev.backupEnabled }))
              }
              className="text-[#0078d4] hover:opacity-80 transition-opacity"
              aria-label="Toggle backup"
            >
              {settings.backupEnabled ? (
                <ToggleRight className="w-8 h-8" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-gray-400" />
              )}
            </button>
          </div>

          {/* Retention Days */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-0.5">
                Yedek Saklama Süresi (gün)
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Eski yedekler bu süre sonunda otomatik silinir
              </p>
            </div>
            <input
              type="number"
              min={1}
              max={365}
              value={settings.backupRetentionDays}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  backupRetentionDays: Number(e.target.value),
                }))
              }
              className={`${inputClass} w-24 text-center`}
            />
          </div>

          {/* Trigger Backup */}
          <button
            onClick={handleDbBackup}
            disabled={dbBackupLoading}
            className={btnPrimary}
          >
            {dbBackupLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            Şimdi Yedekle
          </button>
        </div>

        {/* Backup History Table */}
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Yedekleme Geçmişi
          </h4>

          {backupHistoryLoading ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              <span className="text-sm text-gray-500">Yükleniyor...</span>
            </div>
          ) : backupHistory.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <HardDrive className="w-8 h-8 text-gray-300 dark:text-gray-600" />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Yedekleme geçmişi bulunamadı
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className={thClass}>Tarih</th>
                    <th className={thClass}>Dosya Adı</th>
                    <th className={thClass}>Boyut</th>
                    <th className={thClass}>Durum</th>
                    <th className={thClass}>İndir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {backupHistory.map((b) => (
                    <tr key={b.filename} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className={`${tdClass} whitespace-nowrap`}>
                        {formatDateTime(b.createdAt)}
                      </td>
                      <td className={`${tdClass} font-mono text-xs`}>{b.filename}</td>
                      <td className={tdClass}>{formatFileSize(b.size)}</td>
                      <td className={tdClass}>
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                            b.status === 'success'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {b.status === 'success' ? 'Başarılı' : 'Başarısız'}
                        </span>
                      </td>
                      <td className={tdClass}>
                        {b.status === 'success' && (
                          <button
                            onClick={() => window.open(`/api/v1/backup/download/${b.filename}`)}
                            className="inline-flex items-center gap-1 text-[#0078d4] hover:text-[#106eba] text-sm font-medium transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            İndir
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ====== Toasts ====== */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${
                t.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
              }`}
            >
              {t.type === 'success' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <X className="w-4 h-4" />
              )}
              {t.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
