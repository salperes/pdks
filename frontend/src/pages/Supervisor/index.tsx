import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  ShieldCheck,
  Search,
  Plus,
  MapPin,
  Trash2,
  X,
  RefreshCw,
  Cpu,
  Users,
  ChevronDown,
  CheckSquare,
  Square,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatDate } from '../../utils/date';
import type { Device, Location } from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MatrixPersonnel {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
  employeeId: string;
  cardNumber: string;
}

interface MatrixDevice {
  id: string;
  name: string;
  locationName: string;
}

interface MatrixAssignment {
  personnelId: string;
  deviceId: string;
  status: string;
}

interface MatrixData {
  personnel: MatrixPersonnel[];
  devices: MatrixDevice[];
  assignments: MatrixAssignment[];
}

interface Assignment {
  id: string;
  personnelId: string;
  personnelName: string;
  deviceId: string;
  deviceName: string;
  locationName: string;
  status: string;
  enrolledAt: string;
  errorMessage?: string;
}

interface AssignResult {
  deviceId: string;
  deviceName: string;
  success: boolean;
  error?: string;
}

interface BulkPersonnelResult {
  personnelId: string;
  personnelName: string;
  results: AssignResult[];
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

// ---------------------------------------------------------------------------
// Toast component
// ---------------------------------------------------------------------------

const ToastContainer = ({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) => (
  <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
    {toasts.map((t) => (
      <div
        key={t.id}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${
          t.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}
      >
        <span className="flex-1">{t.message}</span>
        <button onClick={() => onDismiss(t.id)} className="hover:opacity-80">
          <X className="w-4 h-4" />
        </button>
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// Status Badge helper
// ---------------------------------------------------------------------------

const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    enrolled: {
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      text: 'text-emerald-700 dark:text-emerald-400',
      label: 'Tanımlı',
    },
    failed: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-400',
      label: 'Başarısız',
    },
    pending: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-700 dark:text-yellow-400',
      label: 'Bekliyor',
    },
  };
  const c = config[status] ?? config.pending;
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export const SupervisorPage = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState<'personnel' | 'matrix'>('personnel');

  // Data
  const [matrix, setMatrix] = useState<MatrixData | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Personnel tab state — single select (click row)
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | null>(null);
  const [personnelSearch, setPersonnelSearch] = useState('');
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  // Multi-select (checkboxes)
  const [checkedPersonnelIds, setCheckedPersonnelIds] = useState<Set<string>>(new Set());

  // Modal state
  const [addDeviceModalOpen, setAddDeviceModalOpen] = useState(false);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  // Location assign dropdown (single)
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  const [assigningLocation, setAssigningLocation] = useState(false);
  const locationDropdownRef = useRef<HTMLDivElement>(null);

  // Bulk location assign dropdown
  const [bulkLocationDropdownOpen, setBulkLocationDropdownOpen] = useState(false);
  const [bulkAssigningLocation, setBulkAssigningLocation] = useState(false);
  const bulkLocationDropdownRef = useRef<HTMLDivElement>(null);

  // Unassign loading
  const [unassigningIds, setUnassigningIds] = useState<Set<string>>(new Set());

  // Matrix cell loading
  const [matrixBusy, setMatrixBusy] = useState<Set<string>>(new Set());

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  // ----------------------------------
  // Helpers
  // ----------------------------------

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Is the right panel in bulk mode?
  const isBulkMode = checkedPersonnelIds.size >= 2;

  // ----------------------------------
  // Data fetching
  // ----------------------------------

  const fetchMatrix = useCallback(async () => {
    try {
      const res = await api.get('/supervisor/matrix');
      setMatrix(res.data);
    } catch {
      addToast('Matris verileri yüklenirken hata oluştu.', 'error');
    }
  }, [addToast]);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await api.get('/devices');
      setDevices(Array.isArray(res.data) ? res.data : res.data.data ?? []);
    } catch {
      /* silently ignore */
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await api.get('/locations');
      setLocations(Array.isArray(res.data) ? res.data : res.data.data ?? []);
    } catch {
      /* silently ignore */
    }
  }, []);

  const fetchAssignments = useCallback(
    async (personnelId: string) => {
      setAssignmentsLoading(true);
      try {
        const res = await api.get(`/supervisor/assignments?personnelId=${personnelId}`);
        setAssignments(Array.isArray(res.data) ? res.data : []);
      } catch {
        addToast('Atamalar yüklenirken hata oluştu.', 'error');
        setAssignments([]);
      } finally {
        setAssignmentsLoading(false);
      }
    },
    [addToast],
  );

  useEffect(() => {
    Promise.all([fetchMatrix(), fetchDevices(), fetchLocations()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch assignments when single personnel selected (and not bulk mode)
  useEffect(() => {
    if (selectedPersonnelId && !isBulkMode) {
      fetchAssignments(selectedPersonnelId);
    } else if (!selectedPersonnelId) {
      setAssignments([]);
    }
  }, [selectedPersonnelId, isBulkMode, fetchAssignments]);

  // Close location dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(e.target as Node)) {
        setLocationDropdownOpen(false);
      }
      if (bulkLocationDropdownRef.current && !bulkLocationDropdownRef.current.contains(e.target as Node)) {
        setBulkLocationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ----------------------------------
  // Derived data
  // ----------------------------------

  const selectedPersonnel = useMemo(
    () => matrix?.personnel.find((p) => p.id === selectedPersonnelId) ?? null,
    [matrix, selectedPersonnelId],
  );

  const filteredPersonnel = useMemo(() => {
    if (!matrix) return [];
    const q = personnelSearch.toLowerCase().trim();
    if (!q) return matrix.personnel;
    return matrix.personnel.filter(
      (p) =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        (p.department ?? '').toLowerCase().includes(q) ||
        (p.cardNumber ?? '').toLowerCase().includes(q),
    );
  }, [matrix, personnelSearch]);

  // For each personnel in the list, count their assigned devices
  const personnelDeviceCount = useMemo(() => {
    const map = new Map<string, number>();
    if (!matrix) return map;
    for (const a of matrix.assignments) {
      map.set(a.personnelId, (map.get(a.personnelId) ?? 0) + 1);
    }
    return map;
  }, [matrix]);

  // Devices grouped by location for the "add device" modal
  const devicesGroupedByLocation = useMemo(() => {
    const groups = new Map<string, { locationName: string; devices: Device[] }>();
    for (const d of devices) {
      const locName = d.location?.name ?? locations.find((l) => l.id === d.locationId)?.name ?? 'Lokasyonsuz';
      if (!groups.has(locName)) {
        groups.set(locName, { locationName: locName, devices: [] });
      }
      groups.get(locName)!.devices.push(d);
    }
    return Array.from(groups.values()).sort((a, b) => a.locationName.localeCompare(b.locationName));
  }, [devices, locations]);

  // Already assigned device IDs for selected personnel (single mode only)
  const assignedDeviceIds = useMemo(() => {
    const s = new Set<string>();
    for (const a of assignments) {
      s.add(a.deviceId);
    }
    return s;
  }, [assignments]);

  // "Tümünü Seç" state
  const allFilteredChecked = filteredPersonnel.length > 0 && filteredPersonnel.every((p) => checkedPersonnelIds.has(p.id));

  // ----------------------------------
  // Multi-select helpers
  // ----------------------------------

  const togglePersonnelCheck = (id: string) => {
    setCheckedPersonnelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allFilteredChecked) {
      // Uncheck all filtered
      setCheckedPersonnelIds((prev) => {
        const next = new Set(prev);
        for (const p of filteredPersonnel) {
          next.delete(p.id);
        }
        return next;
      });
    } else {
      // Check all filtered
      setCheckedPersonnelIds((prev) => {
        const next = new Set(prev);
        for (const p of filteredPersonnel) {
          next.add(p.id);
        }
        return next;
      });
    }
  };

  const clearChecked = () => {
    setCheckedPersonnelIds(new Set());
  };

  // ----------------------------------
  // Single: Assign devices
  // ----------------------------------

  const openAddDeviceModal = () => {
    setSelectedDeviceIds(new Set());
    setAddDeviceModalOpen(true);
  };

  const toggleDeviceSelection = (deviceId: string) => {
    setSelectedDeviceIds((prev) => {
      const next = new Set(prev);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  };

  const handleAssignDevices = async () => {
    if (selectedDeviceIds.size === 0) return;

    setAssigning(true);
    try {
      if (isBulkMode) {
        // Bulk assign
        const res = await api.post('/supervisor/bulk-assign', {
          personnelIds: Array.from(checkedPersonnelIds),
          deviceIds: Array.from(selectedDeviceIds),
        });
        const bulkResults: BulkPersonnelResult[] = Array.isArray(res.data) ? res.data : [];
        let totalOk = 0;
        let totalFail = 0;
        for (const br of bulkResults) {
          totalOk += br.results.filter((r) => r.success).length;
          totalFail += br.results.filter((r) => !r.success).length;
        }
        if (totalOk > 0) addToast(`${checkedPersonnelIds.size} personel için ${totalOk} atama başarılı.`, 'success');
        if (totalFail > 0) addToast(`${totalFail} atama başarısız.`, 'error');
      } else if (selectedPersonnelId) {
        // Single assign
        const res = await api.post('/supervisor/assign', {
          personnelId: selectedPersonnelId,
          deviceIds: Array.from(selectedDeviceIds),
        });
        const results: AssignResult[] = res.data?.results ?? [];
        const ok = results.filter((r) => r.success).length;
        const fail = results.filter((r) => !r.success).length;
        if (ok > 0) addToast(`${ok} cihaza başarıyla atandı.`, 'success');
        if (fail > 0) addToast(`${fail} cihaza atama başarısız.`, 'error');
      }

      setAddDeviceModalOpen(false);
      await fetchMatrix();
      if (selectedPersonnelId && !isBulkMode) {
        await fetchAssignments(selectedPersonnelId);
      }
    } catch {
      addToast('İşlem sırasında hata oluştu.', 'error');
    } finally {
      setAssigning(false);
    }
  };

  // ----------------------------------
  // Single: Assign by location
  // ----------------------------------

  const handleAssignLocation = async (locationId: string) => {
    if (!selectedPersonnelId) return;
    setAssigningLocation(true);
    setLocationDropdownOpen(false);
    try {
      const res = await api.post('/supervisor/assign-location', {
        personnelId: selectedPersonnelId,
        locationId,
      });
      const results: AssignResult[] = res.data?.results ?? [];
      const ok = results.filter((r) => r.success).length;
      const fail = results.filter((r) => !r.success).length;
      if (ok > 0) addToast(`Lokasyondaki ${ok} cihaza başarıyla atandı.`, 'success');
      if (fail > 0) addToast(`${fail} cihaza atama başarısız.`, 'error');
      await Promise.all([fetchAssignments(selectedPersonnelId), fetchMatrix()]);
    } catch {
      addToast('Lokasyon atama sırasında hata oluştu.', 'error');
    } finally {
      setAssigningLocation(false);
    }
  };

  // ----------------------------------
  // Bulk: Assign by location
  // ----------------------------------

  const handleBulkAssignLocation = async (locationId: string) => {
    if (checkedPersonnelIds.size === 0) return;
    setBulkAssigningLocation(true);
    setBulkLocationDropdownOpen(false);
    try {
      const res = await api.post('/supervisor/bulk-assign-location', {
        personnelIds: Array.from(checkedPersonnelIds),
        locationId,
      });
      const bulkResults: BulkPersonnelResult[] = Array.isArray(res.data) ? res.data : [];
      let totalOk = 0;
      let totalFail = 0;
      for (const br of bulkResults) {
        totalOk += br.results.filter((r) => r.success).length;
        totalFail += br.results.filter((r) => !r.success).length;
      }
      if (totalOk > 0) addToast(`${checkedPersonnelIds.size} personel için ${totalOk} atama başarılı.`, 'success');
      if (totalFail > 0) addToast(`${totalFail} atama başarısız.`, 'error');
      await fetchMatrix();
    } catch {
      addToast('Toplu lokasyon atama sırasında hata oluştu.', 'error');
    } finally {
      setBulkAssigningLocation(false);
    }
  };

  // ----------------------------------
  // Single: Unassign device
  // ----------------------------------

  const handleUnassign = async (deviceId: string) => {
    if (!selectedPersonnelId) return;
    setUnassigningIds((prev) => new Set(prev).add(deviceId));
    try {
      const res = await api.post('/supervisor/unassign', {
        personnelId: selectedPersonnelId,
        deviceIds: [deviceId],
      });
      const results: AssignResult[] = res.data?.results ?? [];
      if (results[0]?.success) {
        addToast(`${results[0].deviceName} cihazından kaldırıldı.`, 'success');
      } else {
        addToast(`Kaldırma başarısız: ${results[0]?.error ?? 'Bilinmeyen hata'}`, 'error');
      }
      await Promise.all([fetchAssignments(selectedPersonnelId), fetchMatrix()]);
    } catch {
      addToast('Kaldırma işlemi sırasında hata oluştu.', 'error');
    } finally {
      setUnassigningIds((prev) => {
        const next = new Set(prev);
        next.delete(deviceId);
        return next;
      });
    }
  };

  // ----------------------------------
  // Matrix Tab: Toggle cell
  // ----------------------------------

  const matrixCellKey = (pId: string, dId: string) => `${pId}:${dId}`;

  const getMatrixStatus = (personnelId: string, deviceId: string): string | null => {
    if (!matrix) return null;
    const a = matrix.assignments.find((x) => x.personnelId === personnelId && x.deviceId === deviceId);
    return a?.status ?? null;
  };

  const handleMatrixCellClick = async (personnelId: string, deviceId: string) => {
    const key = matrixCellKey(personnelId, deviceId);
    if (matrixBusy.has(key)) return;

    const currentStatus = getMatrixStatus(personnelId, deviceId);

    setMatrixBusy((prev) => new Set(prev).add(key));
    try {
      if (currentStatus === 'enrolled' || currentStatus === 'pending') {
        const res = await api.post('/supervisor/unassign', {
          personnelId,
          deviceIds: [deviceId],
        });
        const results: AssignResult[] = res.data?.results ?? [];
        if (results[0]?.success) {
          addToast(`${results[0].deviceName}: Kaldırıldı.`, 'success');
        } else {
          addToast(`Kaldırma başarısız: ${results[0]?.error ?? ''}`, 'error');
        }
      } else {
        const res = await api.post('/supervisor/assign', {
          personnelId,
          deviceIds: [deviceId],
        });
        const results: AssignResult[] = res.data?.results ?? [];
        if (results[0]?.success) {
          addToast(`${results[0].deviceName}: Atandı.`, 'success');
        } else {
          addToast(`Atama başarısız: ${results[0]?.error ?? ''}`, 'error');
        }
      }
      await fetchMatrix();
      if (personnelId === selectedPersonnelId) {
        await fetchAssignments(personnelId);
      }
    } catch {
      addToast('İşlem sırasında hata oluştu.', 'error');
    } finally {
      setMatrixBusy((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // ----------------------------------
  // Matrix dot color helper
  // ----------------------------------

  const matrixDotClass = (status: string | null): string => {
    switch (status) {
      case 'enrolled':
        return 'bg-emerald-500';
      case 'failed':
        return 'bg-red-500';
      case 'pending':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-300 dark:bg-gray-600';
    }
  };

  const matrixDotTitle = (status: string | null): string => {
    switch (status) {
      case 'enrolled':
        return 'Tanımlı - Tıklayın kaldırmak için';
      case 'failed':
        return 'Başarısız - Tıklayın tekrar denemek için';
      case 'pending':
        return 'Bekliyor - Tıklayın kaldırmak için';
      default:
        return 'Tanımsız - Tıklayın atamak için';
    }
  };

  // ----------------------------------
  // Checked personnel names for bulk display
  // ----------------------------------

  const checkedPersonnelNames = useMemo(() => {
    if (!matrix) return [];
    return matrix.personnel
      .filter((p) => checkedPersonnelIds.has(p.id))
      .map((p) => `${p.firstName} ${p.lastName}`);
  }, [matrix, checkedPersonnelIds]);

  // ----------------------------------
  // Render
  // ----------------------------------

  return (
    <div className="space-y-6">
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Top bar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-[#0078d4] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Erişim Yönetimi
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Personel-cihaz erişim atamalarını yönetin
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              Promise.all([fetchMatrix(), fetchDevices(), fetchLocations()]).finally(() =>
                setLoading(false),
              );
              if (selectedPersonnelId && !isBulkMode) fetchAssignments(selectedPersonnelId);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('personnel')}
            className={`flex-1 text-sm font-medium px-4 py-2 rounded-md transition-colors ${
              activeTab === 'personnel'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Personel Bazlı
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex-1 text-sm font-medium px-4 py-2 rounded-md transition-colors ${
              activeTab === 'matrix'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Matris Görünümü
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
          <span className="ml-3 text-gray-500 dark:text-gray-400 text-sm">Yükleniyor...</span>
        </div>
      ) : activeTab === 'personnel' ? (
        /* ================================================================
           TAB 1: Personel Bazlı
           ================================================================ */
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left Panel - Personnel List */}
          <div className="w-full lg:w-1/3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm flex flex-col overflow-hidden"
               style={{ maxHeight: 'calc(100vh - 260px)' }}
          >
            {/* Search + Tümünü Seç */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Personel ara..."
                  value={personnelSearch}
                  onChange={(e) => setPersonnelSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0078d4] focus:border-transparent outline-none"
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {filteredPersonnel.length} personel
                  {checkedPersonnelIds.size > 0 && (
                    <span className="text-[#0078d4] font-medium ml-1">
                      ({checkedPersonnelIds.size} seçili)
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  {checkedPersonnelIds.size > 0 && (
                    <button
                      onClick={clearChecked}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      Temizle
                    </button>
                  )}
                  <button
                    onClick={toggleSelectAll}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#0078d4] hover:text-[#106eba] transition-colors"
                  >
                    {allFilteredChecked ? (
                      <CheckSquare className="w-3.5 h-3.5" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                    Tümünü Seç
                  </button>
                </div>
              </div>
            </div>

            {/* Personnel list */}
            <div className="flex-1 overflow-y-auto">
              {filteredPersonnel.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Personel bulunamadı.</p>
                </div>
              ) : (
                filteredPersonnel.map((p) => {
                  const isSelected = selectedPersonnelId === p.id && !isBulkMode;
                  const isChecked = checkedPersonnelIds.has(p.id);
                  const deviceCount = personnelDeviceCount.get(p.id) ?? 0;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 px-2 py-2.5 border-b border-gray-100 dark:border-gray-700/50 transition-colors ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-[#0078d4]'
                          : isChecked
                          ? 'bg-blue-50/50 dark:bg-blue-900/10 border-l-4 border-l-[#0078d4]/50'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/30 border-l-4 border-l-transparent'
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePersonnelCheck(p.id);
                        }}
                        className="shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-[#0078d4]" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>

                      {/* Personnel info — click to select for individual view */}
                      <button
                        onClick={() => {
                          if (!isBulkMode) {
                            setSelectedPersonnelId(isSelected ? null : p.id);
                          }
                        }}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className={`text-sm font-medium truncate ${isSelected ? 'text-[#0078d4]' : 'text-gray-900 dark:text-white'}`}>
                              {p.firstName} {p.lastName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                              {p.department || 'Departman yok'}
                            </p>
                            {p.cardNumber && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                                Kart: {p.cardNumber}
                              </p>
                            )}
                          </div>
                          <span
                            className={`inline-flex items-center justify-center text-xs font-semibold rounded-full w-6 h-6 shrink-0 ${
                              deviceCount > 0
                                ? 'bg-[#0078d4] text-white'
                                : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {deviceCount}
                          </span>
                        </div>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel */}
          <div className="w-full lg:w-2/3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm flex flex-col overflow-hidden"
               style={{ maxHeight: 'calc(100vh - 260px)' }}
          >
            {isBulkMode ? (
              /* ============ BULK MODE ============ */
              <>
                {/* Bulk header */}
                <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {checkedPersonnelIds.size} Personel Seçildi
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        Toplu atama işlemi yapılacak
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Bulk location assign */}
                      <div className="relative" ref={bulkLocationDropdownRef}>
                        <button
                          onClick={() => setBulkLocationDropdownOpen((prev) => !prev)}
                          disabled={bulkAssigningLocation}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          <MapPin className="w-4 h-4" />
                          {bulkAssigningLocation ? 'Atanıyor...' : 'Lokasyona Ata'}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {bulkLocationDropdownOpen && (
                          <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-30 max-h-60 overflow-y-auto">
                            {locations.length === 0 ? (
                              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                Lokasyon bulunamadı
                              </div>
                            ) : (
                              locations.map((loc) => (
                                <button
                                  key={loc.id}
                                  onClick={() => handleBulkAssignLocation(loc.id)}
                                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700/50 last:border-b-0"
                                >
                                  <span className="font-medium">{loc.name}</span>
                                  {loc.devicesCount != null && (
                                    <span className="ml-2 text-xs text-gray-400">
                                      ({loc.devicesCount} cihaz)
                                    </span>
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* Bulk add device */}
                      <button
                        onClick={openAddDeviceModal}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0078d4] hover:bg-[#106eba] text-white text-sm font-medium transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Cihaz Ekle
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bulk personnel list */}
                <div className="flex-1 overflow-y-auto p-5">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                    Seçili Personeller
                  </p>
                  <div className="space-y-2">
                    {checkedPersonnelNames.map((name, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700"
                      >
                        <Users className="w-4 h-4 text-[#0078d4] shrink-0" />
                        <span className="text-sm text-gray-900 dark:text-white">{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : !selectedPersonnel ? (
              /* ============ EMPTY STATE ============ */
              <div className="flex-1 flex items-center justify-center p-12">
                <div className="text-center">
                  <ShieldCheck className="w-16 h-16 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Personel Seçin
                  </h3>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Sol panelden bir personel seçerek erişim atamalarını görüntüleyin
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    veya checkbox ile birden fazla personel seçip toplu atama yapın
                  </p>
                </div>
              </div>
            ) : (
              /* ============ SINGLE MODE ============ */
              <>
                {/* Header */}
                <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {selectedPersonnel.firstName} {selectedPersonnel.lastName}
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {selectedPersonnel.department || 'Departman yok'}
                        {selectedPersonnel.employeeId && (
                          <span className="ml-2 font-mono text-xs">
                            (Sicil: {selectedPersonnel.employeeId})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Assign by location */}
                      <div className="relative" ref={locationDropdownRef}>
                        <button
                          onClick={() => setLocationDropdownOpen((prev) => !prev)}
                          disabled={assigningLocation}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          <MapPin className="w-4 h-4" />
                          Lokasyona Ata
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {locationDropdownOpen && (
                          <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-30 max-h-60 overflow-y-auto">
                            {locations.length === 0 ? (
                              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                Lokasyon bulunamadı
                              </div>
                            ) : (
                              locations.map((loc) => (
                                <button
                                  key={loc.id}
                                  onClick={() => handleAssignLocation(loc.id)}
                                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700/50 last:border-b-0"
                                >
                                  <span className="font-medium">{loc.name}</span>
                                  {loc.devicesCount != null && (
                                    <span className="ml-2 text-xs text-gray-400">
                                      ({loc.devicesCount} cihaz)
                                    </span>
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* Add device button */}
                      <button
                        onClick={openAddDeviceModal}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0078d4] hover:bg-[#106eba] text-white text-sm font-medium transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Cihaz Ekle
                      </button>
                    </div>
                  </div>
                </div>

                {/* Assignment list */}
                <div className="flex-1 overflow-y-auto">
                  {assignmentsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
                      <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                        Yükleniyor...
                      </span>
                    </div>
                  ) : assignments.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-12">
                      <div className="text-center">
                        <Cpu className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                          Henüz cihaz ataması yok
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          &quot;Cihaz Ekle&quot; veya &quot;Lokasyona Ata&quot; butonlarıyla atama yapın
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                      {assignments.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Cpu className="w-5 h-5 text-[#0078d4] shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {a.deviceName}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {a.locationName || 'Lokasyon yok'}
                                </span>
                                {a.enrolledAt && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500">
                                    {formatDate(a.enrolledAt)}
                                  </span>
                                )}
                              </div>
                              {a.errorMessage && (
                                <p className="text-xs text-red-500 mt-0.5 truncate">
                                  {a.errorMessage}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <StatusBadge status={a.status} />
                            <button
                              onClick={() => handleUnassign(a.deviceId)}
                              disabled={unassigningIds.has(a.deviceId)}
                              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                              title="Kaldır"
                            >
                              {unassigningIds.has(a.deviceId) ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              Kaldır
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* ================================================================
           TAB 2: Matris Görünümü
           ================================================================ */
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
          {!matrix || matrix.personnel.length === 0 || matrix.devices.length === 0 ? (
            <div className="p-12 text-center">
              <ShieldCheck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                Matris görünümü için personel ve cihaz verisi gereklidir.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900">
                    <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-900 text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 min-w-[200px]">
                      Personel
                    </th>
                    {matrix.devices.map((d) => (
                      <th
                        key={d.id}
                        className="text-center px-3 py-3 border-b border-gray-200 dark:border-gray-700 min-w-[100px]"
                      >
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
                          {d.name}
                        </div>
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                          {d.locationName || '-'}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {matrix.personnel.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                      <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-4 py-2.5 border-r border-gray-200 dark:border-gray-700">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {p.firstName} {p.lastName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {p.department || '-'}
                        </div>
                      </td>
                      {matrix.devices.map((d) => {
                        const status = getMatrixStatus(p.id, d.id);
                        const key = matrixCellKey(p.id, d.id);
                        const isBusy = matrixBusy.has(key);
                        return (
                          <td
                            key={d.id}
                            className="text-center px-3 py-2.5"
                          >
                            <button
                              onClick={() => handleMatrixCellClick(p.id, d.id)}
                              disabled={isBusy}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-50"
                              title={matrixDotTitle(status)}
                            >
                              {isBusy ? (
                                <RefreshCw className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                              ) : (
                                <span
                                  className={`w-3.5 h-3.5 rounded-full ${matrixDotClass(status)} transition-colors`}
                                />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend */}
          {matrix && matrix.personnel.length > 0 && matrix.devices.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 flex items-center gap-6 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                Tanımlı
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                Bekliyor
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                Başarısız
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" />
                Tanımsız
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================
          Add Device Modal (works for both single and bulk)
         ================================================================ */}
      {addDeviceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setAddDeviceModalOpen(false)} />

          {/* Panel */}
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 border border-gray-200 dark:border-gray-700 max-h-[80vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Cihaz Ekle
              </h2>
              <button
                onClick={() => setAddDeviceModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {isBulkMode ? (
                  <>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {checkedPersonnelIds.size} personel
                    </span>{' '}
                    için cihaz seçin:
                  </>
                ) : (
                  <>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {selectedPersonnel?.firstName} {selectedPersonnel?.lastName}
                    </span>{' '}
                    için cihaz seçin:
                  </>
                )}
              </p>

              {devicesGroupedByLocation.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
                  Cihaz bulunamadı.
                </p>
              ) : (
                <div className="space-y-4">
                  {devicesGroupedByLocation.map((group) => (
                    <div key={group.locationName}>
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {group.locationName}
                      </h4>
                      <div className="space-y-1">
                        {group.devices.map((device) => {
                          const alreadyAssigned = !isBulkMode && assignedDeviceIds.has(device.id);
                          const isChecked = selectedDeviceIds.has(device.id);
                          return (
                            <label
                              key={device.id}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                                alreadyAssigned
                                  ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 opacity-50 cursor-not-allowed'
                                  : isChecked
                                  ? 'border-[#0078d4] bg-blue-50 dark:bg-blue-900/20'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={alreadyAssigned}
                                onChange={() => toggleDeviceSelection(device.id)}
                                className="w-4 h-4 rounded border-gray-300 text-[#0078d4] focus:ring-[#0078d4]"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {device.name}
                                </p>
                                {alreadyAssigned && (
                                  <p className="text-xs text-gray-400 dark:text-gray-500">
                                    Zaten atanmış
                                  </p>
                                )}
                              </div>
                              <Cpu className="w-4 h-4 text-gray-400 shrink-0" />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {selectedDeviceIds.size} cihaz seçildi
                {isBulkMode && ` — ${checkedPersonnelIds.size} personele atanacak`}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAddDeviceModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={handleAssignDevices}
                  disabled={assigning || selectedDeviceIds.size === 0}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#0078d4] hover:bg-[#106eba] transition-colors disabled:opacity-50"
                >
                  {assigning ? 'Atanıyor...' : 'Ata'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
