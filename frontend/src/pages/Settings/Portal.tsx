import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Globe,
  CheckCircle,
  Loader2,
  Server,
  X,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatDateTimeSec } from '../../utils/date';
import { cardClass, inputClass, btnPrimary, btnOutline } from './styles';

const formatDateTime = (iso: string) => formatDateTimeSec(iso);

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export const SettingsPortalPage = () => {
  const [portalSettings, setPortalSettings] = useState({ portalApiUrl: '', portalApiKey: '', portalSyncEnabled: false });
  const [portalStatus, setPortalStatus] = useState<{ lastSync: string | null; lastSyncCount: number | null } | null>(null);
  const [portalSettingsLoading, setPortalSettingsLoading] = useState(true);
  const [portalSaving, setPortalSaving] = useState(false);
  const [portalTestLoading, setPortalTestLoading] = useState(false);
  const [portalSyncLoading, setPortalSyncLoading] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const fetchPortalSettings = useCallback(async () => {
    try {
      const [settingsRes, statusRes] = await Promise.all([
        api.get('/settings'),
        api.get('/portal-sync/status'),
      ]);
      const d = settingsRes.data;
      setPortalSettings({
        portalApiUrl: d.portalApiUrl ?? '',
        portalApiKey: d.portalApiKey ?? '',
        portalSyncEnabled: d.portalSyncEnabled ?? false,
      });
      setPortalStatus(statusRes.data);
    } catch { /* ignore */ }
    setPortalSettingsLoading(false);
  }, []);

  useEffect(() => {
    fetchPortalSettings();
  }, [fetchPortalSettings]);

  const handleSavePortalSettings = async () => {
    setPortalSaving(true);
    try {
      await api.patch('/settings', {
        portalApiUrl: portalSettings.portalApiUrl || null,
        portalApiKey: portalSettings.portalApiKey,
        portalSyncEnabled: portalSettings.portalSyncEnabled,
      });
      addToast('Portal ayarları kaydedildi.', 'success');
    } catch {
      addToast('Portal ayarları kaydedilemedi.', 'error');
    }
    setPortalSaving(false);
  };

  const handlePortalTest = async () => {
    setPortalTestLoading(true);
    try {
      const res = await api.post('/portal-sync/test');
      if (res.data.success) {
        addToast(`Bağlantı başarılı — ${res.data.userCount} kullanıcı bulundu.`, 'success');
      } else {
        addToast(res.data.error ?? 'Bağlantı başarısız.', 'error');
      }
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Bağlantı hatası.', 'error');
    }
    setPortalTestLoading(false);
  };

  const handlePortalSync = async () => {
    setPortalSyncLoading(true);
    try {
      const res = await api.post('/portal-sync/sync');
      if (res.data.error) {
        addToast(res.data.error, 'error');
      } else {
        addToast(`Senkronizasyon tamamlandı — ${res.data.created} yeni, ${res.data.updated} güncellendi.`, 'success');
        const statusRes = await api.get('/portal-sync/status');
        setPortalStatus(statusRes.data);
      }
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Senkronizasyon hatası.', 'error');
    }
    setPortalSyncLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* ====== Portal Entegrasyonu ====== */}
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-[#0078d4]" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Portal Entegrasyonu
          </h2>
        </div>

        {portalSettingsLoading ? (
          <div className="flex items-center gap-2 py-8">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            <span className="text-sm text-gray-500">Yükleniyor...</span>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Master toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">MSS Personeli Senkronizasyonu</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Portal'dan personeli günde 4 kez otomatik çeker (00:00 / 06:00 / 12:00 / 18:00)</p>
              </div>
              <button onClick={() => setPortalSettings((s) => ({ ...s, portalSyncEnabled: !s.portalSyncEnabled }))} className="text-[#0078d4]">
                {portalSettings.portalSyncEnabled ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10 text-gray-400" />}
              </button>
            </div>

            {/* Connection settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Portal URL</label>
                <input
                  type="text"
                  value={portalSettings.portalApiUrl}
                  onChange={(e) => setPortalSettings((s) => ({ ...s, portalApiUrl: e.target.value }))}
                  placeholder="http://192.168.88.111"
                  className={`${inputClass} w-full`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">API Key</label>
                <input
                  type="password"
                  value={portalSettings.portalApiKey}
                  onChange={(e) => setPortalSettings((s) => ({ ...s, portalApiKey: e.target.value }))}
                  placeholder="pk_..."
                  className={`${inputClass} w-full`}
                />
              </div>
            </div>

            {/* Son senkronizasyon bilgisi */}
            {portalStatus && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {portalStatus.lastSync ? (
                  <>Son senkronizasyon: <span className="font-medium text-gray-700 dark:text-gray-300">{formatDateTime(portalStatus.lastSync)}</span>
                  {portalStatus.lastSyncCount != null && <span> ({portalStatus.lastSyncCount} kayıt)</span>}</>
                ) : (
                  <span>Henüz senkronizasyon yapılmadı.</span>
                )}
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={handleSavePortalSettings} disabled={portalSaving} className={btnPrimary}>
                {portalSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Kaydet
              </button>
              <button onClick={handlePortalTest} disabled={portalTestLoading || !portalSettings.portalApiUrl} className={btnOutline}>
                {portalTestLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
                Bağlantı Testi
              </button>
              <button onClick={handlePortalSync} disabled={portalSyncLoading || !portalSettings.portalApiUrl || !portalSettings.portalApiKey} className={btnOutline}>
                {portalSyncLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Şimdi Senkronize Et
              </button>
            </div>
          </div>
        )}
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
