import { useEffect, useState, useCallback } from 'react';
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
} from 'lucide-react';
import { api } from '../../services/api';
import type { AccessLog, Device, Location, PaginatedResponse } from '../../types';

const AUTO_REFRESH_INTERVAL = 30_000;

interface Filters {
  locationId: string;
  deviceId: string;
  direction: string;
  startDate: string;
  endDate: string;
}

const emptyFilters: Filters = {
  locationId: '',
  deviceId: '',
  direction: '',
  startDate: '',
  endDate: '',
};

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

export const AccessLogsPage = () => {
  // Data state
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  // Filter options
  const [locations, setLocations] = useState<Location[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [showUnknown, setShowUnknown] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);

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
      if (showUnknown) {
        const res = await api.get<PaginatedResponse<AccessLog>>('/access-logs/unknown', {
          params: { page, limit },
        });
        const body = res.data;
        setLogs(body.data);
        setTotal(body.total);
        setTotalPages((body as any).totalPages ?? Math.ceil(body.total / body.limit));
      } else {
        const params: Record<string, string | number> = { page, limit };
        if (appliedFilters.locationId) params.locationId = appliedFilters.locationId;
        if (appliedFilters.deviceId) params.deviceId = appliedFilters.deviceId;
        if (appliedFilters.direction) params.direction = appliedFilters.direction;
        if (appliedFilters.startDate) params.startDate = appliedFilters.startDate;
        if (appliedFilters.endDate) params.endDate = appliedFilters.endDate;

        const res = await api.get<PaginatedResponse<AccessLog>>('/access-logs', { params });
        const body = res.data;
        setLogs(body.data);
        setTotal(body.total);
        setTotalPages((body as any).totalPages ?? Math.ceil(body.total / body.limit));
      }
    } catch {
      setLogs([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, limit, showUnknown, appliedFilters]);

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

  // ---- Handlers ----
  const handleToggleView = () => {
    setShowUnknown((prev) => !prev);
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

  const hasActiveFilters =
    appliedFilters.locationId ||
    appliedFilters.deviceId ||
    appliedFilters.direction ||
    appliedFilters.startDate ||
    appliedFilters.endDate;

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('tr-TR')} ${d.toLocaleTimeString('tr-TR')}`;
  };

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

  // ---- Render ----
  return (
    <div className="space-y-6">
      {/* ====== Top Bar ====== */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
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
                {showUnknown
                  ? 'Eşleşmeyen personel geçiş kayıtları'
                  : 'Tüm personel geçiş kayıtları'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleView}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                showUnknown
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:hover:bg-amber-900/60'
                  : 'bg-[#0078d4] text-white hover:bg-[#106eba]'
              }`}
            >
              {showUnknown ? (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Tanımsız Geçişler
                </>
              ) : (
                <>
                  <ClipboardList className="w-4 h-4" />
                  Tüm Kayıtlar
                </>
              )}
            </button>

            {!showUnknown && (
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  hasActiveFilters
                    ? 'border-[#0078d4] bg-blue-50 text-[#0078d4] dark:bg-blue-900/20 dark:border-blue-500 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filtrele
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ====== Filter Bar (collapsible) ====== */}
      {filtersOpen && !showUnknown && (
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

      {/* ====== Data Table ====== */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
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
                  <td colSpan={5} className="px-6 py-16 text-center">
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
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <ClipboardList className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {showUnknown
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
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
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
    </div>
  );
};
