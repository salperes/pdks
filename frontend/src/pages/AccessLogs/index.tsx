import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ClipboardList,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  X,
  AlertTriangle,
  Search,
  Download,
  Clock,
  Users,
  Trash2,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { formatDateTime, formatTime } from '../../utils/date';
import type { AccessLog, Device, Location, PaginatedResponse } from '../../types';

const AUTO_REFRESH_INTERVAL = 30_000;

type ViewMode = 'all' | 'paired' | 'unknown';

interface Filters {
  locationId: string;
  deviceId: string;
  direction: string;
  startDate: string;
  endDate: string;
  search: string;
}

const emptyFilters: Filters = {
  locationId: '',
  deviceId: '',
  direction: '',
  startDate: '',
  endDate: '',
  search: '',
};

interface PairedEntry {
  personnelId: string;
  personnelName: string;
  department: string;
  firstIn: string | null;
  lastOut: string | null;
  durationMinutes: number | null;
  totalEvents: number;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const DirectionBadge = ({ direction }: { direction?: 'in' | 'out' }) => {
  if (direction === 'in') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
        <ArrowDownLeft className="w-3 h-3" />
        GİRİŞ
      </span>
    );
  }
  if (direction === 'out') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
        <ArrowUpRight className="w-3 h-3" />
        ÇIKIŞ
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
      -
    </span>
  );
};

const formatDuration = (minutes: number | null) => {
  if (minutes == null) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
};

const formatTimeNullable = (iso: string | null) => {
  if (!iso) return '-';
  return formatTime(iso);
};

