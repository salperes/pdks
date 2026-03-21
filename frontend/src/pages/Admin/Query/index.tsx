import { useState, useCallback, useRef } from 'react';
import {
  Search,
  User,
  CreditCard,
  LogIn,
  LogOut,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { api } from '../../../services/api';
import { formatDate, formatTime } from '../../../utils/date';

/* ─── Types ─────────────────────────────────────────── */

interface RecentLog {
  id: string;
  eventTime: string;
  direction: string | null;
  deviceName: string | null;
  locationName: string | null;
}

interface PersonResult {
  id: string;
  firstName: string;
  lastName: string;
  username: string | null;
  cardNumber: string | null;
  department: string | null;
  title: string | null;
  employeeId: string | null;
  isActive: boolean;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  lastAccessTime: string | null;
  lastDirection: string | null;
  lastDeviceName: string | null;
  totalLogs: number;
  recentLogs: RecentLog[];
}

interface CardPersonMatch {
  personnel: PersonResult;
  logs: Array<{
    id: string;
    eventTime: string;
    direction: string | null;
    deviceUserId: number | null;
    deviceName: string | null;
    locationName: string | null;
  }>;
}

interface CardResult {
  personnel: CardPersonMatch[];
  orphanLogs: Array<{
    id: string;
    eventTime: string;
    direction: string | null;
    deviceUserId: number | null;
    rawCardNo: string | null;
    deviceName: string | null;
    locationName: string | null;
  }>;
  message: string | null;
}

type Mode = 'person' | 'card';

/* ─── Helpers ────────────────────────────────────────── */

const DirIcon = ({ dir }: { dir: string | null }) =>
  dir === 'in'
    ? <LogIn className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
    : <LogOut className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />;

const DirBadge = ({ dir }: { dir: string | null }) => (
  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
    dir === 'in'
      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
      : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
  }`}>
    <DirIcon dir={dir} />
    {dir === 'in' ? 'Giriş' : 'Çıkış'}
  </span>
);

/* ─── PersonCard ─────────────────────────────────────── */

const PersonCard = ({ p }: { p: PersonResult }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
      >
        {/* Avatar */}
        {p.photoUrl ? (
          <img src={p.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#0078d4]/10 text-[#0078d4] flex items-center justify-center text-sm font-bold flex-shrink-0">
            {p.firstName.charAt(0)}{p.lastName.charAt(0)}
          </div>
        )}

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 dark:text-white">
              {p.firstName} {p.lastName}
            </span>
            {!p.isActive && (
              <span className="px-1.5 py-0.5 rounded text-xs bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400">Pasif</span>
            )}
            {p.cardNumber && (
              <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs font-mono">
                Kart: {p.cardNumber}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {p.username && <span className="text-xs text-gray-400 font-mono">{p.username}</span>}
            {p.department && <span className="text-xs text-gray-500 dark:text-gray-400">{p.department}</span>}
            {p.title && <span className="text-xs text-gray-400">{p.title}</span>}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-400">Son Geçiş</p>
            {p.lastAccessTime ? (
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {formatDate(p.lastAccessTime)} {formatTime(p.lastAccessTime)}
              </p>
            ) : (
              <p className="text-xs text-gray-400">—</p>
            )}
            {p.lastDeviceName && (
              <p className="text-xs text-gray-400">{p.lastDeviceName}</p>
            )}
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-400">Toplam</p>
            <p className="text-sm font-bold text-[#0078d4]">{p.totalLogs}</p>
          </div>
          {open
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Expanded: details + recent logs */}
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-3">
          {/* Extra info row */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            {p.employeeId && <span>Sicil: <span className="font-mono text-gray-700 dark:text-gray-300">{p.employeeId}</span></span>}
            {p.email && <span>E-posta: <span className="text-gray-700 dark:text-gray-300">{p.email}</span></span>}
            {p.phone && <span>Tel: <span className="text-gray-700 dark:text-gray-300">{p.phone}</span></span>}
            <span>ID: <span className="font-mono text-gray-400">{p.id}</span></span>
            <span className="flex items-center gap-1">
              Durum: {p.isActive
                ? <ToggleRight className="w-4 h-4 text-emerald-500 inline" />
                : <ToggleLeft className="w-4 h-4 text-gray-400 inline" />}
              <span className={p.isActive ? 'text-emerald-600' : 'text-gray-400'}>
                {p.isActive ? 'Aktif' : 'Pasif'}
              </span>
            </span>
          </div>

          {/* Recent logs */}
          <div>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
              Son {p.recentLogs.length} Geçiş
            </p>
            {p.recentLogs.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Geçiş kaydı yok</p>
            ) : (
              <div className="space-y-1">
                {p.recentLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-700/40 rounded px-2.5 py-1.5">
                    <div className="flex items-center gap-2">
                      <DirBadge dir={log.direction} />
                      <span className="text-gray-600 dark:text-gray-300">{log.deviceName || log.locationName || '—'}</span>
                    </div>
                    <span className="text-gray-400 flex-shrink-0">
                      {formatDate(log.eventTime)} {formatTime(log.eventTime)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── CardResultView ─────────────────────────────────── */

const CardResultView = ({ result, cardNum }: { result: CardResult; cardNum: string }) => {
  if (result.personnel.length === 0 && result.orphanLogs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
        <AlertCircle className="w-10 h-10" />
        <p className="text-sm">{result.message || 'Kart bulunamadı'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {result.message && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
          {result.message}
        </div>
      )}

      {result.personnel.map(({ personnel: p, logs }) => (
        <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#0078d4]/10 text-[#0078d4] flex items-center justify-center text-sm font-bold flex-shrink-0">
              {p.firstName.charAt(0)}{p.lastName.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{p.firstName} {p.lastName}</p>
              <div className="flex gap-2 flex-wrap text-xs text-gray-400 mt-0.5">
                {p.username && <span className="font-mono">{p.username}</span>}
                {p.department && <span>{p.department}</span>}
                <span className="font-mono text-[#0078d4]">Kart: {cardNum}</span>
                {!p.isActive && <span className="px-1 bg-gray-200 dark:bg-gray-600 text-gray-500 rounded">Pasif</span>}
              </div>
            </div>
          </div>

          {logs.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-400 italic">Geçiş kaydı yok</p>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between px-4 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <div className="flex items-center gap-2">
                    <DirBadge dir={log.direction} />
                    <span className="text-gray-600 dark:text-gray-300">{log.deviceName || '—'}</span>
                    {log.locationName && <span className="text-gray-400">{log.locationName}</span>}
                  </div>
                  <span className="text-gray-400 flex-shrink-0">
                    {formatDate(log.eventTime)} {formatTime(log.eventTime)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {result.orphanLogs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-700 overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
              Bağlantısız Geçişler (kart personele atanmamış)
            </p>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {result.orphanLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between px-4 py-2 text-xs">
                <div className="flex items-center gap-2">
                  {log.direction && <DirBadge dir={log.direction} />}
                  <span className="text-gray-600 dark:text-gray-300">{log.deviceName || '—'}</span>
                  {log.deviceUserId != null && (
                    <span className="text-gray-400 font-mono">UID:{log.deviceUserId}</span>
                  )}
                </div>
                <span className="text-gray-400">{formatDate(log.eventTime)} {formatTime(log.eventTime)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Main component ─────────────────────────────────── */

export const QueryPage = () => {
  const [mode, setMode] = useState<Mode>('person');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personResults, setPersonResults] = useState<PersonResult[] | null>(null);
  const [cardResult, setCardResult] = useState<CardResult | null>(null);
  const [lastCardNum, setLastCardNum] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const run = useCallback(async () => {
    const q = input.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setPersonResults(null);
    setCardResult(null);

    try {
      if (mode === 'person') {
        const res = await api.get<PersonResult[]>('/query/person', { params: { q } });
        setPersonResults(res.data);
      } else {
        const res = await api.get<CardResult>('/query/card', { params: { number: q } });
        setCardResult(res.data);
        setLastCardNum(q);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Sorgu sırasında hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [mode, input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') run();
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setInput('');
    setPersonResults(null);
    setCardResult(null);
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const hasResults = personResults !== null || cardResult !== null;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
            <Search className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Detaylı Sorgu</h1>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => switchMode('person')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'person'
                ? 'bg-violet-600 text-white'
                : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <User className="w-4 h-4" />
            Kişi / Kullanıcı Adı
          </button>
          <button
            onClick={() => switchMode('card')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'card'
                ? 'bg-violet-600 text-white'
                : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Kart Numarası
          </button>
        </div>

        {/* Search input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            {mode === 'person'
              ? <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              : <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />}
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === 'person'
                  ? 'Ad, soyad, kullanıcı adı veya kart numarası...'
                  : 'Kart numarası (örn: 4879110)...'
              }
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={run}
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Sorgula
          </button>
        </div>

        {/* Hint */}
        <p className="mt-2 text-xs text-gray-400">
          {mode === 'person'
            ? 'Birden fazla kişi eşleşirse hepsi listelenir. Başlığa tıklayarak detayları açın.'
            : 'Kart numarasına atanmış personeli ve son 20 geçişini gösterir.'}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {hasResults && !loading && (
        <div>
          {mode === 'person' && personResults !== null && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {personResults.length === 0
                  ? 'Eşleşen kayıt bulunamadı.'
                  : `${personResults.length} sonuç bulundu`}
              </p>
              {personResults.map((p) => (
                <PersonCard key={p.id} p={p} />
              ))}
            </div>
          )}

          {mode === 'card' && cardResult !== null && (
            <CardResultView result={cardResult} cardNum={lastCardNum} />
          )}
        </div>
      )}

      {/* Empty state */}
      {!hasResults && !loading && !error && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 flex flex-col items-center gap-3 text-gray-400">
          {mode === 'person'
            ? <User className="w-12 h-12 opacity-30" />
            : <CreditCard className="w-12 h-12 opacity-30" />}
          <div className="text-center">
            <p className="text-sm font-medium">
              {mode === 'person' ? 'Kişi adı veya kart numarası girin' : 'Kart numarası girin'}
            </p>
            <p className="text-xs mt-1">
              {mode === 'person'
                ? 'Örn: "Kaan", "kaan.dilitatli", "4879110"'
                : 'Örn: 4879110'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {mode === 'person' && (
              <>
                {['Kaan', 'Ahmet', 'admin'].map((ex) => (
                  <button key={ex} onClick={() => { setInput(ex); setTimeout(run, 0); }}
                    className="px-3 py-1 rounded-full border border-gray-200 dark:border-gray-600 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    {ex}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QueryPage;
