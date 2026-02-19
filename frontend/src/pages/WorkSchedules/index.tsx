import { useEffect, useState, useCallback } from 'react';
import { Clock, Plus, Edit, Trash2, X, ToggleLeft, ToggleRight, MapPin } from 'lucide-react';
import { api } from '../../services/api';
import type { WorkSchedule } from '../../types';

interface ScheduleForm {
  name: string;
  workStartTime: string;
  workEndTime: string;
  isFlexible: boolean;
  flexGraceMinutes: number;
  calculationMode: 'firstLast' | 'paired';
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const emptyForm: ScheduleForm = {
  name: '',
  workStartTime: '08:00',
  workEndTime: '17:00',
  isFlexible: false,
  flexGraceMinutes: 60,
  calculationMode: 'firstLast',
};

export const WorkSchedulesPage = () => {
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [search, setSearch] = useState('');

  const toast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/work-schedules');
      setSchedules(res.data);
    } catch {
      toast('Mesai programları yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (s: WorkSchedule) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      workStartTime: s.workStartTime,
      workEndTime: s.workEndTime,
      isFlexible: s.isFlexible,
      flexGraceMinutes: s.flexGraceMinutes || 60,
      calculationMode: s.calculationMode || 'firstLast',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.workStartTime || !form.workEndTime) return;
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        workStartTime: form.workStartTime,
        workEndTime: form.workEndTime,
        isFlexible: form.isFlexible,
        flexGraceMinutes: form.isFlexible ? form.flexGraceMinutes : null,
        calculationMode: form.calculationMode,
      };
      if (editingId) {
        await api.patch(`/work-schedules/${editingId}`, payload);
        toast('Mesai programı güncellendi', 'success');
      } else {
        await api.post('/work-schedules', payload);
        toast('Mesai programı oluşturuldu', 'success');
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast(err.response?.data?.message || 'İşlem başarısız', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (s: WorkSchedule) => {
    if (!confirm(`"${s.name}" programını silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/work-schedules/${s.id}`);
      toast('Mesai programı silindi', 'success');
      fetchData();
    } catch (err: any) {
      toast(err.response?.data?.message || 'Silme başarısız', 'error');
    }
  };

  const filtered = schedules.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="h-7 w-7 text-blue-600" />
            Mesai Programları
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Mesai şablonları oluşturun ve lokasyonlara atayın
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Yeni Program
        </button>
      </div>

      {/* Search */}
      {schedules.length > 0 && (
        <input
          type="text"
          placeholder="Program ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {schedules.length === 0
            ? 'Henüz mesai programı oluşturulmamış'
            : 'Arama sonucu bulunamadı'}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Program Adı</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Başlangıç</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Bitiş</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Hesaplama</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Esnek Mesai</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Tolerans</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Lokasyonlar</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-gray-900 dark:text-white">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{s.workStartTime}</td>
                  <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{s.workEndTime}</td>
                  <td className="px-6 py-4">
                    {s.calculationMode === 'paired' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                        Net
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        Brüt
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {s.isFlexible ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Evet
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">Hayır</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                    {s.isFlexible && s.flexGraceMinutes ? `${s.flexGraceMinutes} dk` : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400">
                      <MapPin className="h-3.5 w-3.5" />
                      {s.locationCount || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(s)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                        title="Düzenle"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingId ? 'Mesai Programı Düzenle' : 'Yeni Mesai Programı'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Program Adı *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Standart Mesai"
                  required
                />
              </div>

              {/* Time inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Başlangıç *
                  </label>
                  <input
                    type="time"
                    value={form.workStartTime}
                    onChange={(e) => setForm({ ...form, workStartTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bitiş *
                  </label>
                  <input
                    type="time"
                    value={form.workEndTime}
                    onChange={(e) => setForm({ ...form, workEndTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              {/* Calculation mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hesaplama Modu
                </label>
                <div className="space-y-2">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      form.calculationMode === 'firstLast'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="calculationMode"
                      value="firstLast"
                      checked={form.calculationMode === 'firstLast'}
                      onChange={() => setForm({ ...form, calculationMode: 'firstLast' })}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Brüt (İlk Giriş / Son Çıkış)
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Molalar hesaba katılmaz. Toplam süre = son çıkış - ilk giriş.
                      </p>
                    </div>
                  </label>
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      form.calculationMode === 'paired'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="calculationMode"
                      value="paired"
                      checked={form.calculationMode === 'paired'}
                      onChange={() => setForm({ ...form, calculationMode: 'paired' })}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Net (Eşleştirilmiş Giriş/Çıkış)
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Her giriş-çıkış çifti ayrı hesaplanır, molalar düşülür.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Flexible toggle */}
              <div className="space-y-3">
                <div
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer"
                  onClick={() => setForm({ ...form, isFlexible: !form.isFlexible })}
                >
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Esnek Mesai</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Giriş toleransı süresince geç sayılmaz, çıkış girişe göre hesaplanır
                    </p>
                  </div>
                  {form.isFlexible ? (
                    <ToggleRight className="h-6 w-6 text-blue-600" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-gray-400" />
                  )}
                </div>

                {form.isFlexible && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Giriş Toleransı (dakika)
                    </label>
                    <input
                      type="number"
                      value={form.flexGraceMinutes}
                      onChange={(e) => setForm({ ...form, flexGraceMinutes: Number(e.target.value) })}
                      min={0}
                      max={240}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2 rounded-lg shadow-lg text-white text-sm ${
              t.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
};
