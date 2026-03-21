import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle,
  Loader2,
  Server,
  X,
  Mail,
  Send,
  Bell,
  AlertTriangle,
  MessageSquare,
  ToggleLeft,
  ToggleRight,
  ClipboardList,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatDateTimeSec } from '../../utils/date';
import { cardClass, inputClass, btnPrimary, btnOutline, thClass, tdClass } from './styles';

const formatDateTime = (iso: string) => formatDateTimeSec(iso);

interface NotificationSettings {
  msgServiceUrl: string;
  msgServiceApiKey: string;
  msgServiceEnabled: boolean;
  notifyAbsenceEnabled: boolean;
  notifyAbsenceTime: string;
  notifyAbsenceEmailEnabled: boolean;
  notifyAbsenceRecipients: string;
  notifyAbsenceWaEnabled: boolean;
  notifyAbsenceWaRecipients: string;
  notifyHrEnabled: boolean;
  notifyHrTime: string;
  notifyHrEmailEnabled: boolean;
  notifyHrRecipients: string;
  notifyHrWaEnabled: boolean;
  notifyHrWaRecipients: string;
  deviceOfflineThreshold: number;
  notifySystemErrorEnabled: boolean;
  notifySystemErrorEmailEnabled: boolean;
  notifySystemErrorRecipients: string;
  notifySystemErrorWaEnabled: boolean;
  notifySystemErrorWaRecipients: string;
}

