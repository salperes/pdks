import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  UserPlus,
} from 'lucide-react';
import { api } from '../../services/api';
import type { Personnel, PaginatedResponse } from '../../types';

/* ---------- Types ---------- */

interface PersonnelForm {
  firstName: string;
  lastName: string;
  cardNumber: string;
  tcKimlikNo: string;
  employeeId: string;
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

const emptyForm: PersonnelForm = {
  firstName: '',
  lastName: '',
  cardNumber: '',
  tcKimlikNo: '',
  employeeId: '',
  department: '',
  title: '',
  phone: '',
  email: '',
};

/* ---------- Helpers ---------- */

const LIMIT = 20;

let toastCounter = 0;

/* ---------- Component ---------- */

export const PersonnelPage = () => {
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
        showToast('Veriler yuklenirken hata olustu.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  /* ---- Initial fetch & on filter/page change ---- */
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

  /* ---------- Modal open helpers ---------- */

  const openAddModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (p: Personnel) => {
    setEditingId(p.id);
    setForm({
      firstName: p.firstName,
      lastName: p.lastName,
      cardNumber: p.cardNumber,
      tcKimlikNo: p.tcKimlikNo ?? '',
      employeeId: p.employeeId ?? '',
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
  };

  /* ---------- Save (create / update) ---------- */

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.cardNumber.trim()) {
      showToast('Ad, Soyad ve Kart No alanlari zorunludur.', 'error');
      return;
    }
    setSaving(true);

    const payload: Record<string, string> = {};
    payload.firstName = form.firstName.trim();
    payload.lastName = form.lastName.trim();
    payload.cardNumber = form.cardNumber.trim();
    if (form.tcKimlikNo.trim()) payload.tcKimlikNo = form.tcKimlikNo.trim();
    if (form.employeeId.trim()) payload.employeeId = form.employeeId.trim();
    if (form.department.trim()) payload.department = form.department.trim();
    if (form.title.trim()) payload.title = form.title.trim();
    if (form.phone.trim()) payload.phone = form.phone.trim();
    if (form.email.trim()) payload.email = form.email.trim();

    try {
      if (editingId) {
        await api.patch(`/personnel/${editingId}`, payload);
        showToast('Personel basariyla guncellendi.', 'success');
      } else {
        await api.post('/personnel', payload);
        showToast('Personel basariyla eklendi.', 'success');
      }
      closeModal();
      fetchPersonnel(editingId ? page : 1, search, departmentFilter);
      if (!editingId) setPage(1);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        (editingId ? 'Personel guncellenirken hata olustu.' : 'Personel eklenirken hata olustu.');
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
      showToast('Personel basariyla silindi.', 'success');
      setDeleteTarget(null);
      fetchPersonnel(page, search, departmentFilter);
    } catch {
      showToast('Personel silinirken hata olustu.', 'error');
    } finally {
      setDeleting(false);
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
              Personel Yonetimi
            </h1>
          </div>

          {/* Filters */}
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

      {/* ---- Table ---- */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                  Ad Soyad
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                  Kart No
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden md:table-cell">
                  Departman
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden lg:table-cell">
                  Unvan
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden lg:table-cell">
                  Telefon
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Durum</th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-right">
                  Islemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading && personnel.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
                      <div className="w-8 h-8 border-2 border-gray-300 dark:border-gray-600 border-t-[#0078d4] rounded-full animate-spin" />
                      <span className="text-sm">Yukleniyor...</span>
                    </div>
                  </td>
                </tr>
              ) : personnel.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
                      <Users className="w-10 h-10" />
                      <span className="text-sm">
                        {search || departmentFilter
                          ? 'Aramayla eslesen personel bulunamadi.'
                          : 'Henuz personel kaydi yok.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                personnel.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#0078d4]/10 text-[#0078d4] flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {p.firstName.charAt(0)}
                          {p.lastName.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {p.firstName} {p.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 font-mono text-xs">
                      {p.cardNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 hidden md:table-cell">
                      {p.department || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 hidden lg:table-cell">
                      {p.title || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 hidden lg:table-cell">
                      {p.phone || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.isActive
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {p.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(p)}
                          title="Duzenle"
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
              {startRow}-{endRow} kayit gosteriliyor / toplam {total}
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
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />

          {/* Modal content */}
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                {editingId ? (
                  <>
                    <Edit className="w-5 h-5 text-[#0078d4]" />
                    Personel Duzenle
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

            {/* Body */}
            <div className="p-4 space-y-4">
              {/* Row: firstName, lastName */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Ad"
                  required
                  value={form.firstName}
                  onChange={(v) => updateField('firstName', v)}
                />
                <FormField
                  label="Soyad"
                  required
                  value={form.lastName}
                  onChange={(v) => updateField('lastName', v)}
                />
              </div>

              {/* Row: cardNumber, tcKimlikNo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Kart No"
                  required
                  value={form.cardNumber}
                  onChange={(v) => updateField('cardNumber', v)}
                />
                <FormField
                  label="TC Kimlik No"
                  value={form.tcKimlikNo}
                  onChange={(v) => updateField('tcKimlikNo', v)}
                />
              </div>

              {/* Row: employeeId, department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Sicil No"
                  value={form.employeeId}
                  onChange={(v) => updateField('employeeId', v)}
                />
                <FormField
                  label="Departman"
                  value={form.department}
                  onChange={(v) => updateField('department', v)}
                />
              </div>

              {/* Row: title, phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Unvan"
                  value={form.title}
                  onChange={(v) => updateField('title', v)}
                />
                <FormField
                  label="Telefon"
                  value={form.phone}
                  onChange={(v) => updateField('phone', v)}
                />
              </div>

              {/* email */}
              <FormField
                label="E-posta"
                type="email"
                value={form.email}
                onChange={(v) => updateField('email', v)}
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Iptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0078d4] hover:bg-[#106eba] text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
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
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Personeli Sil
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {deleteTarget.firstName} {deleteTarget.lastName}
                  </span>{' '}
                  isimli personeli silmek istediginize emin misiniz? Bu islem geri alinamaz.
                </p>
              </div>
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Iptal
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {deleting && (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  Sil
                </button>
              </div>
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