export const AccessLogsPage = () => {
  // Auth
  const { user } = useAuthStore();

  // Data state
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  // Paired view
  const [pairs, setPairs] = useState<PairedEntry[]>([]);
  const [pairedDate, setPairedDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Filter options
  const [locations, setLocations] = useState<Location[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);
  const [exporting, setExporting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  // Bulk delete state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const showBulkActions = viewMode === 'all' && user?.role === 'admin';

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  };

  // Clear selection on page change, view mode change, or filter change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, viewMode, appliedFilters]);

  // ---- Bulk delete handlers ----
  const toggleSelectAll = () => {
    if (selectedIds.size === logs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(logs.map((log) => log.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const count = selectedIds.size;
      await api.delete('/access-logs/bulk', { data: { ids: Array.from(selectedIds) } });
      showToast(`${count} kayıt silindi`);
      setSelectedIds(new Set());
      setBulkDeleteConfirm(false);
      fetchLogs();
    } catch {
      showToast('Toplu silme başarısız', 'error');
    } finally {
      setBulkDeleting(false);
    }
  };

  // ---- Fetch filter options ----
  useEffect(() => {
    api.get('/locations').then((r) => {
      const data = Array.isArray(r.data) ? r.data : r.data.data ?? [];
      setLocations(data);
    }).catch(() => {});

    api.get('/devices').then((r) => {
      const data = Array.isArray(r.data) ? r.data : r.data.data ?? [];
      setDevices(data);
    }).catch(() => {});
  }, []);

  // ---- Fetch logs ----
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      if (viewMode === 'unknown') {
        const res = await api.get<PaginatedResponse<AccessLog>>('/access-logs/unknown', {
          params: { page, limit },
        });
        const body = res.data;
        setLogs(body.data);
        setTotal(body.total);
        setTotalPages((body as any).totalPages ?? Math.ceil(body.total / body.limit));
      } else if (viewMode === 'paired') {
        const res = await api.get('/access-logs/paired', {
          params: { date: pairedDate },
        });
        setPairs(res.data.pairs ?? []);
      } else {
        const params: Record<string, string | number> = { page, limit };
        if (appliedFilters.locationId) params.locationId = appliedFilters.locationId;
        if (appliedFilters.deviceId) params.deviceId = appliedFilters.deviceId;
        if (appliedFilters.direction) params.direction = appliedFilters.direction;
        if (appliedFilters.startDate) params.startDate = appliedFilters.startDate;
        if (appliedFilters.endDate) params.endDate = appliedFilters.endDate;
        if (appliedFilters.search) params.search = appliedFilters.search;

        const res = await api.get<PaginatedResponse<AccessLog>>('/access-logs', { params });
        const body = res.data;
        setLogs(body.data);
        setTotal(body.total);
        setTotalPages((body as any).totalPages ?? Math.ceil(body.total / body.limit));
      }
    } catch {
      setLogs([]);
      setPairs([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, limit, viewMode, appliedFilters, pairedDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ---- Auto-refresh every 30 seconds ----
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLogs();
    }, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  // ---- CSV Export ----
  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, string> = {};
      if (appliedFilters.locationId) params.locationId = appliedFilters.locationId;
      if (appliedFilters.deviceId) params.deviceId = appliedFilters.deviceId;
      if (appliedFilters.direction) params.direction = appliedFilters.direction;
      if (appliedFilters.startDate) params.startDate = appliedFilters.startDate;
      if (appliedFilters.endDate) params.endDate = appliedFilters.endDate;
      if (appliedFilters.search) params.search = appliedFilters.search;

      const res = await api.get('/access-logs/export', { params });
      const data: AccessLog[] = res.data;

      if (data.length === 0) {
        showToast('Dışa aktarılacak kayıt bulunamadı', 'error');
        return;
      }

      // CSV header
      const header = ['Personel;Kart No;Departman;Cihaz;Lokasyon;Tarih/Saat;Yön'];
      const rows = data.map((log) => {
        const name = log.personnel
          ? `${log.personnel.firstName} ${log.personnel.lastName}`
          : 'Tanımsız';
        const card = log.personnel?.cardNumber || '';
        const dept = log.personnel?.department || '';
        const device = log.device?.name || '';
        const loc = log.location?.name || '';
        const time = formatDateTime(log.eventTime);
        const dir = log.direction === 'in' ? 'Giriş' : log.direction === 'out' ? 'Çıkış' : '';
        return `${name};${card};${dept};${device};${loc};${time};${dir}`;
      });

      const bom = '\uFEFF';
      const csv = bom + [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `gecis-kayitlari-${dateStr}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      showToast(`${data.length} kayıt dışa aktarıldı`);
    } catch {
      showToast('Dışa aktarma başarısız', 'error');
    } finally {
      setExporting(false);
    }
  };

  // ---- Paired CSV export ----
  const handleExportPaired = () => {
    if (pairs.length === 0) {
      showToast('Dışa aktarılacak kayıt yok', 'error');
      return;
    }
    const header = ['Personel;Departman;İlk Giriş;Son Çıkış;Süre;Toplam Geçiş'];
    const rows = pairs.map((p) => {
      const fi = formatTimeNullable(p.firstIn);
      const lo = formatTimeNullable(p.lastOut);
      const dur = formatDuration(p.durationMinutes);
      return `${p.personnelName};${p.department};${fi};${lo};${dur};${p.totalEvents}`;
    });
    const bom = '\uFEFF';
    const csv = bom + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eslestirme-${pairedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${pairs.length} eşleştirme dışa aktarıldı`);
  };

  // ---- Handlers ----
  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    setPage(1);
  };

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters });
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setAppliedFilters((prev) => ({ ...prev, search: filters.search }));
      setPage(1);
    }
  };

  const hasActiveFilters =
    appliedFilters.locationId ||
    appliedFilters.deviceId ||
    appliedFilters.direction ||
    appliedFilters.startDate ||
    appliedFilters.endDate ||
    appliedFilters.search;

  const getPersonnelDisplay = (log: AccessLog) => {
    if (log.personnel) {
      return `${log.personnel.firstName} ${log.personnel.lastName}`;
    }
    const deviceUserId = (log as any).deviceUserId;
    if (deviceUserId != null) {
      return `Tanımsız - Kart #${deviceUserId}`;
    }
    return 'Tanımsız';
  };

  const tabClass = (mode: ViewMode) =>
    `inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      viewMode === mode
        ? 'bg-[#0078d4] text-white'
        : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
    }`;

  const colCount = showBulkActions ? 6 : 5;

  // ---- Render ----
  return (
    <div className="space-y-6">
      {/* Toast */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${
                t.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* Bulk Delete Confirm Modal */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Toplu Silme Onayı
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Bu işlem geri alınamaz
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
              Seçilen <strong>{selectedIds.size}</strong> kayıt kalıcı olarak silinecektir. Devam etmek istiyor musunuz?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setBulkDeleteConfirm(false)}
                disabled={bulkDeleting}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                İptal
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {bulkDeleting ? 'Siliniyor...' : 'Sil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== Top Bar ====== */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#0078d4] flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Geçiş Kayıtları
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {viewMode === 'unknown'
                    ? 'Eşleşmeyen personel geçiş kayıtları'
                    : viewMode === 'paired'
                    ? 'Giriş-çıkış eşleştirme görünümü'
                    : 'Tüm personel geçiş kayıtları'}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {viewMode === 'all' && (
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {exporting ? 'Aktarılıyor...' : 'CSV İndir'}
                </button>
              )}
              {viewMode === 'paired' && (
                <button
                  onClick={handleExportPaired}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  CSV İndir
                </button>
              )}
            </div>
          </div>

          {/* View tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => handleViewChange('all')} className={tabClass('all')}>
              <ClipboardList className="w-4 h-4" />
              Tüm Kayıtlar
            </button>
            <button onClick={() => handleViewChange('paired')} className={tabClass('paired')}>
              <Users className="w-4 h-4" />
              Eşleştirme
            </button>
            <button onClick={() => handleViewChange('unknown')} className={tabClass('unknown')}>
              <AlertTriangle className="w-4 h-4" />
              Tanımsız
            </button>

            {/* Search (only for 'all' mode) */}
            {viewMode === 'all' && (
              <>
                <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-1 hidden sm:block" />
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Personel, kart no, sicil no..."
                    value={filters.search}
                    onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                    onKeyDown={handleSearchKeyDown}
                    className="pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent w-64"
                  />
                </div>
                <button
                  onClick={() => setFiltersOpen((v) => !v)}
                  className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    hasActiveFilters
                      ? 'border-[#0078d4] bg-blue-50 text-[#0078d4] dark:bg-blue-900/20 dark:border-blue-500 dark:text-blue-400'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filtrele
                </button>
              </>
            )}

            {/* Paired date picker */}
            {viewMode === 'paired' && (
              <>
                <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-1 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={pairedDate}
                    onChange={(e) => setPairedDate(e.target.value)}
                    className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ====== Filter Bar (collapsible, only in 'all' mode) ====== */}
      {filtersOpen && viewMode === 'all' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Location */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Lokasyon
              </label>
              <select
                value={filters.locationId}
                onChange={(e) => setFilters((f) => ({ ...f, locationId: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent"
              >
                <option value="">Tüm Lokasyonlar</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Device */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Cihaz
              </label>
              <select
                value={filters.deviceId}
                onChange={(e) => setFilters((f) => ({ ...f, deviceId: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent"
              >
                <option value="">Tüm Cihazlar</option>
                {devices.map((dev) => (
                  <option key={dev.id} value={dev.id}>
                    {dev.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Direction */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Yön
              </label>
              <select
                value={filters.direction}
                onChange={(e) => setFilters((f) => ({ ...f, direction: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent"
              >
                <option value="">Tüm Yönler</option>
                <option value="in">Giriş</option>
                <option value="out">Çıkış</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Başlangıç Tarihi
                </span>
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Bitiş Tarihi
                </span>
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleApplyFilters}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#0078d4] text-white hover:bg-[#106eba] transition-colors"
            >
              <Filter className="w-4 h-4" />
              Filtrele
            </button>
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-4 h-4" />
              Temizle
            </button>
          </div>
        </div>
      )}

      {/* ====== Bulk Selection Bar ====== */}
      {showBulkActions && selectedIds.size > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl shadow-sm border border-red-200 dark:border-red-800 px-6 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-red-700 dark:text-red-400">
            {selectedIds.size} kayıt seçili
          </span>
          <button
            onClick={() => setBulkDeleteConfirm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Seçilenleri Sil
          </button>
        </div>
      )}

      {/* ====== Paired View Table ====== */}
      {viewMode === 'paired' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Personel
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Departman
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    İlk Giriş
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Son Çıkış
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Süre
                  </th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Geçiş
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-600 border-t-[#0078d4] rounded-full animate-spin" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Eşleştirmeler yükleniyor...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : pairs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Users className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Bu tarih için eşleştirme bulunamadı
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pairs.map((p) => (
                    <tr
                      key={p.personnelId}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {p.personnelName}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {p.department || '-'}
                      </td>
                      <td className="px-6 py-3 text-sm whitespace-nowrap">
                        {p.firstIn ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <ArrowDownLeft className="w-3 h-3" />
                            {formatTime(p.firstIn)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm whitespace-nowrap">
                        {p.lastOut ? (
                          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                            <ArrowUpRight className="w-3 h-3" />
                            {formatTime(p.lastOut)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm whitespace-nowrap">
                        {p.durationMinutes != null ? (
                          <span className="inline-flex items-center gap-1 text-gray-700 dark:text-gray-300">
                            <Clock className="w-3 h-3" />
                            {formatDuration(p.durationMinutes)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold">
                          {p.totalEvents}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paired footer */}
          {!loading && pairs.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Toplam {pairs.length} personel
              </span>
            </div>
          )}
        </div>
      )}

      {/* ====== Standard Table (all / unknown) ====== */}
      {viewMode !== 'paired' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  {showBulkActions && (
                    <th className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={logs.length > 0 && selectedIds.size === logs.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-[#0078d4] focus:ring-[#0078d4] cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Personel
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Cihaz
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Lokasyon
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Zaman
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Yön
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={colCount} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-600 border-t-[#0078d4] rounded-full animate-spin" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Kayıtlar yükleniyor...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <ClipboardList className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {viewMode === 'unknown'
                            ? 'Tanımsız geçiş kaydı bulunamadı'
                            : 'Geçiş kaydı bulunamadı'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                        selectedIds.has(log.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                      }`}
                    >
                      {showBulkActions && (
                        <td className="w-12 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(log.id)}
                            onChange={() => toggleSelectOne(log.id)}
                            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-[#0078d4] focus:ring-[#0078d4] cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="px-6 py-3">
                        <span
                          className={`text-sm font-medium ${
                            log.personnel
                              ? 'text-gray-900 dark:text-white'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {getPersonnelDisplay(log)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {log.device?.name ?? '-'}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {log.location?.name ?? '-'}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {formatDateTime(log.eventTime)}
                      </td>
                      <td className="px-6 py-3">
                        <DirectionBadge direction={log.direction} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ====== Pagination ====== */}
          {!loading && logs.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Sayfa {page} / {totalPages}{' '}
                <span className="text-gray-400 dark:text-gray-500">
                  (toplam {total.toLocaleString('tr-TR')} kayıt)
                </span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Önceki
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Sonraki
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
