import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Users,
  Search,
  Edit,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Upload,
  BarChart3,
  Cpu,
  LogIn,
  LogOut,
  ToggleLeft,
  ToggleRight,
  Clock,
  Calendar,
  Camera,
  ImageOff,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { formatDate, formatTime } from '../../utils/date';
import type { Personnel, Device, PaginatedResponse } from '../../types';

/* ---------- Types ---------- */

interface PersonnelForm {
  firstName: string;
  lastName: string;
  cardNumber: string;
  tcKimlikNo: string;
  employeeId: string;
  username: string;
  department: string;
  title: string;
  phone: string;
  email: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface PersonnelStats {
  personnel: {
    id: string;
    firstName: string;
    lastName: string;
    cardNumber: string;
    department?: string;
    title?: string;
    employeeId?: string;
    isActive: boolean;
  };
  recentLogs: {
    id: string;
    eventTime: string;
    direction: string;
    deviceName?: string;
    locationName?: string;
  }[];
  monthlyStats: {
    year: number;
    month: number;
    daysPresent: number;
    totalEntries: number;
  };
}

const emptyForm: PersonnelForm = {
  firstName: '',
  lastName: '',
  cardNumber: '',
  tcKimlikNo: '',
  employeeId: '',
  username: '',
  department: '',
  title: '',
  phone: '',
  email: '',
};

/* ---------- Helpers ---------- */

const LIMIT = 20;

let toastCounter = 0;

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(sep).map((v) => v.trim().replace(/^["']|["']$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (vals[idx]) row[h] = vals[idx];
    });
    if (Object.keys(row).length > 0) rows.push(row);
  }
  return rows;
}

