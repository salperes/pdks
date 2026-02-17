import { useEffect, useState, useCallback } from 'react';
import { Cpu, Plus, Edit, Trash2, X, Wifi, WifiOff, RefreshCw, MapPin } from 'lucide-react';
import { api } from '../../services/api';
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
  in: 'Giris',
  out: 'Cikis',
  both: 'Giris/Cikis',
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
      addToast('Cihazlar yuklenirken hata olustu.', 'error');
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
      addToast('Cihaz adi ve IP adresi zorunludur.', 'error');
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
        addToast('Cihaz basariyla guncellendi.', 'success');
      } else {
        await api.post('/devices', payload);
        addToast('Cihaz basariyla eklendi.', 'success');
      }
      closeModal();
      await fetchDevices();
    } catch {
      addToast('Islem sirasinda hata olustu.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/devices/${deleteTarget.id}`);
      addToast('Cihaz basariyla silindi.', 'success');
      setDeleteTarget(null);
      await fetchDevices();
    } catch {
      addToast('Silme islemi sirasinda hata olustu.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleTestConnection = async (device: Device) => {
    setTestingIds((prev) => new Set(prev).add(device.id));
    try {
      await api.post(`/devices/${device.id}/test`);
      addToast(`${device.name}: Baglanti basarili.`, 'success');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 501) {
        addToast(`${device.name}: Baglanti testi henuz desteklenmiyor.`, 'error');
      } else {
        addToast(`${device.name}: Baglanti basarisiz.`, 'error');
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

  const formatDate = (iso?: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('tr-TR');
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
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Cihaz Yonetimi</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Sistemdeki cihazlari yonetin
            </p>
          </div>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0078d4] hover:bg-[#106eba] text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Yeni Cihaz
        </button>
      </div>

      {/* Device grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
          <span className="ml-3 text-gray-500 dark:text-gray-400 text-sm">Yukleniyor...</span>
        </div>
      ) : devices.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center">
          <Cpu className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Henuz cihaz eklenmemis.</p>
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
                    {device.isOnline ? 'Cevrimici' : 'Cevrimdisi'}
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
                      Yon: <span className="font-medium text-gray-900 dark:text-white">{DIRECTION_LABELS[device.direction]}</span>
                    </span>
                  </div>

                  {device.serialNumber && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Cpu className="w-4 h-4 shrink-0" />
                      <span className="font-mono text-xs">{device.serialNumber}</span>
                    </div>
                  )}

                  <div className="text-xs text-gray-400 dark:text-gray-500 pt-1">
                    Son Senkronizasyon: {formatDate(device.lastSyncAt)}
                  </div>
                </div>
              </div>

              {/* Card actions */}
              <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-3 flex items-center gap-2 bg-gray-50 dark:bg-gray-900/40">
                <button
                  onClick={() => handleTestConnection(device)}
                  disabled={testingIds.has(device.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  <Wifi className={`w-3.5 h-3.5 ${testingIds.has(device.id) ? 'animate-pulse' : ''}`} />
                  Baglanti Test
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => openEditModal(device)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-[#0078d4] hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Duzenle
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
                {editingDevice ? 'Cihaz Duzenle' : 'Yeni Cihaz'}
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
                  Cihaz Adi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Ornek: Ana Giris Terminali"
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
                  <option value="">-- Lokasyon Secin --</option>
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
                  Yon
                </label>
                <select
                  name="direction"
                  value={form.direction}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0078d4] focus:border-transparent outline-none"
                >
                  <option value="in">Giris</option>
                  <option value="out">Cikis</option>
                  <option value="both">Giris/Cikis</option>
                </select>
              </div>

              {/* Serial number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Seri Numarasi
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
                  Comm Key (Iletisim Sifresi)
                </label>
                <input
                  type="text"
                  name="commKey"
                  value={form.commKey}
                  onChange={handleChange}
                  placeholder="Opsiyonel (ornek: 202212)"
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
                Iptal
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
                Cihazi Sil
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">{deleteTarget.name}</span>{' '}
                cihazini silmek istediginizden emin misiniz? Bu islem geri alinamaz.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Iptal
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