interface NotificationLogEntry {
  id: string;
  type: string;
  channel: string;
  recipients: string;
  subject: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export const SettingsBildirimlerPage = () => {
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    msgServiceUrl: '', msgServiceApiKey: '', msgServiceEnabled: false,
    notifyAbsenceEnabled: false, notifyAbsenceTime: '18:00',
    notifyAbsenceEmailEnabled: true, notifyAbsenceRecipients: '',
    notifyAbsenceWaEnabled: false, notifyAbsenceWaRecipients: '',
    notifyHrEnabled: false, notifyHrTime: '18:30',
    notifyHrEmailEnabled: true, notifyHrRecipients: '',
    notifyHrWaEnabled: false, notifyHrWaRecipients: '',
    deviceOfflineThreshold: 4,
    notifySystemErrorEnabled: false,
    notifySystemErrorEmailEnabled: true, notifySystemErrorRecipients: '',
    notifySystemErrorWaEnabled: false, notifySystemErrorWaRecipients: '',
  });
  const [notifSettingsLoading, setNotifSettingsLoading] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);
  const [msgTestLoading, setMsgTestLoading] = useState(false);
  const [msgTestResult, setMsgTestResult] = useState<{ ok: boolean; message: string; data?: any } | null>(null);
  const [msgTestEmailInput, setMsgTestEmailInput] = useState('');
  const [msgTestWaInput, setMsgTestWaInput] = useState('');
  const [msgTestEmailOpen, setMsgTestEmailOpen] = useState(false);
  const [msgTestWaOpen, setMsgTestWaOpen] = useState(false);
  const [msgTestEmailLoading, setMsgTestEmailLoading] = useState(false);
  const [msgTestWaLoading, setMsgTestWaLoading] = useState(false);
  const [notifLogs, setNotifLogs] = useState<NotificationLogEntry[]>([]);
  const [notifLogsLoading, setNotifLogsLoading] = useState(true);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const arr2str = (v: any) => Array.isArray(v) ? v.join(', ') : v ?? '';

  const fetchNotifSettings = useCallback(async () => {
    try {
      const res = await api.get('/settings');
      const d = res.data;
      setNotifSettings({
        msgServiceUrl: d.msgServiceUrl ?? '',
        msgServiceApiKey: d.msgServiceApiKey ?? '',
        msgServiceEnabled: d.msgServiceEnabled ?? false,
        notifyAbsenceEnabled: d.notifyAbsenceEnabled ?? false,
        notifyAbsenceTime: d.notifyAbsenceTime ?? '18:00',
        notifyAbsenceEmailEnabled: d.notifyAbsenceEmailEnabled ?? true,
        notifyAbsenceRecipients: arr2str(d.notifyAbsenceRecipients),
        notifyAbsenceWaEnabled: d.notifyAbsenceWaEnabled ?? false,
        notifyAbsenceWaRecipients: arr2str(d.notifyAbsenceWaRecipients),
        notifyHrEnabled: d.notifyHrEnabled ?? false,
        notifyHrTime: d.notifyHrTime ?? '18:30',
        notifyHrEmailEnabled: d.notifyHrEmailEnabled ?? true,
        notifyHrRecipients: arr2str(d.notifyHrRecipients),
        notifyHrWaEnabled: d.notifyHrWaEnabled ?? false,
        notifyHrWaRecipients: arr2str(d.notifyHrWaRecipients),
        deviceOfflineThreshold: d.deviceOfflineThreshold ?? 4,
        notifySystemErrorEnabled: d.notifySystemErrorEnabled ?? false,
        notifySystemErrorEmailEnabled: d.notifySystemErrorEmailEnabled ?? true,
        notifySystemErrorRecipients: arr2str(d.notifySystemErrorRecipients),
        notifySystemErrorWaEnabled: d.notifySystemErrorWaEnabled ?? false,
        notifySystemErrorWaRecipients: arr2str(d.notifySystemErrorWaRecipients),
      });
    } catch { /* ignore */ }
    setNotifSettingsLoading(false);
  }, []);

  const fetchNotifLogs = useCallback(async () => {
    setNotifLogsLoading(true);
    try {
      const res = await api.get('/email/logs?page=1&limit=20');
      setNotifLogs(res.data.data ?? res.data.items ?? res.data);
    } catch { /* ignore */ }
    setNotifLogsLoading(false);
  }, []);

  useEffect(() => {
    fetchNotifSettings();
    fetchNotifLogs();
  }, [fetchNotifSettings, fetchNotifLogs]);

  const parseRecipients = (val: string): string[] =>
    val.split(',').map((s) => s.trim()).filter(Boolean);

  const handleSaveNotifSettings = async () => {
    setNotifSaving(true);
    try {
      await api.patch('/settings', {
        msgServiceUrl: notifSettings.msgServiceUrl || null,
        msgServiceApiKey: notifSettings.msgServiceApiKey,
        msgServiceEnabled: notifSettings.msgServiceEnabled,
        notifyAbsenceEnabled: notifSettings.notifyAbsenceEnabled,
        notifyAbsenceTime: notifSettings.notifyAbsenceTime,
        notifyAbsenceEmailEnabled: notifSettings.notifyAbsenceEmailEnabled,
        notifyAbsenceRecipients: parseRecipients(notifSettings.notifyAbsenceRecipients),
        notifyAbsenceWaEnabled: notifSettings.notifyAbsenceWaEnabled,
        notifyAbsenceWaRecipients: parseRecipients(notifSettings.notifyAbsenceWaRecipients),
        notifyHrEnabled: notifSettings.notifyHrEnabled,
        notifyHrTime: notifSettings.notifyHrTime,
        notifyHrEmailEnabled: notifSettings.notifyHrEmailEnabled,
        notifyHrRecipients: parseRecipients(notifSettings.notifyHrRecipients),
        notifyHrWaEnabled: notifSettings.notifyHrWaEnabled,
        notifyHrWaRecipients: parseRecipients(notifSettings.notifyHrWaRecipients),
        deviceOfflineThreshold: notifSettings.deviceOfflineThreshold,
        notifySystemErrorEnabled: notifSettings.notifySystemErrorEnabled,
        notifySystemErrorEmailEnabled: notifSettings.notifySystemErrorEmailEnabled,
        notifySystemErrorRecipients: parseRecipients(notifSettings.notifySystemErrorRecipients),
        notifySystemErrorWaEnabled: notifSettings.notifySystemErrorWaEnabled,
        notifySystemErrorWaRecipients: parseRecipients(notifSettings.notifySystemErrorWaRecipients),
      });
      addToast('Bildirim ayarları kaydedildi.', 'success');
      setMsgTestResult(null);
    } catch {
      addToast('Bildirim ayarları kaydedilemedi.', 'error');
    }
    setNotifSaving(false);
  };

  const handleMsgTestConnection = async () => {
    setMsgTestLoading(true);
    setMsgTestResult(null);
    try {
      const res = await api.post('/messaging/test-connection');
      const d = res.data;
      if (d.success) {
        const parts = [`Bağlantı başarılı (v${d.data?.version ?? '?'})`];
        if (d.data?.smtp) parts.push(`SMTP: ${d.data.smtp}`);
        if (d.data?.whatsapp) parts.push(`WhatsApp: ${d.data.whatsapp}`);
        if (d.data?.queue) parts.push(`Kuyruk: ${d.data.queue.pending ?? 0} bekleyen`);
        setMsgTestResult({ ok: true, message: parts.join(' — '), data: d.data });
      } else {
        setMsgTestResult({ ok: false, message: d.error ?? 'Bağlantı başarısız' });
      }
    } catch (err: any) {
      setMsgTestResult({ ok: false, message: err?.response?.data?.message ?? err?.message ?? 'Bağlantı hatası' });
    }
    setMsgTestLoading(false);
  };

  const handleMsgTestEmail = async () => {
    if (!msgTestEmailInput.trim()) return;
    setMsgTestEmailLoading(true);
    try {
      const res = await api.post('/messaging/test-email', { email: msgTestEmailInput.trim() });
      if (res.data.success) {
        addToast('Test e-postası gönderildi (msgService).', 'success');
      } else {
        addToast(res.data.error ?? 'E-posta gönderilemedi.', 'error');
      }
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'E-posta gönderilemedi.', 'error');
    }
    setMsgTestEmailLoading(false);
    setMsgTestEmailOpen(false);
    setMsgTestEmailInput('');
  };

  const handleMsgTestWhatsApp = async () => {
    if (!msgTestWaInput.trim()) return;
    setMsgTestWaLoading(true);
    try {
      const res = await api.post('/messaging/test-whatsapp', { phone: msgTestWaInput.trim() });
      if (res.data.success) {
        addToast('Test WhatsApp mesajı gönderildi.', 'success');
      } else {
        addToast(res.data.error ?? 'WhatsApp mesajı gönderilemedi.', 'error');
      }
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'WhatsApp mesajı gönderilemedi.', 'error');
    }
    setMsgTestWaLoading(false);
    setMsgTestWaOpen(false);
    setMsgTestWaInput('');
  };

  const emailTypeBadge = (type: string) => {
    switch (type) {
      case 'absence_warning':
        return { label: 'Devamsızlık', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
      case 'hr_daily_report':
        return { label: 'İK Raporu', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
      case 'system_error':
        return { label: 'Sistem Hatası', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
      case 'test':
        return { label: 'Test', cls: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' };
      default:
        return { label: type, cls: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' };
    }
  };

  return (
    <div className="space-y-6">
      {/* ====== Mesajlaşma & Bildirimler ====== */}
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-[#0078d4]" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Mesajlaşma & Bildirimler
          </h2>
        </div>

        {notifSettingsLoading ? (
          <div className="flex items-center gap-2 py-8">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            <span className="text-sm text-gray-500">Yükleniyor...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Master toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Mesajlaşma Servisini Etkinleştir</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Merkezi mesajlaşma servisi üzerinden e-posta ve WhatsApp gönderimi</p>
              </div>
              <button onClick={() => setNotifSettings((s) => ({ ...s, msgServiceEnabled: !s.msgServiceEnabled }))} className="text-[#0078d4]">
                {notifSettings.msgServiceEnabled ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10 text-gray-400" />}
              </button>
            </div>

            {/* Connection settings */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Bağlantı Ayarları</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Sunucu URL</label>
                  <input type="text" value={notifSettings.msgServiceUrl} onChange={(e) => setNotifSettings((s) => ({ ...s, msgServiceUrl: e.target.value }))} placeholder="https://msg.mss.local/api" className={`${inputClass} w-full`} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">API Key</label>
                  <input type="password" value={notifSettings.msgServiceApiKey} onChange={(e) => setNotifSettings((s) => ({ ...s, msgServiceApiKey: e.target.value }))} placeholder="pk_pdks_..." className={`${inputClass} w-full`} />
                </div>
              </div>
            </div>

            {/* Test buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={handleMsgTestConnection} disabled={msgTestLoading || !notifSettings.msgServiceUrl} className={btnOutline}>
                {msgTestLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
                Bağlantı Testi
              </button>
              <button onClick={() => setMsgTestEmailOpen(true)} disabled={!notifSettings.msgServiceUrl || !notifSettings.msgServiceApiKey} className={btnOutline}>
                <Mail className="w-4 h-4" />
                Test E-postası
              </button>
              <button onClick={() => setMsgTestWaOpen(true)} disabled={!notifSettings.msgServiceUrl || !notifSettings.msgServiceApiKey} className={btnOutline}>
                <MessageSquare className="w-4 h-4" />
                Test WhatsApp
              </button>
            </div>

            {/* Test email input */}
            {msgTestEmailOpen && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <input type="email" value={msgTestEmailInput} onChange={(e) => setMsgTestEmailInput(e.target.value)} placeholder="E-posta adresi girin" className={`flex-1 ${inputClass}`} onKeyDown={(e) => e.key === 'Enter' && handleMsgTestEmail()} />
                <button onClick={handleMsgTestEmail} disabled={msgTestEmailLoading || !msgTestEmailInput.trim()} className={btnPrimary}>
                  {msgTestEmailLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Gönder
                </button>
                <button onClick={() => { setMsgTestEmailOpen(false); setMsgTestEmailInput(''); }} className="p-1.5 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>
            )}

            {/* Test WhatsApp input */}
            {msgTestWaOpen && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <input type="text" value={msgTestWaInput} onChange={(e) => setMsgTestWaInput(e.target.value)} placeholder="Telefon numarası (ör: 905321234567)" className={`flex-1 ${inputClass}`} onKeyDown={(e) => e.key === 'Enter' && handleMsgTestWhatsApp()} />
                <button onClick={handleMsgTestWhatsApp} disabled={msgTestWaLoading || !msgTestWaInput.trim()} className={btnPrimary}>
                  {msgTestWaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Gönder
                </button>
                <button onClick={() => { setMsgTestWaOpen(false); setMsgTestWaInput(''); }} className="p-1.5 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>
            )}

            {/* Test result */}
            {msgTestResult && (
              <div className={`p-3 rounded-lg flex items-start gap-2 ${msgTestResult.ok ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                {msgTestResult.ok ? <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />}
                <span className={`text-sm ${msgTestResult.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>{msgTestResult.message}</span>
              </div>
            )}

            {/* Divider */}
            <hr className="border-gray-200 dark:border-gray-700" />

            {/* Notification Types */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Bildirim Türleri</h3>
              <div className="space-y-4">

                {/* Absence Warning */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Devamsızlık Uyarısı</span>
                    </div>
                    <button onClick={() => setNotifSettings((s) => ({ ...s, notifyAbsenceEnabled: !s.notifyAbsenceEnabled }))} className="text-[#0078d4]">
                      {notifSettings.notifyAbsenceEnabled ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7 text-gray-400" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Gün sonunda kart basmayan personele devamsızlık uyarısı gönderir</p>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Gönderim Saati</label>
                    <input type="time" value={notifSettings.notifyAbsenceTime} onChange={(e) => setNotifSettings((s) => ({ ...s, notifyAbsenceTime: e.target.value }))} className={`${inputClass} w-32`} />
                  </div>
                  {/* Email channel */}
                  <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <button onClick={() => setNotifSettings((s) => ({ ...s, notifyAbsenceEmailEnabled: !s.notifyAbsenceEmailEnabled }))} className="mt-0.5">
                      {notifSettings.notifyAbsenceEmailEnabled ? <ToggleRight className="w-6 h-6 text-[#0078d4]" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-1"><Mail className="w-3.5 h-3.5 text-blue-500" /><span className="text-xs font-medium text-gray-700 dark:text-gray-300">E-posta</span></div>
                      <input type="text" placeholder="hr@example.com, manager@example.com" value={notifSettings.notifyAbsenceRecipients} onChange={(e) => setNotifSettings((s) => ({ ...s, notifyAbsenceRecipients: e.target.value }))} className={`${inputClass} w-full`} />
                    </div>
                  </div>
                  {/* WhatsApp channel */}
                  <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <button onClick={() => setNotifSettings((s) => ({ ...s, notifyAbsenceWaEnabled: !s.notifyAbsenceWaEnabled }))} className="mt-0.5">
                      {notifSettings.notifyAbsenceWaEnabled ? <ToggleRight className="w-6 h-6 text-[#0078d4]" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-1"><MessageSquare className="w-3.5 h-3.5 text-green-500" /><span className="text-xs font-medium text-gray-700 dark:text-gray-300">WhatsApp</span></div>
                      <input type="text" placeholder="905321234567, 905329876543" value={notifSettings.notifyAbsenceWaRecipients} onChange={(e) => setNotifSettings((s) => ({ ...s, notifyAbsenceWaRecipients: e.target.value }))} className={`${inputClass} w-full`} />
                    </div>
                  </div>
                </div>

                {/* HR Daily Report */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">İK Günlük Rapor</span>
                    </div>
                    <button onClick={() => setNotifSettings((s) => ({ ...s, notifyHrEnabled: !s.notifyHrEnabled }))} className="text-[#0078d4]">
                      {notifSettings.notifyHrEnabled ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7 text-gray-400" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Gün sonunda İK'ya devamsızlık özet raporu gönderir</p>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Gönderim Saati</label>
                    <input type="time" value={notifSettings.notifyHrTime} onChange={(e) => setNotifSettings((s) => ({ ...s, notifyHrTime: e.target.value }))} className={`${inputClass} w-32`} />
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <button onClick={() => setNotifSettings((s) => ({ ...s, notifyHrEmailEnabled: !s.notifyHrEmailEnabled }))} className="mt-0.5">
                      {notifSettings.notifyHrEmailEnabled ? <ToggleRight className="w-6 h-6 text-[#0078d4]" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-1"><Mail className="w-3.5 h-3.5 text-blue-500" /><span className="text-xs font-medium text-gray-700 dark:text-gray-300">E-posta</span></div>
                      <input type="text" placeholder="hr@example.com" value={notifSettings.notifyHrRecipients} onChange={(e) => setNotifSettings((s) => ({ ...s, notifyHrRecipients: e.target.value }))} className={`${inputClass} w-full`} />
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <button onClick={() => setNotifSettings((s) => ({ ...s, notifyHrWaEnabled: !s.notifyHrWaEnabled }))} className="mt-0.5">
                      {notifSettings.notifyHrWaEnabled ? <ToggleRight className="w-6 h-6 text-[#0078d4]" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-1"><MessageSquare className="w-3.5 h-3.5 text-green-500" /><span className="text-xs font-medium text-gray-700 dark:text-gray-300">WhatsApp</span></div>
                      <input type="text" placeholder="905321234567" value={notifSettings.notifyHrWaRecipients} onChange={(e) => setNotifSettings((s) => ({ ...s, notifyHrWaRecipients: e.target.value }))} className={`${inputClass} w-full`} />
                    </div>
                  </div>
                </div>

                {/* System Error */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Sistem Hatası Bildirimi</span>
                    </div>
                    <button onClick={() => setNotifSettings((s) => ({ ...s, notifySystemErrorEnabled: !s.notifySystemErrorEnabled }))} className="text-[#0078d4]">
                      {notifSettings.notifySystemErrorEnabled ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7 text-gray-400" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Cihaz bağlantı kopması veya senkronizasyon hatası olduğunda bildirim gönderir</p>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">Ardışık hata eşiği:</label>
                    <input
                      type="number" min={1} max={20}
                      value={notifSettings.deviceOfflineThreshold}
                      onChange={(e) => setNotifSettings((s) => ({ ...s, deviceOfflineThreshold: Math.max(1, parseInt(e.target.value) || 1) }))}
                      className={`${inputClass} w-20`}
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">senkronizasyon</span>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <button onClick={() => setNotifSettings((s) => ({ ...s, notifySystemErrorEmailEnabled: !s.notifySystemErrorEmailEnabled }))} className="mt-0.5">
                      {notifSettings.notifySystemErrorEmailEnabled ? <ToggleRight className="w-6 h-6 text-[#0078d4]" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-1"><Mail className="w-3.5 h-3.5 text-blue-500" /><span className="text-xs font-medium text-gray-700 dark:text-gray-300">E-posta</span></div>
                      <input type="text" placeholder="admin@example.com, it@example.com" value={notifSettings.notifySystemErrorRecipients} onChange={(e) => setNotifSettings((s) => ({ ...s, notifySystemErrorRecipients: e.target.value }))} className={`${inputClass} w-full`} />
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <button onClick={() => setNotifSettings((s) => ({ ...s, notifySystemErrorWaEnabled: !s.notifySystemErrorWaEnabled }))} className="mt-0.5">
                      {notifSettings.notifySystemErrorWaEnabled ? <ToggleRight className="w-6 h-6 text-[#0078d4]" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-1"><MessageSquare className="w-3.5 h-3.5 text-green-500" /><span className="text-xs font-medium text-gray-700 dark:text-gray-300">WhatsApp</span></div>
                      <input type="text" placeholder="905321234567" value={notifSettings.notifySystemErrorWaRecipients} onChange={(e) => setNotifSettings((s) => ({ ...s, notifySystemErrorWaRecipients: e.target.value }))} className={`${inputClass} w-full`} />
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Save button */}
            <div className="flex justify-end">
              <button onClick={handleSaveNotifSettings} disabled={notifSaving} className={btnPrimary}>
                {notifSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Bildirim Ayarlarını Kaydet
              </button>
            </div>

            {/* Divider */}
            <hr className="border-gray-200 dark:border-gray-700" />

            {/* Notification Log */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Bildirim Geçmişi</h3>
              {notifLogsLoading ? (
                <div className="flex items-center gap-2 py-4"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /><span className="text-sm text-gray-500">Yükleniyor...</span></div>
              ) : notifLogs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6">
                  <Bell className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Henüz bildirim gönderimi yapılmadı</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className={thClass}>Tarih</th>
                        <th className={thClass}>Tür</th>
                        <th className={thClass}>Kanal</th>
                        <th className={thClass}>Alıcı</th>
                        <th className={thClass}>Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {notifLogs.map((log) => {
                        const badge = emailTypeBadge(log.type);
                        const chBadge = log.channel === 'whatsapp'
                          ? { label: 'WhatsApp', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
                          : { label: 'E-posta', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
                        return (
                          <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className={`${tdClass} whitespace-nowrap`}>{formatDateTime(log.createdAt)}</td>
                            <td className={tdClass}><span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${badge.cls}`}>{badge.label}</span></td>
                            <td className={tdClass}><span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${chBadge.cls}`}>{chBadge.label}</span></td>
                            <td className={`${tdClass} max-w-[200px] truncate`}>{log.recipients}</td>
                            <td className={tdClass}>
                              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${log.status === 'sent' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                {log.status === 'sent' ? 'Gönderildi' : 'Başarısız'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
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
