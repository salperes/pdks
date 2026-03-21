import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Download,
  CheckCircle,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatDateTimeSec } from '../../utils/date';
import { cardClass, btnPrimary, thClass, tdClass } from '../Settings/styles';

const formatDateTime = (iso: string) => formatDateTimeSec(iso);

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

interface AuditLog {
  id: string;
  createdAt: string;
  username: string;
  action: string;
  target: string;
  detail: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export const DenetimGunluguPage = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(true);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
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

  useEffect(() => {
    fetchAuditLogs(auditPage);
  }, [auditPage, fetchAuditLogs]);

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

  const auditTotalPages = Math.max(1, Math.ceil(auditTotal / 20));

  return (
    <div className="space-y-6">
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
