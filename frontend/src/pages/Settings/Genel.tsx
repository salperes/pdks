import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, RefreshCw, CheckCircle, Loader2, X } from 'lucide-react';
import { api } from '../../services/api';
import { cardClass, inputClass, btnPrimary } from './styles';

interface SettingsData {
  workStartTime: string;
  workEndTime: string;
  timezoneOffset: number;
  syncInterval: number;
  backupEnabled: boolean;
  backupRetentionDays: number;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export const SettingsGenelPage = () => {
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

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

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

  return (
    <div className="space-y-6">
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
