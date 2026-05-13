import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Settings,
  CheckCircle,
  Loader2,
  Server,
  X,
  Download,
  Database,
  Users,
  Cpu,
  MapPin,
  ClipboardList,
  HardDrive,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatDateTimeSec } from '../../utils/date';
import { APP_VERSION } from '../../version';
import { cardClass, inputClass, btnPrimary, thClass, tdClass } from './styles';

const formatDateTime = (iso: string) => formatDateTimeSec(iso);

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface SettingsData {
  workStartTime: string;
  workEndTime: string;
  timezoneOffset: number;
  syncInterval: number;
  backupEnabled: boolean;
  backupRetentionDays: number;
}

interface SystemInfo {
  personnelCount: number;
  deviceCount: number;
  locationCount: number;
  accessLogCount: number;
  dbStatus: string;
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

export const SettingsSistemPage = () => {
  const [settings, setSettings] = useState<SettingsData>({
    workStartTime: '08:00',
    workEndTime: '17:00',
    timezoneOffset: 3,
    syncInterval: 120,
    backupEnabled: false,
    backupRetentionDays: 30,
  });
  const [settingsLoading, setSettingsLoading] = useState(true);

  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [sysInfoLoading, setSysInfoLoading] = useState(true);

  const [backupLoading, setBackupLoading] = useState(false);
  const [backupHistory, setBackupHistory] = useState<BackupRecord[]>([]);
  const [backupHistoryLoading, setBackupHistoryLoading] = useState(true);
  const [dbBackupLoading, setDbBackupLoading] = useState(false);

  const [resetDevices, setResetDevices] = useState<{ id: string; name: string }[]>([]);
  const [resetDeviceId, setResetDeviceId] = useState('');
  const [resetting, setResetting] = useState(false);

  const [tsScanning, setTsScanning] = useState(false);
  const [tsDeleting, setTsDeleting] = useState(false);
  const [tsScanResult, setTsScanResult] = useState<{
    scanned: number;
    perDevice: Array<{ deviceName: string | null; count: number }>;
  } | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

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

  const fetchSysInfo = useCallback(async () => {
    try {
      const res = await api.get('/settings/system-info');
      setSysInfo(res.data);
    } catch { /* ignore */ }
    setSysInfoLoading(false);
  }, []);

  const fetchBackupHistory = useCallback(async () => {
    setBackupHistoryLoading(true);
    try {
      const res = await api.get('/backup/history');
      setBackupHistory(res.data);
    } catch { /* ignore */ }
    setBackupHistoryLoading(false);
  }, []);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await api.get('/devices');
      const list = (Array.isArray(res.data) ? res.data : []).map((d: any) => ({
        id: d.id,
        name: d.name,
      }));
      setResetDevices(list);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchSysInfo();
    fetchBackupHistory();
    fetchDevices();
  }, [fetchSettings, fetchSysInfo, fetchBackupHistory, fetchDevices]);

  const handleScanInvalidTs = async () => {
    setTsScanning(true);
    try {
      const res = await api.post('/access-logs/cleanup-invalid-timestamps', { dryRun: true });
      const r = res.data ?? {};
      setTsScanResult({ scanned: r.scanned ?? 0, perDevice: r.perDevice ?? [] });
      if (r.scanned === 0) {
        addToast('Bozuk timestamp\'li kayıt bulunamadı.', 'success');
      } else {
        addToast(`${r.scanned} bozuk kayıt bulundu (silmek için "Sil" butonu).`, 'success');
      }
    } catch (err: any) {
      addToast(
        `Tarama başarısız: ${err?.response?.data?.message ?? 'hata'}`,
        'error',
      );
    } finally {
      setTsScanning(false);
    }
  };

  const handleDeleteInvalidTs = async () => {
    if (!tsScanResult || tsScanResult.scanned === 0) {
      addToast('Önce "Tara" ile etkilenecek kayıt sayısını görün.', 'error');
      return;
    }
    if (!confirm(
      `${tsScanResult.scanned} adet bozuk timestamp'li kayıt silinecek (geri alınamaz).\n\n` +
      `Bu kayıtlar cihaz saati hatalıyken oluştuğu için raporlarda günlere yanlış dağılıyor.\n\nDevam edilsin mi?`,
    )) return;

    setTsDeleting(true);
    try {
      const res = await api.post('/access-logs/cleanup-invalid-timestamps', { dryRun: false });
      const r = res.data ?? {};
      addToast(`${r.deleted ?? 0} bozuk kayıt silindi.`, 'success');
      setTsScanResult({ scanned: 0, perDevice: [] });
    } catch (err: any) {
      addToast(
        `Silme başarısız: ${err?.response?.data?.message ?? 'hata'}`,
        'error',
      );
    } finally {
      setTsDeleting(false);
    }
  };

  const runFactoryReset = async (mode: 'reload' | 'wipe') => {
    const device = resetDevices.find((d) => d.id === resetDeviceId);
    if (!device) {
      addToast('Önce bir cihaz seçin.', 'error');
      return;
    }

    const tailMsg =
      mode === 'reload'
        ? `silinecek, ardından PDKS'teki atamalar sıfırdan yüklenecek`
        : `silinecek (cihaz boş kalacak; PDKS push yapılmayacak)`;
    if (!confirm(
      `"${device.name}" cihazındaki TÜM kullanıcı kayıtları ve geçiş logları ` +
      `${tailMsg}. Bu işlem geri alınamaz.\n\nDevam edilsin mi?`,
    )) return;

    const typed = prompt(
      `Onaylamak için cihaz adını AYNEN yazın:\n\n${device.name}`,
    );
    if (typed !== device.name) {
      addToast('Cihaz adı eşleşmedi, işlem iptal edildi.', 'error');
      return;
    }

    setResetting(true);
    try {
      const url =
        mode === 'reload'
          ? `/device-comm/factory-reset/${device.id}`
          : `/device-comm/factory-reset/${device.id}/wipe`;
      const res = await api.post(url);
      const r = res.data ?? {};
      if (!r.reachable) {
        addToast(`${device.name}: Cihaza erişilemedi.`, 'error');
      } else {
        const summary =
          mode === 'reload'
            ? `${r.syncedLogs ?? 0} log alındı, ${r.cleared ?? 0} kullanıcı silindi, ` +
              `${r.pushed ?? 0} kullanıcı yüklendi` +
              (r.failed ? `, ${r.failed} hata` : '')
            : `${r.syncedLogs ?? 0} log alındı, ${r.cleared ?? 0} kullanıcı silindi, ` +
              `cihaz boş` +
              (r.failed ? `, ${r.failed} hata` : '');
        addToast(`${device.name}: ${summary}`, r.failed ? 'error' : 'success');
      }
    } catch (err: any) {
      addToast(
        `Cihaz sıfırlama başarısız: ${err?.response?.data?.message ?? 'hata'}`,
        'error',
      );
    } finally {
      setResetting(false);
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

  const handleSaveBackupSettings = async () => {
    try {
      await api.patch('/settings', {
        backupEnabled: settings.backupEnabled,
        backupRetentionDays: settings.backupRetentionDays,
      });
      addToast('Yedekleme ayarları kaydedildi.', 'success');
    } catch {
      addToast('Yedekleme ayarları kaydedilemedi.', 'error');
    }
  };

  return (
    <div className="space-y-6">
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

          {/* Save backup settings + Trigger Backup */}
          <div className="flex flex-wrap items-center gap-3">
            {!settingsLoading && (
              <button
                onClick={handleSaveBackupSettings}
                className={btnPrimary}
              >
                <CheckCircle className="w-4 h-4" />
                Ayarları Kaydet
              </button>
            )}
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

      {/* ====== Bozuk Timestamp Temizliği ====== */}
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Bozuk Timestamp Temizliği
          </h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Cihaz saati hatalıyken (sıfırlanmış / ileri atmış dönemlerde) DB'ye kaydedilmiş
          geçiş loglarını tespit eder ve siler. Kapsam: <strong>1 saatten fazla gelecek</strong>
          {' '}veya <strong>7 yıldan eski</strong> kayıtlar. Bu kayıtlar raporlarda
          günlere yanlış dağılıp toplamları bozar.
        </p>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <button
            type="button"
            onClick={handleScanInvalidTs}
            disabled={tsScanning || tsDeleting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {tsScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            {tsScanning ? 'Taranıyor...' : 'Tara'}
          </button>
          <button
            type="button"
            onClick={handleDeleteInvalidTs}
            disabled={!tsScanResult || tsScanResult.scanned === 0 || tsDeleting || tsScanning}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {tsDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            {tsDeleting ? 'Siliniyor...' : `Sil${tsScanResult && tsScanResult.scanned > 0 ? ` (${tsScanResult.scanned})` : ''}`}
          </button>
        </div>
        {tsScanResult && tsScanResult.perDevice.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-2">
              Tespit edilen bozuk kayıtlar (cihaz bazında):
            </p>
            <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
              {tsScanResult.perDevice.map((d, i) => (
                <li key={i}>
                  <strong>{d.deviceName ?? '(silinmiş cihaz)'}:</strong> {d.count} kayıt
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ====== Cihaz Sıfırla ====== */}
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Cihaz Sıfırla
          </h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Seçili cihazdaki <strong>tüm kullanıcı kayıtları ve geçiş logları silinir</strong>.
          Silmeden önce cihazdaki güncel loglar PDKS'e çekilir, veri kaybı yaşanmaz.
        </p>
        <ul className="text-xs text-gray-500 dark:text-gray-400 mb-4 space-y-1 list-disc pl-5">
          <li>
            <strong>Sıfırla & Yükle:</strong> sıfırladıktan sonra PDKS'teki atamalar
            cihaza yeniden yüklenir (yeni kurulum / ZKAccess kalıntı temizliği).
          </li>
          <li>
            <strong>Sadece Sıfırla:</strong> cihazı boş bırakır (PDKS push yok).
            DB atamaları "pending" durumuna düşer, sonra <em>Eşitle</em>
            butonuyla manuel yüklenebilir.
          </li>
        </ul>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Cihaz
            </label>
            <select
              value={resetDeviceId}
              onChange={(e) => setResetDeviceId(e.target.value)}
              className={inputClass}
              disabled={resetting}
              title="Sıfırlanacak cihaz"
              aria-label="Sıfırlanacak cihaz"
            >
              <option value="">Cihaz seçiniz...</option>
              {resetDevices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => runFactoryReset('reload')}
            disabled={!resetDeviceId || resetting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resetting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            {resetting ? 'İşleniyor...' : 'Sıfırla & Yükle'}
          </button>
          <button
            type="button"
            onClick={() => runFactoryReset('wipe')}
            disabled={!resetDeviceId || resetting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resetting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            {resetting ? 'İşleniyor...' : 'Sadece Sıfırla'}
          </button>
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
