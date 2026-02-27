import { useEffect, useState, useCallback } from 'react';
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  X,
  UserPlus,
} from 'lucide-react';
import { api } from '../../../services/api';
import type { User, Location } from '../../../types';

/* ---------- Types ---------- */

interface UserForm {
  username: string;
  password: string;
  fullName: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  defaultLocationId: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const emptyForm: UserForm = {
  username: '',
  password: '',
  fullName: '',
  email: '',
  role: 'viewer',
  defaultLocationId: '',
};

const roleLabels: Record<string, string> = {
  admin: 'Yönetici',
  operator: 'Operatör',
  viewer: 'İzleyici',
};

const roleColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  operator: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  viewer: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

let toastCounter = 0;

/* ---------- Component ---------- */

export const UsersPage = () => {
  /* ---- Data state ---- */
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);

  /* ---- Modal state ---- */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  /* ---- Delete dialog ---- */
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ---- Toasts ---- */
  const [toasts, setToasts] = useState<Toast[]>([]);

  /* ---------- Toast helper ---------- */

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  /* ---------- Fetch ---------- */

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<User[]>('/users');
      setUsers(res.data);
    } catch {
      showToast('Kullanıcılar yüklenirken hata oluştu.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchUsers();
    api.get<Location[]>('/locations').then((res) => {
      const list = Array.isArray(res.data) ? res.data : (res.data as any).data || [];
      setLocations(list);
    }).catch(() => { /* ignore */ });
  }, [fetchUsers]);

  /* ---------- Modal open helpers ---------- */

  const openAddModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setEditingId(u.id);
    setForm({
      username: u.username,
      password: '',
      fullName: u.fullName,
      email: u.email ?? '',
      role: u.role,
      defaultLocationId: u.defaultLocationId ?? '',
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
    if (!form.username.trim() || !form.fullName.trim()) {
      showToast('Kullanıcı adı ve Ad Soyad alanları zorunludur.', 'error');
      return;
    }
    if (!editingId && form.password.length < 6) {
      showToast('Şifre en az 6 karakter olmalıdır.', 'error');
      return;
    }
    if (editingId && form.password && form.password.length < 6) {
      showToast('Şifre en az 6 karakter olmalıdır.', 'error');
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        const payload: Record<string, string | null> = {
          username: form.username.trim(),
          fullName: form.fullName.trim(),
          role: form.role,
        };
        if (form.email.trim()) payload.email = form.email.trim();
        if (form.password) payload.password = form.password;
        payload.defaultLocationId = form.defaultLocationId || null;
        await api.patch(`/users/${editingId}`, payload);
        showToast('Kullanıcı başarıyla güncellendi.', 'success');
      } else {
        const payload: Record<string, string | null> = {
          username: form.username.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          role: form.role,
        };
        if (form.email.trim()) payload.email = form.email.trim();
        payload.defaultLocationId = form.defaultLocationId || null;
        await api.post('/users', payload);
        showToast('Kullanıcı başarıyla eklendi.', 'success');
      }
      closeModal();
      fetchUsers();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        (editingId ? 'Kullanıcı güncellenirken hata oluştu.' : 'Kullanıcı eklenirken hata oluştu.');
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
      await api.delete(`/users/${deleteTarget.id}`);
      showToast('Kullanıcı başarıyla silindi.', 'success');
      setDeleteTarget(null);
      fetchUsers();
    } catch {
      showToast('Kullanıcı silinirken hata oluştu.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  /* ---------- Form field updater ---------- */

  const updateField = (field: keyof UserForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

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
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
                Kullanıcı Yönetimi
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {users.length} kullanıcı
              </p>
            </div>
          </div>

          <div className="sm:ml-auto">
            <button
              onClick={openAddModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#0078d4] hover:bg-[#106eba] text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Kullanıcı</span>
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
                  Kullanıcı
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden sm:table-cell">
                  E-posta
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                  Rol
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                  Durum
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-right">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
                      <div className="w-8 h-8 border-2 border-gray-300 dark:border-gray-600 border-t-[#0078d4] rounded-full animate-spin" />
                      <span className="text-sm">Yükleniyor...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
                      <Shield className="w-10 h-10" />
                      <span className="text-sm">Henüz kullanıcı kaydı yok.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {u.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {u.fullName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            @{u.username}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 hidden sm:table-cell">
                      {u.email || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          roleColors[u.role] || roleColors.viewer
                        }`}
                      >
                        {roleLabels[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.isActive
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {u.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(u)}
                          title="Düzenle"
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 hover:text-[#0078d4] transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(u)}
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
      </div>

      {/* ---- Add / Edit Modal ---- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />

          <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                {editingId ? (
                  <>
                    <Edit className="w-5 h-5 text-[#0078d4]" />
                    Kullanıcı Düzenle
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5 text-[#0078d4]" />
                    Yeni Kullanıcı
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
              {/* Row: username, fullName */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Kullanıcı Adı"
                  required
                  value={form.username}
                  onChange={(v) => updateField('username', v)}
                  disabled={!!editingId}
                />
                <FormField
                  label="Ad Soyad"
                  required
                  value={form.fullName}
                  onChange={(v) => updateField('fullName', v)}
                />
              </div>

              {/* Password */}
              <FormField
                label={editingId ? 'Yeni Şifre' : 'Şifre'}
                required={!editingId}
                type="password"
                value={form.password}
                onChange={(v) => updateField('password', v)}
                placeholder={editingId ? 'Değiştirmek için doldurun' : 'En az 6 karakter'}
              />

              {/* Email */}
              <FormField
                label="E-posta"
                type="email"
                value={form.email}
                onChange={(v) => updateField('email', v)}
              />

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rol <span className="text-red-500 ml-0.5">*</span>
                </label>
                <select
                  value={form.role}
                  onChange={(e) => updateField('role', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent"
                >
                  <option value="admin">Yönetici</option>
                  <option value="operator">Operatör</option>
                  <option value="viewer">İzleyici</option>
                </select>
              </div>

              {/* Default Location (for operator role) */}
              {(form.role === 'operator' || form.role === 'admin') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Varsayılan Lokasyon
                  </label>
                  <select
                    value={form.defaultLocationId}
                    onChange={(e) => updateField('defaultLocationId', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent"
                  >
                    <option value="">Seçilmedi</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Operatör panelinde bu lokasyondaki cihazlar öncelikli gösterilir
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
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
                  Kullanıcıyı Sil
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {deleteTarget.fullName}
                  </span>{' '}
                  ({deleteTarget.username}) kullanıcısını silmek istediğinize emin misiniz?
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
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
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
      disabled={disabled}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
    />
  </div>
);

export default UsersPage;
