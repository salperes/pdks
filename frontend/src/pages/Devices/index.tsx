import { useEffect, useState, useCallback } from 'react';
import { Cpu, Plus, Edit, Trash2, X, Wifi, WifiOff, RefreshCw, MapPin, Users, Info, Search } from 'lucide-react';
import { api } from '../../services/api';
import { formatDateTime } from '../../utils/date';
import type { Device, Location } from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeviceFormData {
  name: string;
  ipAddress: string;
  port: number;
  locationId: string;
  direction: 'in' | 'out' | 'both';
  serialNumber: string;
  commKey: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const EMPTY_FORM: DeviceFormData = {
  name: '',
  ipAddress: '',
  port: 4370,
  locationId: '',
  direction: 'in',
  serialNumber: '',
  commKey: '',
};

const DIRECTION_LABELS: Record<Device['direction'], string> = {
  in: 'Giriş',
  out: 'Çıkış',
  both: 'Giriş/Çıkış',
};

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
// Main page
// ---------------------------------------------------------------------------

export const DevicesPage = () => {
  // Data state
  const [devices, setDevices] = useState<Device[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [form, setForm] = useState<DeviceFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Connection test state – track per-device
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());

  // Operation loading states – per-device
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [enrollingIds, setEnrollingIds] = useState<Set<string>>(new Set());
  const [pullingIds, setPullingIds] = useState<Set<string>>(new Set());
  const [syncAllLoading, setSyncAllLoading] = useState(false);

  // Pull data modal
  const [pullData, setPullData] = useState<any>(null);

  // Device users modal
  const [deviceUsersData, setDeviceUsersData] = useState<any>(null);
  const [fetchingUsersIds, setFetchingUsersIds] = useState<Set<string>>(new Set());
  const [usersSearch, setUsersSearch] = useState('');

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [toastSeq, setToastSeq] = useState(0);

  // ----------------------------------
  // Helpers
  // ----------------------------------

  const addToast = useCallback(
    (message: string, type: 'success' | 'error') => {
      const id = toastSeq + 1;
      setToastSeq(id);
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    },
    [toastSeq],
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ----------------------------------
  // Data fetching
  // ----------------------------------

  const fetchDevices = useCallback(async () => {
    try {
      const res = await api.get('/devices');
      setDevices(Array.isArray(res.data) ? res.data : res.data.data ?? []);
    } catch {
      addToast('Cihazlar yüklenirken hata oluştu.', 'error');
    }
  }, [addToast]);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await api.get('/locations');
      setLocations(Array.isArray(res.data) ? res.data : res.data.data ?? []);
    } catch {
      /* silently ignore – dropdown will just be empty */
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchDevices(), fetchLocations()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------------
  // Modal helpers
  // ----------------------------------

  const openAddModal = () => {
    setEditingDevice(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (device: Device) => {
    setEditingDevice(device);
    setForm({
      name: device.name,
      ipAddress: device.ipAddress,
      port: device.port,
      locationId: device.locationId ?? '',
      direction: device.direction,
      serialNumber: device.serialNumber ?? '',
      commKey: device.commKey ?? '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingDevice(null);
    setForm(EMPTY_FORM);
  };

  // ----------------------------------
  // CRUD handlers
  // ----------------------------------

  const handleSave = async () => {
    if (!form.name.trim() || !form.ipAddress.trim()) {
      addToast('Cihaz adı ve IP adresi zorunludur.', 'error');
      return;
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      ipAddress: form.ipAddress.trim(),
      port: form.port,
      direction: form.direction,
    };
    if (form.locationId) payload.locationId = form.locationId;
    if (form.serialNumber.trim()) payload.serialNumber = form.serialNumber.trim();
    if (form.commKey.trim()) payload.commKey = form.commKey.trim();

    setSaving(true);
    try {
      if (editingDevice) {
        await api.patch(`/devices/${editingDevice.id}`, payload);
        addToast('Cihaz başarıyla güncellendi.', 'success');
      } else {
        await api.post('/devices', payload);
        addToast('Cihaz başarıyla eklendi.', 'success');
      }
      closeModal();
      await fetchDevices();
    } catch {
      addToast('İşlem sırasında hata oluştu.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/devices/${deleteTarget.id}`);
      addToast('Cihaz başarıyla silindi.', 'success');
      setDeleteTarget(null);
      await fetchDevices();
    } catch {
      addToast('Silme işlemi sırasında hata oluştu.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleTestConnection = async (device: Device) => {
    setTestingIds((prev) => new Set(prev).add(device.id));
    try {
      await api.post(`/devices/${device.id}/test`);
      addToast(`${device.name}: Bağlantı başarılı.`, 'success');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 501) {
        addToast(`${device.name}: Bağlantı testi henüz desteklenmiyor.`, 'error');
      } else {
        addToast(`${device.name}: Bağlantı başarısız.`, 'error');
      }
    } finally {
      setTestingIds((prev) => {
        const next = new Set(prev);
        next.delete(device.id);
        return next;
      });
    }
  };

  // ----------------------------------
  // Device operation handlers
  // ----------------------------------

  const handleSync = async (device: Device) => {
    setSyncingIds((prev) => new Set(prev).add(device.id));
    try {
      const res = await api.post(`/devices/${device.id}/sync`);
      const count = res.data?.recordsSynced ?? 0;
      addToast(`${device.name}: ${count} kayıt senkronize edildi.`, 'success');
      await fetchDevices();
    } catch {
      addToast(`${device.name}: Senkronizasyon başarısız.`, 'error');
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(device.id);
        return next;
      });
    }
  };

  const handleEnrollAll = async (device: Device) => {
    setEnrollingIds((prev) => new Set(prev).add(device.id));
    try {
      const res = await api.post(`/devices/${device.id}/enroll-all`);
      const msg = res.data?.message ?? 'Toplu tanımlama tamamlandı';
      addToast(`${device.name}: ${msg}`, 'success');
    } catch {
      addToast(`${device.name}: Toplu tanımlama başarısız.`, 'error');
    } finally {
      setEnrollingIds((prev) => {
        const next = new Set(prev);
        next.delete(device.id);
        return next;
      });
    }
  };

  const handlePullInfo = async (device: Device) => {
    setPullingIds((prev) => new Set(prev).add(device.id));
    try {
      const res = await api.post(`/devices/${device.id}/pull`);
      if (res.data?.success) {
        setPullData(res.data);
      } else {
        addToast(`${device.name}: ${res.data?.message ?? 'Veri çekimi başarısız.'}`, 'error');
      }
    } catch {
      addToast(`${device.name}: Cihaz bilgisi alınamadı.`, 'error');
    } finally {
      setPullingIds((prev) => {
        const next = new Set(prev);
        next.delete(device.id);
        return next;
      });
    }
  };

  const handleFetchUsers = async (device: Device) => {
    setFetchingUsersIds((prev) => new Set(prev).add(device.id));
    try {
      const res = await api.post(`/devices/${device.id}/users`);
      if (res.data?.success) {
        setDeviceUsersData(res.data);
        setUsersSearch('');
      } else {
        addToast(`${device.name}: ${res.data?.message ?? 'Kullanıcı listesi alınamadı.'}`, 'error');
      }
    } catch {
      addToast(`${device.name}: Kullanıcı listesi alınamadı.`, 'error');
    } finally {
      setFetchingUsersIds((prev) => {
        const next = new Set(prev);
        next.delete(device.id);
        return next;
      });
    }
  };

  const handleSyncAll = async () => {
    setSyncAllLoading(true);
    try {
      await api.post('/devices/sync-all');
      addToast('Tüm cihazlar senkronize edildi.', 'success');
      await fetchDevices();
    } catch {
      addToast('Toplu senkronizasyon başarısız.', 'error');
    } finally {
      setSyncAllLoading(false);
    }
  };

  // ----------------------------------
  // Form change handler
  // ----------------------------------

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'port' ? Number(value) || 0 : value,
    }));
  };

  // ----------------------------------
  // Render helpers
  // ----------------------------------

  const locationName = (device: Device) =>
    device.location?.name ??
    locations.find((l) => l.id === device.locationId)?.name ??
    '-';

  const formatDateTimeNullable = (iso?: string) => {
    if (!iso) return '-';
    return formatDateTime(iso);
  };

  // ----------------------------------
  // Render
  // ----------------------------------

  return (
    <div className="space-y-6">
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Top bar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-xl shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-[#0078d4] flex items-center justify-center">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Cihaz Yönetimi</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Sistemdeki cihazları yönetin
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAll}
            disabled={syncAllLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncAllLoading ? 'animate-spin' : ''}`} />
            Tümünü Senkronize Et
          </button>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0078d4] hover:bg-[#106eba] text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Yeni Cihaz
          </button>
        </div>
      </div>

      {/* Device grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
          <span className="ml-3 text-gray-500 dark:text-gray-400 text-sm">Yükleniyor...</span>
        </div>
      ) : devices.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center">
          <Cpu className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Henüz cihaz eklenmemiş.</p>
          <button
            onClick={openAddModal}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0078d4] hover:bg-[#106eba] text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Yeni Cihaz Ekle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {devices.map((device) => (
            <div
              key={device.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden"
            >
              {/* Card header */}
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Cpu className="w-5 h-5 text-[#0078d4] shrink-0" />
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {device.name}
                    </h3>
                  </div>
                  {/* Online status badge */}
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
                      device.isOnline
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        device.isOnline ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                    />
                    {device.isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
                  </span>
                </div>

                {/* Info rows */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    {device.isOnline ? (
                      <Wifi className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span className="font-mono">
                      {device.ipAddress}:{device.port}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span className="truncate">{locationName(device)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <RefreshCw className="w-4 h-4 shrink-0" />
                    <span>
                      Yön: <span className="font-medium text-gray-900 dark:text-white">{DIRECTION_LABELS[device.direction]}</span>
                    </span>
                  </div>

                  {device.serialNumber && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Cpu className="w-4 h-4 shrink-0" />
                      <span className="font-mono text-xs">{device.serialNumber}</span>
                    </div>
                  )}

                  <div className="text-xs text-gray-400 dark:text-gray-500 pt-1">
                    Son Senkronizasyon: {formatDateTimeNullable(device.lastSyncAt)}
                  </div>
                </div>
              </div>

              {/* Card actions – operations row */}
              <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-2.5 flex items-center gap-2 bg-gray-50 dark:bg-gray-900/40">
                <button
                  onClick={() => handleSync(device)}
                  disabled={syncingIds.has(device.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingIds.has(device.id) ? 'animate-spin' : ''}`} />
                  Senkronize Et
                </button>
                <button
                  onClick={() => handleEnrollAll(device)}
                  disabled={enrollingIds.has(device.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  <Users className={`w-3.5 h-3.5 ${enrollingIds.has(device.id) ? 'animate-pulse' : ''}`} />
                  Toplu Tanımla
                </button>
                <button
                  onClick={() => handleFetchUsers(device)}
                  disabled={fetchingUsersIds.has(device.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  <Users className={`w-3.5 h-3.5 ${fetchingUsersIds.has(device.id) ? 'animate-pulse' : ''}`} />
                  Kullanıcılar
                </button>
                <button
                  onClick={() => handlePullInfo(device)}
                  disabled={pullingIds.has(device.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  <Info className={`w-3.5 h-3.5 ${pullingIds.has(device.id) ? 'animate-pulse' : ''}`} />
                  Cihaz Bilgisi
                </button>
              </div>

              {/* Card actions – management row */}
              <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-2.5 flex items-center gap-2 bg-gray-50 dark:bg-gray-900/40">
                <button
                  onClick={() => handleTestConnection(device)}
                  disabled={testingIds.has(device.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  <Wifi className={`w-3.5 h-3.5 ${testingIds.has(device.id) ? 'animate-pulse' : ''}`} />
                  Bağlantı Test
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => openEditModal(device)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-[#0078d4] hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Düzenle
                </button>
                <button
                  onClick={() => setDeleteTarget(device)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />

          {/* Panel */}
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 border border-gray-200 dark:border-gray-700">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingDevice ? 'Cihaz Düzenle' : 'Yeni Cihaz'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cihaz Adı <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Örnek: Ana Giriş Terminali"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0078d4] focus:border-transparent outline-none"
                />
              </div>

              {/* IP + Port row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    IP Adresi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="ipAddress"
                    value={form.ipAddress}
                    onChange={handleChange}
                    placeholder="192.168.1.100"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0078d4] focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    name="port"
                    value={form.port}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0078d4] focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Lokasyon
                </label>
                <select
                  name="locationId"
                  value={form.locationId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0078d4] focus:border-transparent outline-none"
                >
                  <option value="">-- Lokasyon Seçin --</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Direction */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Yön
                </label>
                <select
                  name="direction"
                  value={form.direction}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0078d4] focus:border-transparent outline-none"
                >
                  <option value="in">Giriş</option>
                  <option value="out">Çıkış</option>
                  <option value="both">Giriş/Çıkış</option>
                </select>
              </div>

              {/* Serial number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Seri Numarası
                </label>
                <input
                  type="text"
                  name="serialNumber"
                  value={form.serialNumber}
                  onChange={handleChange}
                  placeholder="Opsiyonel"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0078d4] focus:border-transparent outline-none"
                />
              </div>

              {/* Comm Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Comm Key (İletişim Şifresi)
                </label>
                <input
                  type="text"
                  name="commKey"
                  value={form.commKey}
                  onChange={handleChange}
                  placeholder="Opsiyonel (örnek: 202212)"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0078d4] focus:border-transparent outline-none"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#0078d4] hover:bg-[#106eba] transition-colors disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pull / Device Info Modal */}
      {pullData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPullData(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 border border-gray-200 dark:border-gray-700 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {pullData.device?.name ?? 'Cihaz'} — Bilgi
              </h2>
              <button onClick={() => setPullData(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5 overflow-y-auto">
              {/* Device info */}
              {pullData.info && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Cihaz Bilgisi</h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {Object.entries(pullData.info).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <span className="text-gray-500 dark:text-gray-400 font-medium">{key}:</span>
                        <span className="text-gray-900 dark:text-white truncate">{String(value ?? '-')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Capacity */}
              {pullData.counts && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Kapasite</h3>
                  <div className="flex gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#0078d4]" />
                      <span className="text-gray-700 dark:text-gray-300">
                        <span className="font-semibold">{pullData.counts.users}</span> kullanıcı
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-[#0078d4]" />
                      <span className="text-gray-700 dark:text-gray-300">
                        <span className="font-semibold">{pullData.counts.attendances}</span> kayıt
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Users table */}
              {pullData.samples?.users?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Kullanıcılar (ilk {pullData.samples.users.length})
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-900/40">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400">UID</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Ad</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Kart No</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400">User ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {pullData.samples.users.map((u: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <td className="px-3 py-1.5 text-gray-900 dark:text-white font-mono">{u.uid || '-'}</td>
                            <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{u.name || '-'}</td>
                            <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300 font-mono">{u.cardno || '-'}</td>
                            <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300 font-mono">{u.userId || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Attendance table */}
              {pullData.samples?.attendances?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Son Kayıtlar (ilk {pullData.samples.attendances.length})
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-900/40">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400">UID</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Tarih/Saat</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {pullData.samples.attendances.map((a: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <td className="px-3 py-1.5 text-gray-900 dark:text-white font-mono">{a.uid ?? a.userId ?? '-'}</td>
                            <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300 font-mono">
                              {a.timestamp
                                ? formatDateTime(a.timestamp)
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
              <button
                onClick={() => setPullData(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device Users Modal */}
      {deviceUsersData && (() => {
        const allUsers: any[] = deviceUsersData.users ?? [];
        const searchLower = usersSearch.toLowerCase();
        const filtered = searchLower
          ? allUsers.filter(
              (u: any) =>
                String(u.name ?? '').toLowerCase().includes(searchLower) ||
                String(u.uid ?? '').toString().includes(searchLower) ||
                String(u.userId ?? '').toString().includes(searchLower) ||
                String(u.cardno ?? '').toString().includes(searchLower),
            )
          : allUsers;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setDeviceUsersData(null)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 border border-gray-200 dark:border-gray-700 max-h-[85vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {deviceUsersData.device?.name ?? 'Cihaz'} — Tanımlı Kullanıcılar
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    Toplam {allUsers.length} kullanıcı
                  </p>
                </div>
                <button onClick={() => setDeviceUsersData(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search */}
              <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={usersSearch}
                    onChange={(e) => setUsersSearch(e.target.value)}
                    placeholder="Kullanıcı ara (ad, UID, kart no)..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0078d4] focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Users table */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {filtered.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                    {allUsers.length === 0 ? 'Cihazda tanımlı kullanıcı bulunamadı.' : 'Aramayla eşleşen kullanıcı yok.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-900/40 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2.5 font-medium text-gray-500 dark:text-gray-400 text-xs">#</th>
                          <th className="text-left px-3 py-2.5 font-medium text-gray-500 dark:text-gray-400 text-xs">UID</th>
                          <th className="text-left px-3 py-2.5 font-medium text-gray-500 dark:text-gray-400 text-xs">Ad</th>
                          <th className="text-left px-3 py-2.5 font-medium text-gray-500 dark:text-gray-400 text-xs">Kart No</th>
                          <th className="text-left px-3 py-2.5 font-medium text-gray-500 dark:text-gray-400 text-xs">User ID</th>
                          <th className="text-left px-3 py-2.5 font-medium text-gray-500 dark:text-gray-400 text-xs">Rol</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filtered.map((u: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <td className="px-3 py-2 text-gray-400 dark:text-gray-500 text-xs">{i + 1}</td>
                            <td className="px-3 py-2 text-gray-900 dark:text-white font-mono text-xs">{u.uid || '-'}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{u.name || '-'}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300 font-mono text-xs">{u.cardno || '-'}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300 font-mono text-xs">{u.userId || '-'}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300 text-xs">
                              {u.role === 14 ? 'Admin' : u.role === 0 ? 'Normal' : (u.role != null ? u.role : '-')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {searchLower ? `${filtered.length} / ${allUsers.length} gösteriliyor` : `${allUsers.length} kullanıcı`}
                </span>
                <button
                  onClick={() => setDeviceUsersData(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteTarget(null)} />

          {/* Panel */}
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-5 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Cihazı Sil
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">{deleteTarget.name}</span>{' '}
                cihazını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Siliniyor...' : 'Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
