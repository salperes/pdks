import { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, Plus, Trash2, CheckCircle, Loader2, X } from 'lucide-react';
import { api } from '../../services/api';
import { formatDate } from '../../utils/date';
import DateInput from '../../components/DateInput';
import { cardClass, inputClass, btnPrimary } from './styles';

interface Holiday {
  id: string;
  date: string;
  name: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export const SettingsTatillerPage = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(true);
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [addingHoliday, setAddingHoliday] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const fetchHolidays = useCallback(async () => {
    try {
      const res = await api.get('/settings/holidays');
      setHolidays(res.data);
    } catch { /* ignore */ }
    setHolidaysLoading(false);
  }, []);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const handleAddHoliday = async () => {
    if (!newDate || !newName.trim()) return;
    setAddingHoliday(true);
    try {
      await api.post('/settings/holidays', { date: newDate, name: newName.trim() });
      setNewDate('');
      setNewName('');
      addToast('Tatil günü eklendi.', 'success');
      fetchHolidays();
    } catch {
      addToast('Tatil günü eklenemedi.', 'error');
    }
    setAddingHoliday(false);
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      await api.delete(`/settings/holidays/${id}`);
      addToast('Tatil günü silindi.', 'success');
      fetchHolidays();
    } catch {
      addToast('Tatil günü silinemedi.', 'error');
    }
  };

  const fmtHolidayDate = (d: string) => formatDate(d);

  return (
    <div className="space-y-6">
      {/* ====== Holidays ====== */}
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-[#0078d4]" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tatil Günleri
          </h2>
        </div>

        {/* Add form */}
        <div className="flex flex-wrap items-end gap-3 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Tarih
            </label>
            <DateInput
              value={newDate}
              onChange={(v) => setNewDate(v)}
              className={inputClass}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Tatil Adı
            </label>
            <input
              type="text"
              placeholder="Ör: Yılbaşı"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
          <button
            onClick={handleAddHoliday}
            disabled={addingHoliday || !newDate || !newName.trim()}
            className={btnPrimary}
          >
            {addingHoliday ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Ekle
          </button>
        </div>

        {/* Holiday list */}
        {holidaysLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            <span className="text-sm text-gray-500">Yükleniyor...</span>
          </div>
        ) : holidays.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <Calendar className="w-8 h-8 text-gray-300 dark:text-gray-600" />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Tanımlı tatil günü yok
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {holidays.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
              >
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {h.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-3">
                    {fmtHolidayDate(h.date)}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteHoliday(h.id)}
                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
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