const MONTH_NAMES = [
  '', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

/* ---------- Component ---------- */

export const PersonnelPage = () => {
  /* ---- Auth ---- */
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  /* ---- Data state ---- */
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  /* ---- Filter state ---- */
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  /* ---- Modal state ---- */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PersonnelForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  /* ---- Delete dialog ---- */
  const [deleteTarget, setDeleteTarget] = useState<Personnel | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ---- Bulk delete state ---- */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  /* ---- Toggle loading ---- */
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  /* ---- Stats modal ---- */
  const [statsData, setStatsData] = useState<PersonnelStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  /* ---- Enroll modal ---- */
  const [enrollTarget, setEnrollTarget] = useState<Personnel | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [enrollingDeviceId, setEnrollingDeviceId] = useState<string | null>(null);

  /* ---- Photo upload state ---- */
  const [photoUploading, setPhotoUploading] = useState(false);
  const [editingPhotoUrl, setEditingPhotoUrl] = useState<string | null>(null);

  /* ---- Import modal ---- */
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);

  /* ---- Toasts ---- */
  const [toasts, setToasts] = useState<Toast[]>([]);

  /* ---- Refs for debounce ---- */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------- Toast helper ---------- */

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  /* ---------- Fetch ---------- */

  const fetchPersonnel = useCallback(
    async (pg: number, searchVal: string, dept: string) => {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { page: pg, limit: LIMIT };
        if (searchVal.trim()) params.search = searchVal.trim();
        if (dept.trim()) params.department = dept.trim();

        const res = await api.get<PaginatedResponse<Personnel>>('/personnel', { params });
        const data = res.data;
        setPersonnel(data.data);
        setTotal(data.total);
        setPage(data.page);
        setTotalPages(Math.max(1, Math.ceil(data.total / (data.limit || LIMIT))));
      } catch {
        showToast('Veriler yüklenirken hata oluştu.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  /* ---- Initial fetch & on page change ---- */
  useEffect(() => {
    fetchPersonnel(page, search, departmentFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  /* ---- Debounced search / department ---- */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchPersonnel(1, search, departmentFilter);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, departmentFilter]);

  /* ---- Clear selection on page / filter change ---- */
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, search, departmentFilter]);

  /* ---------- Bulk selection helpers ---------- */

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(personnel.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const allSelected = personnel.length > 0 && personnel.every((p) => selectedIds.has(p.id));
  const someSelected = selectedIds.size > 0;

  /* ---------- Bulk delete ---------- */

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      await api.delete('/personnel/bulk', { data: { ids: Array.from(selectedIds) } });
      showToast(`${selectedIds.size} personel silindi.`, 'success');
      setSelectedIds(new Set());
      setBulkDeleteConfirmOpen(false);
      fetchPersonnel(page, search, departmentFilter);
    } catch {
      showToast('Toplu silme sırasında hata oluştu.', 'error');
    } finally {
      setBulkDeleting(false);
    }
  };

  /* ---------- Modal open helpers ---------- */

  const openAddModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (p: Personnel) => {
    setEditingId(p.id);
    setEditingPhotoUrl(p.photoUrl || null);
    setForm({
      firstName: p.firstName,
      lastName: p.lastName,
      cardNumber: p.cardNumber,
      tcKimlikNo: p.tcKimlikNo ?? '',
      employeeId: p.employeeId ?? '',
      username: p.username ?? '',
      department: p.department ?? '',
      title: p.title ?? '',
      phone: p.phone ?? '',
      email: p.email ?? '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setEditingPhotoUrl(null);
  };

  /* ---------- Save (create / update) ---------- */

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.cardNumber.trim()) {
      showToast('Ad, Soyad ve Kart No alanları zorunludur.', 'error');
      return;
    }
    setSaving(true);

    const payload: Record<string, string> = {};
    payload.firstName = form.firstName.trim();
    payload.lastName = form.lastName.trim();
    payload.cardNumber = form.cardNumber.trim();
    if (form.tcKimlikNo.trim()) payload.tcKimlikNo = form.tcKimlikNo.trim();
    if (form.employeeId.trim()) payload.employeeId = form.employeeId.trim();
    if (form.username.trim()) payload.username = form.username.trim();
    if (form.department.trim()) payload.department = form.department.trim();
    if (form.title.trim()) payload.title = form.title.trim();
    if (form.phone.trim()) payload.phone = form.phone.trim();
    if (form.email.trim()) payload.email = form.email.trim();

    try {
      if (editingId) {
        await api.patch(`/personnel/${editingId}`, payload);
        showToast('Personel başarıyla güncellendi.', 'success');
      } else {
        await api.post('/personnel', payload);
        showToast('Personel başarıyla eklendi.', 'success');
      }
      closeModal();
      fetchPersonnel(editingId ? page : 1, search, departmentFilter);
      if (!editingId) setPage(1);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        (editingId ? 'Personel güncellenirken hata oluştu.' : 'Personel eklenirken hata oluştu.');
      showToast(typeof msg === 'string' ? msg : JSON.stringify(msg), 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Delete ---------- */

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/personnel/${deleteTarget.id}`);
      showToast('Personel başarıyla silindi.', 'success');
      setDeleteTarget(null);
      fetchPersonnel(page, search, departmentFilter);
    } catch {
      showToast('Personel silinirken hata oluştu.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  /* ---------- Toggle Active ---------- */

  const handleToggleActive = async (p: Personnel) => {
    setTogglingIds((prev) => new Set(prev).add(p.id));
    try {
      await api.patch(`/personnel/${p.id}/toggle-active`);
      showToast(
        `${p.firstName} ${p.lastName}: ${p.isActive ? 'Pasif' : 'Aktif'} yapıldı.`,
        'success',
      );
      fetchPersonnel(page, search, departmentFilter);
    } catch {
      showToast('Durum değiştirilemedi.', 'error');
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
    }
  };

  /* ---------- Stats modal ---------- */

  const openStatsModal = async (p: Personnel) => {
    setStatsLoading(true);
    setStatsData(null);
    try {
      const res = await api.get(`/personnel/${p.id}/stats`);
      setStatsData(res.data);
    } catch {
      showToast('İstatistikler yüklenemedi.', 'error');
    } finally {
      setStatsLoading(false);
    }
  };

  /* ---------- Enroll to device ---------- */

  const openEnrollModal = async (p: Personnel) => {
    setEnrollTarget(p);
    try {
      const res = await api.get('/devices');
      const list = Array.isArray(res.data) ? res.data : res.data.data || [];
      setDevices(list.filter((d: Device) => d.isActive));
    } catch {
      showToast('Cihaz listesi yüklenemedi.', 'error');
    }
  };

  const handleEnroll = async (deviceId: string) => {
    if (!enrollTarget) return;
    setEnrollingDeviceId(deviceId);
    try {
      const res = await api.post(`/devices/${deviceId}/enroll/${enrollTarget.id}`);
      if (res.data.success) {
        showToast(`${enrollTarget.firstName} ${enrollTarget.lastName} cihaza tanımlandı.`, 'success');
      } else {
        showToast(res.data.message || 'Tanımlama başarısız.', 'error');
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Tanımlama başarısız.', 'error');
    } finally {
      setEnrollingDeviceId(null);
    }
  };

  /* ---------- Import ---------- */

  const handleCsvChange = (text: string) => {
    setCsvText(text);
    try {
      const rows = parseCSV(text);
      setCsvPreview(rows.slice(0, 5));
    } catch {
      setCsvPreview([]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      handleCsvChange(text);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleImport = async () => {
    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      showToast('Geçerli CSV verisi bulunamadı.', 'error');
      return;
    }

    const records = rows.map((r) => ({
      firstName: r.firstName || r.ad || r.Ad || '',
      lastName: r.lastName || r.soyad || r.Soyad || '',
      cardNumber: r.cardNumber || r.kartNo || r.KartNo || r['Kart No'] || '',
      tcKimlikNo: r.tcKimlikNo || r.TC || r.tc || undefined,
      employeeId: r.employeeId || r.sicilNo || r.SicilNo || r['Sicil No'] || undefined,
      username: r.username || r.kullaniciAdi || r['Kullanıcı Adı'] || undefined,
      department: r.department || r.departman || r.Departman || undefined,
      title: r.title || r.unvan || r.Unvan || r['Ünvan'] || undefined,
      phone: r.phone || r.telefon || r.Telefon || undefined,
      email: r.email || r.eposta || r['E-posta'] || undefined,
    }));

    setImporting(true);
    try {
      const res = await api.post('/personnel/import', { records });
      const { created, skipped, errors } = res.data;
      let msg = `${created} personel eklendi`;
      if (skipped > 0) msg += `, ${skipped} atlandı (zaten kayıtlı)`;
      if (errors?.length > 0) msg += `, ${errors.length} hata`;
      showToast(msg, errors?.length > 0 ? 'error' : 'success');
      setImportOpen(false);
      setCsvText('');
      setCsvPreview([]);
      fetchPersonnel(1, search, departmentFilter);
      setPage(1);
    } catch {
      showToast('İçe aktarma sırasında hata oluştu.', 'error');
    } finally {
      setImporting(false);
    }
  };

  /* ---------- Photo upload / delete ---------- */

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingId) return;
    e.target.value = '';

    const formData = new FormData();
    formData.append('photo', file);

    setPhotoUploading(true);
    try {
      const res = await api.post(`/personnel/${editingId}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEditingPhotoUrl(res.data.photoUrl);
      showToast('Fotoğraf yüklendi.', 'success');
      fetchPersonnel(page, search, departmentFilter);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Fotoğraf yüklenemedi.', 'error');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handlePhotoDelete = async () => {
    if (!editingId) return;
    setPhotoUploading(true);
    try {
      await api.delete(`/personnel/${editingId}/photo`);
      setEditingPhotoUrl(null);
      showToast('Fotoğraf silindi.', 'success');
      fetchPersonnel(page, search, departmentFilter);
    } catch {
      showToast('Fotoğraf silinemedi.', 'error');
    } finally {
      setPhotoUploading(false);
    }
  };

  /* ---------- Form field updater ---------- */

  const updateField = (field: keyof PersonnelForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  /* ---------- Pagination helpers ---------- */

  const pageNumbers = (): (number | '...')[] => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const startRow = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const endRow = Math.min(page * LIMIT, total);

  /* ---- Column count for colSpan ---- */
  const colCount = isAdmin ? 8 : 7;

  /* ---------- Render ---------- */

  return (
    <div className="space-y-4">
      {/* ---- Toast notifications ---- */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${
              t.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* ---- Top bar ---- */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#0078d4] flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
              Personel Yönetimi
            </h1>
          </div>

          {/* Filters + Buttons */}
          <div className="flex flex-col sm:flex-row flex-1 gap-3 lg:justify-end">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 w-full sm:w-60 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent"
              />
            </div>

            {/* Department filter */}
            <input
              type="text"
              placeholder="Departman"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 w-full sm:w-44 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent"
            />

            {/* Import button */}
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors flex-shrink-0"
            >
              <Upload className="w-4 h-4" />
              <span>Toplu İçe Aktar</span>
            </button>

            {/* Add button */}
            <button
              onClick={openAddModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#0078d4] hover:bg-[#106eba] text-white text-sm font-medium transition-colors flex-shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>Yeni Personel</span>
            </button>
          </div>
        </div>
      </div>

      {/* ---- Bulk selection bar ---- */}
      {isAdmin && someSelected && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-red-700 dark:text-red-300">
            {selectedIds.size} kayıt seçili
          </span>
          <button
            onClick={() => setBulkDeleteConfirmOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Seçilenleri Sil
          </button>
        </div>
      )}

      {/* ---- Table ---- */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                {isAdmin && (
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-[#0078d4] focus:ring-[#0078d4] cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                  Ad Soyad
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                  Kart No
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden md:table-cell">
                  Kullanıcı Adı
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden md:table-cell">
                  Departman
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden lg:table-cell">
                  Son Giriş
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Durum</th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-right">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading && personnel.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
                      <div className="w-8 h-8 border-2 border-gray-300 dark:border-gray-600 border-t-[#0078d4] rounded-full animate-spin" />
                      <span className="text-sm">Yükleniyor...</span>
                    </div>
                  </td>
                </tr>
              ) : personnel.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
                      <Users className="w-10 h-10" />
                      <span className="text-sm">
                        {search || departmentFilter
                          ? 'Aramayla eşleşen personel bulunamadı.'
                          : 'Henüz personel kaydı yok.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                personnel.map((p) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      selectedIds.has(p.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    {isAdmin && (
                      <td className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={(e) => handleSelectOne(p.id, e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-[#0078d4] focus:ring-[#0078d4] cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.photoUrl ? (
                          <img
                            src={p.photoUrl}
                            alt={`${p.firstName} ${p.lastName}`}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#0078d4]/10 text-[#0078d4] flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {p.firstName.charAt(0)}
                            {p.lastName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {p.firstName} {p.lastName}
                          </span>
                          {p.department && (
                            <p className="text-xs text-gray-400 md:hidden">{p.department}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 font-mono text-xs">
                      {p.cardNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 hidden md:table-cell font-mono text-xs">
                      {p.username || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 hidden md:table-cell">
                      {p.department || '-'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {p.lastAccessTime ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              p.lastDirection === 'in' ? 'bg-emerald-500' : 'bg-red-400'
                            }`}
                          />
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(p.lastAccessTime)}{' '}
                            {formatTime(p.lastAccessTime)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(p)}
                        disabled={togglingIds.has(p.id)}
                        title={p.isActive ? 'Pasif yap' : 'Aktif yap'}
                        className="flex items-center gap-1.5 group disabled:opacity-50"
                      >
                        {p.isActive ? (
                          <ToggleRight className="w-6 h-6 text-emerald-500 group-hover:text-emerald-600" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-gray-400 group-hover:text-gray-500" />
                        )}
                        <span
                          className={`text-xs font-medium ${
                            p.isActive
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-gray-400'
                          }`}
                        >
                          {p.isActive ? 'Aktif' : 'Pasif'}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openStatsModal(p)}
                          title="Detay / İstatistik"
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 hover:text-amber-600 transition-colors"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEnrollModal(p)}
                          title="Cihaza Tanımla"
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 hover:text-purple-600 transition-colors"
                        >
                          <Cpu className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          title="Düzenle"
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 hover:text-[#0078d4] transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(p)}
                          title="Sil"
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 dark:text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ---- Pagination ---- */}
        {total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              {startRow}-{endRow} kayıt gösteriliyor / toplam {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {pageNumbers().map((n, i) =>
                n === '...' ? (
                  <span
                    key={`dots-${i}`}
                    className="px-2 text-gray-400 dark:text-gray-500 select-none"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition-colors ${
                      n === page
                        ? 'bg-[#0078d4] text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {n}
                  </button>
                ),
              )}

              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ---- Add / Edit Modal ---- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                {editingId ? (
                  <>
                    <Edit className="w-5 h-5 text-[#0078d4]" />
                    Personel Düzenle
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5 text-[#0078d4]" />
                    Yeni Personel
                  </>
                )}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Photo upload (only in edit mode) */}
              {editingId && (
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-gray-200 dark:border-gray-600">
                    {editingPhotoUrl ? (
                      <img src={editingPhotoUrl} alt="Foto" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0078d4] hover:bg-[#106eba] text-white text-xs font-medium cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      {photoUploading ? 'Yükleniyor...' : 'Fotoğraf Yükle'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePhotoUpload}
                        disabled={photoUploading}
                        className="hidden"
                      />
                    </label>
                    {editingPhotoUrl && (
                      <button
                        onClick={handlePhotoDelete}
                        disabled={photoUploading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        <ImageOff className="w-3.5 h-3.5" />
                        Fotoğrafı Kaldır
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Ad" required value={form.firstName} onChange={(v) => updateField('firstName', v)} />
                <FormField label="Soyad" required value={form.lastName} onChange={(v) => updateField('lastName', v)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Kart No" required value={form.cardNumber} onChange={(v) => updateField('cardNumber', v)} />
                <FormField label="TC Kimlik No" value={form.tcKimlikNo} onChange={(v) => updateField('tcKimlikNo', v)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Sicil No" value={form.employeeId} onChange={(v) => updateField('employeeId', v)} />
                <FormField label="Kullanıcı Adı (örn: alper.es)" value={form.username} onChange={(v) => updateField('username', v)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Departman" value={form.department} onChange={(v) => updateField('department', v)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Ünvan" value={form.title} onChange={(v) => updateField('title', v)} />
                <FormField label="Telefon" value={form.phone} onChange={(v) => updateField('phone', v)} />
              </div>
              <FormField label="E-posta" type="email" value={form.email} onChange={(v) => updateField('email', v)} />
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0078d4] hover:bg-[#106eba] text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Delete Confirmation ---- */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Personeli Sil</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {deleteTarget.firstName} {deleteTarget.lastName}
                  </span>{' '}
                  isimli personeli silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                </p>
              </div>
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  İptal
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {deleting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Sil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- Bulk Delete Confirmation Modal ---- */}
      {bulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !bulkDeleting && setBulkDeleteConfirmOpen(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Toplu Silme</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {selectedIds.size} personel
                  </span>{' '}
                  kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                </p>
              </div>
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={() => setBulkDeleteConfirmOpen(false)}
                  disabled={bulkDeleting}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  İptal
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {bulkDeleting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Sil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- Stats / Detail Modal ---- */}
      {(statsData || statsLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setStatsData(null);
              setStatsLoading(false);
            }}
          />
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-500" />
                Personel Detayı
              </h2>
              <button
                onClick={() => {
                  setStatsData(null);
                  setStatsLoading(false);
                }}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {statsLoading ? (
              <div className="p-8 flex justify-center">
                <div className="w-8 h-8 border-2 border-gray-300 dark:border-gray-600 border-t-[#0078d4] rounded-full animate-spin" />
              </div>
            ) : statsData ? (
              <div className="p-4 space-y-4">
                {/* Personel bilgisi */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#0078d4]/10 text-[#0078d4] flex items-center justify-center text-lg font-bold overflow-hidden flex-shrink-0">
                    {statsData.personnel.firstName.charAt(0)}
                    {statsData.personnel.lastName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {statsData.personnel.firstName} {statsData.personnel.lastName}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {[statsData.personnel.department, statsData.personnel.title]
                        .filter(Boolean)
                        .join(' — ') || 'Departman belirtilmemiş'}
                    </p>
                    <p className="text-xs text-gray-400">
                      Kart: {statsData.personnel.cardNumber}
                      {statsData.personnel.employeeId && ` | Sicil: ${statsData.personnel.employeeId}`}
                    </p>
                  </div>
                </div>

                {/* Aylık özet */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                    <Calendar className="w-5 h-5 mx-auto text-blue-500 mb-1" />
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                      {statsData.monthlyStats.daysPresent}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      {MONTH_NAMES[statsData.monthlyStats.month]} Gün
                    </p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                    <Clock className="w-5 h-5 mx-auto text-purple-500 mb-1" />
                    <p className="text-xl font-bold text-purple-700 dark:text-purple-300">
                      {statsData.monthlyStats.totalEntries}
                    </p>
                    <p className="text-xs text-purple-600 dark:text-purple-400">Toplam Geçiş</p>
                  </div>
                </div>

                {/* Son geçişler */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Son Geçişler
                  </h4>
                  {statsData.recentLogs.length === 0 ? (
                    <p className="text-sm text-gray-400">Geçiş kaydı yok</p>
                  ) : (
                    <div className="space-y-1.5">
                      {statsData.recentLogs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-gray-50 dark:bg-gray-700/50"
                        >
                          <div className="flex items-center gap-2">
                            {log.direction === 'in' ? (
                              <LogIn className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <LogOut className="w-3.5 h-3.5 text-red-400" />
                            )}
                            <span className="text-gray-600 dark:text-gray-300">
                              {log.locationName || log.deviceName || '-'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {formatDate(log.eventTime)}{' '}
                            {formatTime(log.eventTime)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ---- Enroll to Device Modal ---- */}
      {enrollTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEnrollTarget(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-purple-500" />
                Cihaza Tanımla
              </h2>
              <button
                onClick={() => setEnrollTarget(null)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                <span className="font-medium text-gray-900 dark:text-white">
                  {enrollTarget.firstName} {enrollTarget.lastName}
                </span>{' '}
                personelini tanımlamak istediğiniz cihazı seçin:
              </p>

              {devices.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Aktif cihaz bulunamadı</p>
              ) : (
                <div className="space-y-2">
                  {devices.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleEnroll(d.id)}
                      disabled={enrollingDeviceId !== null}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        <Cpu className="w-5 h-5 text-gray-400" />
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {d.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {d.ipAddress}:{d.port}
                            {d.location && ` — ${d.location.name}`}
                          </p>
                        </div>
                      </div>
                      {enrollingDeviceId === d.id ? (
                        <div className="w-5 h-5 border-2 border-gray-300 border-t-[#0078d4] rounded-full animate-spin" />
                      ) : (
                        <span className="text-xs text-[#0078d4] font-medium">Tanımla</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---- Import Modal ---- */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setImportOpen(false)} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#0078d4]" />
                Toplu Personel İçe Aktar
              </h2>
              <button
                onClick={() => setImportOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">CSV Formatı:</p>
                <code className="text-xs block bg-white/50 dark:bg-black/20 rounded p-2 overflow-x-auto">
                  firstName;lastName;cardNumber;employeeId;department;title;phone;email
                </code>
                <p className="text-xs mt-1">
                  Türkçe başlıklar da desteklenir: ad, soyad, kartNo, sicilNo, departman, unvan, telefon, eposta
                </p>
              </div>

              {/* File upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  CSV Dosyası
                </label>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#0078d4] file:text-white hover:file:bg-[#106eba] file:cursor-pointer"
                />
              </div>

              {/* Or paste */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  veya CSV verisini yapıştırın:
                </label>
                <textarea
                  value={csvText}
                  onChange={(e) => handleCsvChange(e.target.value)}
                  rows={6}
                  placeholder="firstName;lastName;cardNumber;department&#10;Ali;Yılmaz;1001;IT&#10;Ayşe;Demir;1002;Muhasebe"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent font-mono"
                />
              </div>

              {/* Preview */}
              {csvPreview.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Önizleme ({parseCSV(csvText).length} kayıt):
                  </p>
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900">
                          {Object.keys(csvPreview[0]).map((k) => (
                            <th key={k} className="px-2 py-1.5 text-left font-medium text-gray-600 dark:text-gray-400">
                              {k}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {csvPreview.map((row, i) => (
                          <tr key={i}>
                            {Object.values(row).map((v, j) => (
                              <td key={j} className="px-2 py-1.5 text-gray-700 dark:text-gray-300">
                                {v}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setImportOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !csvText.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0078d4] hover:bg-[#106eba] text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {importing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                İçe Aktar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------- FormField sub-component ---------- */

const FormField = ({
  label,
  value,
  onChange,
  required,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent"
    />
  </div>
);

export default PersonnelPage;
