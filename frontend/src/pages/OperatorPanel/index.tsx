import { useEffect, useState, useCallback, useRef } from 'react';
import {
  CreditCard,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  XCircle,
  Clock,
  MapPin,
  User as UserIcon,
  History,
  Camera,
  RotateCcw,
  ClipboardList,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatDateTime } from '../../utils/date';
import type { Personnel, Device, Location, TempCardAssignment, AccessLog } from '../../types';

/* ---------- Types ---------- */

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface DeviceOption {
  id: string;
  name: string;
  ipAddress: string;
  direction: string;
  locationId?: string;
  locationName?: string;
}

interface MyLocationResp {
  location: Location | null;
  devices: DeviceOption[];
}

interface HistoryResp {
  data: TempCardAssignment[];
  total: number;
  page: number;
  limit: number;
}

interface AccessLogResp {
  data: AccessLog[];
  total: number;
  page: number;
  limit: number;
}

let toastCounter = 0;

const reasonLabels: Record<string, string> = {
  forgot_card: 'Personel',
  guest: 'Misafir',
};

const statusLabels: Record<string, string> = {
  active: 'Aktif',
  expired: 'Süresi Doldu',
  revoked: 'İptal Edildi',
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  expired: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  revoked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const docTypeLabels: Record<string, string> = {
  kimlik: 'Kimlik',
  ehliyet: 'Ehliyet',
  pasaport: 'Pasaport',
};

const EXPIRY_OPTIONS = [
  { label: '09:00', value: '09:00' },
  { label: '12:00', value: '12:00' },
  { label: '15:00', value: '15:00' },
  { label: '18:00', value: '18:00' },
];

type ViewTab = 'guest' | 'personnel' | 'return' | 'access-logs';

const TABS: { key: ViewTab; label: string; icon: typeof CreditCard }[] = [
  { key: 'guest', label: 'Misafir Geçici Kart', icon: CreditCard },
  { key: 'personnel', label: 'Personel Geçici Kart', icon: UserIcon },
  { key: 'return', label: 'Kart Geri Verme', icon: RotateCcw },
  { key: 'access-logs', label: 'Geçiş Kayıtları', icon: ClipboardList },
];

/* ---------- Component ---------- */

export const OperatorPanelPage = () => {
  /* ---- Main tab ---- */
  const [view, setView] = useState<ViewTab>('guest');

  /* ---- Data state ---- */
  const [activeAssignments, setActiveAssignments] = useState<TempCardAssignment[]>([]);
  const [historyData, setHistoryData] = useState<TempCardAssignment[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);

  /* ---- Return sub-tab ---- */
  const [returnSubTab, setReturnSubTab] = useState<'active' | 'history'>('active');

  /* ---- My location ---- */
  const [myLocation, setMyLocation] = useState<MyLocationResp | null>(null);

  /* ---- All devices for form ---- */
  const [allDevices, setAllDevices] = useState<Device[]>([]);

  /* ---- Revoking ---- */
  const [revokingId, setRevokingId] = useState<string | null>(null);

  /* ---- Form state (shared) ---- */
  const [tempCardNumber, setTempCardNumber] = useState('');
  const [expiryTime, setExpiryTime] = useState('18:00');
  const [documentType, setDocumentType] = useState('');
  const [shelfNo, setShelfNo] = useState('');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  /* ---- Guest form state ---- */
  const [guestFirstName, setGuestFirstName] = useState('');
  const [guestLastName, setGuestLastName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [visitedPersonnel, setVisitedPersonnel] = useState<Personnel | null>(null);
  const [visitedSearch, setVisitedSearch] = useState('');
  const [visitedResults, setVisitedResults] = useState<Personnel[]>([]);
  const [visitedSearchLoading, setVisitedSearchLoading] = useState(false);
  const [visitReason, setVisitReason] = useState('');

  /* ---- Personnel form state ---- */
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [personnelSearch, setPersonnelSearch] = useState('');
  const [personnelResults, setPersonnelResults] = useState<Personnel[]>([]);
  const [personnelSearchLoading, setPersonnelSearchLoading] = useState(false);

  /* ---- Access logs state ---- */
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [accessLogsTotal, setAccessLogsTotal] = useState(0);
  const [accessLogsPage, setAccessLogsPage] = useState(1);
  const [accessLogsSearch, setAccessLogsSearch] = useState('');
  const [accessLogsDate, setAccessLogsDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [accessLogsLoading, setAccessLogsLoading] = useState(false);

  /* ---- Toast ---- */
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  /* ---------- Fetch helpers ---------- */

  const fetchActive = useCallback(async (locationId?: string) => {
    try {
      const params: Record<string, string> = { status: 'active' };
      if (locationId) params.locationId = locationId;
      const res = await api.get<TempCardAssignment[]>('/operator-panel/temp-cards', { params });
      setActiveAssignments(res.data);
    } catch {
      showToast('Aktif kartlar yüklenemedi.', 'error');
    }
  }, [showToast]);

  const fetchHistory = useCallback(
    async (pg: number) => {
      try {
        const res = await api.get<HistoryResp>('/operator-panel/temp-cards/history', {
          params: { page: pg, limit: 20 },
        });
        setHistoryData(res.data.data);
        setHistoryTotal(res.data.total);
        setHistoryPage(res.data.page);
      } catch {
        showToast('Geçmiş yüklenemedi.', 'error');
      }
    },
    [showToast],
  );

  const fetchMyLocation = useCallback(async () => {
    try {
      const res = await api.get<MyLocationResp>('/operator-panel/my-location');
      setMyLocation(res.data);
    } catch { /* ignore */ }
  }, []);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await api.get('/devices');
      const list = Array.isArray(res.data) ? res.data : res.data.data || [];
      setAllDevices(list.filter((d: Device) => d.isActive));
    } catch { /* ignore */ }
  }, []);

  const fetchAccessLogs = useCallback(async (pg: number, search: string, date: string, locationId: string) => {
    setAccessLogsLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(pg),
        limit: '50',
        locationId,
        startDate: `${date}T00:00:00`,
        endDate: `${date}T23:59:59`,
      };
      if (search.trim()) params.search = search.trim();
      const res = await api.get<AccessLogResp>('/access-logs', { params });
      setAccessLogs(res.data.data);
      setAccessLogsTotal(res.data.total);
      setAccessLogsPage(res.data.page);
    } catch {
      showToast('Geçiş kayıtları yüklenemedi.', 'error');
    } finally {
      setAccessLogsLoading(false);
    }
  }, [showToast]);

  /* ---- Initial load ---- */
  useEffect(() => {
    Promise.all([fetchActive(), fetchMyLocation(), fetchDevices()]);
  }, [fetchActive, fetchMyLocation, fetchDevices]);

  /* ---- Set default device selection after myLocation loads ---- */
  useEffect(() => {
    if (myLocation?.devices && selectedDeviceIds.size === 0) {
      setSelectedDeviceIds(new Set(myLocation.devices.map((d) => d.id)));
    }
  }, [myLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- History fetch (when return tab + history sub-tab) ---- */
  useEffect(() => {
    if (view === 'return' && returnSubTab === 'history') fetchHistory(historyPage);
  }, [view, returnSubTab, historyPage, fetchHistory]);

  /* ---- Re-fetch active when switching to return tab ---- */
  useEffect(() => {
    if (view === 'return' && returnSubTab === 'active') {
      fetchActive(myLocation?.location?.id);
    }
  }, [view, returnSubTab, fetchActive, myLocation]);

  /* ---- Access logs fetch ---- */
  useEffect(() => {
    if (view === 'access-logs' && myLocation?.location?.id) {
      fetchAccessLogs(accessLogsPage, accessLogsSearch, accessLogsDate, myLocation.location.id);
    }
  }, [view, accessLogsPage, accessLogsDate, myLocation, fetchAccessLogs]); // search is triggered manually

  /* ---- Access logs auto-refresh (30s) ---- */
  useEffect(() => {
    if (view !== 'access-logs' || !myLocation?.location?.id) return;
    const interval = setInterval(() => {
      fetchAccessLogs(accessLogsPage, accessLogsSearch, accessLogsDate, myLocation.location!.id);
    }, 30_000);
    return () => clearInterval(interval);
  }, [view, accessLogsPage, accessLogsSearch, accessLogsDate, myLocation, fetchAccessLogs]);

  /* ---------- Revoke ---------- */

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await api.post(`/operator-panel/temp-card/${id}/revoke`);
      showToast('Geçici kart iptal edildi.', 'success');
      fetchActive(myLocation?.location?.id);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'İptal edilemedi.', 'error');
    } finally {
      setRevokingId(null);
    }
  };

  /* ---------- Reset form ---------- */

  const resetForm = () => {
    setTempCardNumber('');
    setExpiryTime('18:00');
    setDocumentType('');
    setShelfNo('');
    setGuestFirstName('');
    setGuestLastName('');
    setGuestPhone('');
    setVisitedPersonnel(null);
    setVisitedSearch('');
    setVisitReason('');
    setSelectedPersonnel(null);
    setPersonnelSearch('');
  };

  /* ---------- Submit ---------- */

  const handleSubmit = async () => {
    if (view === 'guest') {
      if (!guestFirstName.trim() || !guestLastName.trim()) {
        showToast('Misafir adı ve soyadı zorunludur.', 'error');
        return;
      }
    } else {
      if (!selectedPersonnel) {
        showToast('Personel seçiniz.', 'error');
        return;
      }
    }
    if (!tempCardNumber.trim()) {
      showToast('Kart numarası zorunludur.', 'error');
      return;
    }
    if (selectedDeviceIds.size === 0) {
      showToast('En az bir cihaz seçiniz.', 'error');
      return;
    }

    const now = new Date();
    const [hh, mm] = expiryTime.split(':').map(Number);
    const expiresAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0);
    if (expiresAt.getTime() < Date.now()) {
      expiresAt.setDate(expiresAt.getDate() + 1);
    }

    const body: Record<string, any> = {
      tempCardNumber: tempCardNumber.trim(),
      reason: view === 'guest' ? 'guest' : 'forgot_card',
      deviceIds: Array.from(selectedDeviceIds),
      expiresAt: expiresAt.toISOString(),
    };
    if (documentType) body.documentType = documentType;
    if (shelfNo.trim()) body.shelfNo = shelfNo.trim();

    if (view === 'guest') {
      body.guestFirstName = guestFirstName.trim();
      body.guestLastName = guestLastName.trim();
      if (guestPhone.trim()) body.guestPhone = guestPhone.trim();
      if (visitedPersonnel) body.visitedPersonnelId = visitedPersonnel.id;
      if (visitReason.trim()) body.visitReason = visitReason.trim();
    } else {
      body.personnelId = selectedPersonnel!.id;
    }

    setSaving(true);
    try {
      const res = await api.post('/operator-panel/temp-card', body);
      const dr = res.data.deviceResults || [];
      const failCount = dr.filter((r: any) => !r.success).length;
      if (failCount > 0) {
        showToast(`Kart verildi. ${failCount} cihazda hata oluştu.`, 'error');
      } else {
        showToast('Geçici kart başarıyla verildi.', 'success');
      }
      resetForm();
      fetchActive(myLocation?.location?.id);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Kart verilemedi.', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Group devices by location ---------- */

  const groupedDevices = (() => {
    const groups: { locationName: string; locationId: string | null; isMyLocation: boolean; devices: Device[] }[] = [];
    const locMap = new Map<string, { name: string; devices: Device[] }>();

    for (const d of allDevices) {
      const locId = d.locationId || '__none__';
      const locName = d.location?.name || 'Lokasyonsuz';
      if (!locMap.has(locId)) locMap.set(locId, { name: locName, devices: [] });
      locMap.get(locId)!.devices.push(d);
    }

    const myLocId = myLocation?.location?.id;
    for (const [locId, { name, devices }] of locMap) {
      groups.push({
        locationName: name,
        locationId: locId === '__none__' ? null : locId,
        isMyLocation: !!myLocId && locId === myLocId,
        devices,
      });
    }
    groups.sort((a, b) => {
      if (a.isMyLocation && !b.isMyLocation) return -1;
      if (!a.isMyLocation && b.isMyLocation) return 1;
      return a.locationName.localeCompare(b.locationName, 'tr');
    });
    return groups;
  })();

  const toggleDevice = (id: string) => {
    setSelectedDeviceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ---------- Access logs search handler ---------- */
  const handleAccessLogsSearch = () => {
    if (myLocation?.location?.id) {
      setAccessLogsPage(1);
      fetchAccessLogs(1, accessLogsSearch, accessLogsDate, myLocation.location.id);
    }
  };

  /* ---------- Render ---------- */

  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / 20));
  const accessLogsTotalPages = Math.max(1, Math.ceil(accessLogsTotal / 50));

  return (
    <div className="space-y-4">
      {/* Toasts */}
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

      {/* Top bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-orange-600 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Operatör Paneli</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {myLocation?.location?.name || 'Lokasyon atanmamış'} &middot; {activeAssignments.length} aktif kart
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = view === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setView(tab.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-orange-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============ TAB CONTENT ============ */}

      {(view === 'guest' || view === 'personnel') && (
        <FormSection
          view={view}
          /* Guest */
          guestFirstName={guestFirstName} setGuestFirstName={setGuestFirstName}
          guestLastName={guestLastName} setGuestLastName={setGuestLastName}
          guestPhone={guestPhone} setGuestPhone={setGuestPhone}
          visitedPersonnel={visitedPersonnel} setVisitedPersonnel={setVisitedPersonnel}
          visitedSearch={visitedSearch} setVisitedSearch={setVisitedSearch}
          visitedResults={visitedResults} setVisitedResults={setVisitedResults}
          visitedSearchLoading={visitedSearchLoading} setVisitedSearchLoading={setVisitedSearchLoading}
          visitReason={visitReason} setVisitReason={setVisitReason}
          /* Personnel */
          selectedPersonnel={selectedPersonnel} setSelectedPersonnel={setSelectedPersonnel}
          personnelSearch={personnelSearch} setPersonnelSearch={setPersonnelSearch}
          personnelResults={personnelResults} setPersonnelResults={setPersonnelResults}
          personnelSearchLoading={personnelSearchLoading} setPersonnelSearchLoading={setPersonnelSearchLoading}
          /* Shared */
          documentType={documentType} setDocumentType={setDocumentType}
          shelfNo={shelfNo} setShelfNo={setShelfNo}
          expiryTime={expiryTime} setExpiryTime={setExpiryTime}
          tempCardNumber={tempCardNumber} setTempCardNumber={setTempCardNumber}
          selectedDeviceIds={selectedDeviceIds} toggleDevice={toggleDevice}
          groupedDevices={groupedDevices}
          saving={saving} onSubmit={handleSubmit}
        />
      )}

      {view === 'return' && (
        <ReturnSection
          returnSubTab={returnSubTab} setReturnSubTab={setReturnSubTab}
          activeAssignments={activeAssignments}
          historyData={historyData} historyTotal={historyTotal} historyPage={historyPage}
          historyTotalPages={historyTotalPages} setHistoryPage={setHistoryPage}
          revokingId={revokingId} onRevoke={handleRevoke}
        />
      )}

      {view === 'access-logs' && (
        <AccessLogsSection
          myLocation={myLocation}
          accessLogs={accessLogs}
          accessLogsTotal={accessLogsTotal}
          accessLogsPage={accessLogsPage}
          accessLogsTotalPages={accessLogsTotalPages}
          setAccessLogsPage={setAccessLogsPage}
          accessLogsSearch={accessLogsSearch}
          setAccessLogsSearch={setAccessLogsSearch}
          accessLogsDate={accessLogsDate}
          setAccessLogsDate={setAccessLogsDate}
          accessLogsLoading={accessLogsLoading}
          onSearch={handleAccessLogsSearch}
          onRefresh={() => {
            if (myLocation?.location?.id)
              fetchAccessLogs(accessLogsPage, accessLogsSearch, accessLogsDate, myLocation.location.id);
          }}
        />
      )}
    </div>
  );
};

/* ================================================================== */
/* FormSection — Guest / Personnel form                                */
/* ================================================================== */

interface FormSectionProps {
  view: 'guest' | 'personnel';
  guestFirstName: string; setGuestFirstName: (v: string) => void;
  guestLastName: string; setGuestLastName: (v: string) => void;
  guestPhone: string; setGuestPhone: (v: string) => void;
  visitedPersonnel: Personnel | null; setVisitedPersonnel: (v: Personnel | null) => void;
  visitedSearch: string; setVisitedSearch: (v: string) => void;
  visitedResults: Personnel[]; setVisitedResults: (v: Personnel[]) => void;
  visitedSearchLoading: boolean; setVisitedSearchLoading: (v: boolean) => void;
  visitReason: string; setVisitReason: (v: string) => void;
  selectedPersonnel: Personnel | null; setSelectedPersonnel: (v: Personnel | null) => void;
  personnelSearch: string; setPersonnelSearch: (v: string) => void;
  personnelResults: Personnel[]; setPersonnelResults: (v: Personnel[]) => void;
  personnelSearchLoading: boolean; setPersonnelSearchLoading: (v: boolean) => void;
  documentType: string; setDocumentType: (v: string) => void;
  shelfNo: string; setShelfNo: (v: string) => void;
  expiryTime: string; setExpiryTime: (v: string) => void;
  tempCardNumber: string; setTempCardNumber: (v: string) => void;
  selectedDeviceIds: Set<string>; toggleDevice: (id: string) => void;
  groupedDevices: { locationName: string; locationId: string | null; isMyLocation: boolean; devices: Device[] }[];
  saving: boolean; onSubmit: () => void;
}

const FormSection = (p: FormSectionProps) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
    <div className="p-5 space-y-4">
      {p.view === 'guest' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FieldInput label="Adı" required value={p.guestFirstName} onChange={p.setGuestFirstName} />
            <FieldInput label="Soyadı" required value={p.guestLastName} onChange={p.setGuestLastName} />
            <FieldInput label="Telefon No" value={p.guestPhone} onChange={p.setGuestPhone} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teslim Edilen Kimlik Belgesi</label>
              <select value={p.documentType} onChange={(e) => p.setDocumentType(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                <option value="">Seçiniz</option>
                <option value="kimlik">Kimlik</option>
                <option value="ehliyet">Ehliyet</option>
                <option value="pasaport">Pasaport</option>
              </select>
            </div>
            <FieldInput label="Raf No" value={p.shelfNo} onChange={p.setShelfNo} />
          </div>
          <PersonnelSearchField
            label="Ziyaret Edilen Personel" search={p.visitedSearch} onSearchChange={p.setVisitedSearch}
            results={p.visitedResults} setResults={p.setVisitedResults}
            selected={p.visitedPersonnel}
            onSelect={(per) => { p.setVisitedPersonnel(per); p.setVisitedSearch(''); p.setVisitedResults([]); }}
            onClear={() => p.setVisitedPersonnel(null)}
            loading={p.visitedSearchLoading} setLoading={p.setVisitedSearchLoading}
            placeholder="Ad ve/veya soyadı ile arayın..."
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ziyaret Nedeni</label>
            <textarea value={p.visitReason} onChange={(e) => p.setVisitReason(e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none" />
          </div>
        </>
      ) : (
        <div className="flex gap-4">
          <div className="flex-1 space-y-4">
            <PersonnelSearchField
              label="Personel" required search={p.personnelSearch} onSearchChange={p.setPersonnelSearch}
              results={p.personnelResults} setResults={p.setPersonnelResults}
              selected={p.selectedPersonnel}
              onSelect={(per) => { p.setSelectedPersonnel(per); p.setPersonnelSearch(''); p.setPersonnelResults([]); }}
              onClear={() => p.setSelectedPersonnel(null)}
              loading={p.personnelSearchLoading} setLoading={p.setPersonnelSearchLoading}
              placeholder="Ad ve/veya soyadı ile arayın..."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teslim Edilen Kimlik Belgesi</label>
                <select value={p.documentType} onChange={(e) => p.setDocumentType(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                  <option value="">Seçiniz</option>
                  <option value="kimlik">Kimlik</option>
                  <option value="ehliyet">Ehliyet</option>
                  <option value="pasaport">Pasaport</option>
                </select>
              </div>
              <FieldInput label="Raf No" value={p.shelfNo} onChange={p.setShelfNo} />
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-center gap-2 pt-6">
            <div className="w-36 h-[168px] rounded-lg bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 flex items-center justify-center overflow-hidden">
              {p.selectedPersonnel?.photoUrl ? (
                <img src={p.selectedPersonnel.photoUrl} alt="Foto" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-12 h-12 text-gray-300 dark:text-gray-500" />
              )}
            </div>
            {p.selectedPersonnel && (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-36 truncate">
                {p.selectedPersonnel.firstName} {p.selectedPersonnel.lastName}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Shared fields */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bitiş Zamanı <span className="text-red-500">*</span></label>
            <select value={p.expiryTime} onChange={(e) => p.setExpiryTime(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
              {EXPIRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <FieldInput label="Kart No" required value={p.tempCardNumber} onChange={p.setTempCardNumber} placeholder="Kartın seri no / ID" />
          <div className="flex items-end pb-1">
            <span className="text-sm text-gray-500 dark:text-gray-400">{p.selectedDeviceIds.size} cihaz seçili</span>
          </div>
        </div>

        {/* Device selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Cihazlar <span className="text-red-500">*</span></label>
          <div className="border border-gray-200 dark:border-gray-600 rounded-lg max-h-40 overflow-y-auto">
            {p.groupedDevices.length === 0 ? (
              <p className="p-3 text-sm text-gray-400 text-center">Aktif cihaz bulunamadı</p>
            ) : (
              p.groupedDevices.map((group) => (
                <div key={group.locationId || 'none'}>
                  <div className="sticky top-0 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{group.locationName}</span>
                    {group.isMyLocation && (
                      <span className="text-xs bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 rounded-full font-medium">Lokasyonum</span>
                    )}
                  </div>
                  {group.devices.map((d) => (
                    <label key={d.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                      <input type="checkbox" checked={p.selectedDeviceIds.has(d.id)} onChange={() => p.toggleDevice(d.id)}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-orange-600 focus:ring-orange-500" />
                      <span className="text-sm text-gray-900 dark:text-white">{d.name}</span>
                      <span className="text-xs text-gray-400 ml-auto">{d.ipAddress}</span>
                    </label>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={p.onSubmit} disabled={p.saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {p.saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <CreditCard className="w-4 h-4" />
            Kart Ver
          </button>
        </div>
      </div>
    </div>
  </div>
);

/* ================================================================== */
/* ReturnSection — Kart Geri Verme + Geçmiş                           */
/* ================================================================== */

interface ReturnSectionProps {
  returnSubTab: 'active' | 'history';
  setReturnSubTab: (v: 'active' | 'history') => void;
  activeAssignments: TempCardAssignment[];
  historyData: TempCardAssignment[];
  historyTotal: number;
  historyPage: number;
  historyTotalPages: number;
  setHistoryPage: (fn: (p: number) => number) => void;
  revokingId: string | null;
  onRevoke: (id: string) => void;
}

const ReturnSection = ({
  returnSubTab, setReturnSubTab,
  activeAssignments, historyData, historyTotal, historyPage, historyTotalPages, setHistoryPage,
  revokingId, onRevoke,
}: ReturnSectionProps) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
    {/* Sub-tabs */}
    <div className="flex border-b border-gray-200 dark:border-gray-700">
      <button onClick={() => setReturnSubTab('active')}
        className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${returnSubTab === 'active' ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
        Aktif Kartlar ({activeAssignments.length})
        {returnSubTab === 'active' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600" />}
      </button>
      <button onClick={() => setReturnSubTab('history')}
        className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${returnSubTab === 'history' ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
        <span className="inline-flex items-center gap-1.5"><History className="w-4 h-4" /> Geçmiş</span>
        {returnSubTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600" />}
      </button>
    </div>

    {returnSubTab === 'active' ? (
      /* Active cards table */
      <div className="overflow-x-auto">
        {activeAssignments.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <CreditCard className="w-10 h-10" />
              <span className="text-sm">Aktif geçici kart yok.</span>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <th className="px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Kişi</th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Kart No</th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300 hidden md:table-cell">Tür</th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300 hidden md:table-cell">Belge</th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300 hidden lg:table-cell">Raf</th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300 hidden lg:table-cell">Bitiş</th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {activeAssignments.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {a.personnel ? `${a.personnel.firstName} ${a.personnel.lastName}` : '-'}
                    </div>
                    {a.reason === 'guest' && a.visitedPersonnel && (
                      <div className="text-xs text-gray-400">Ziyaret: {a.visitedPersonnel.firstName} {a.visitedPersonnel.lastName}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-300">{a.tempCardNumber}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${a.reason === 'guest' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                      {reasonLabels[a.reason] || a.reason}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 hidden md:table-cell">{a.documentType ? docTypeLabels[a.documentType] || a.documentType : '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 hidden lg:table-cell">{a.shelfNo || '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 hidden lg:table-cell">{formatDateTime(a.expiresAt)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => onRevoke(a.id)} disabled={revokingId === a.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 text-xs font-medium transition-colors disabled:opacity-50">
                      {revokingId === a.id ? <div className="w-3 h-3 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      Geri Al
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    ) : (
      /* History table */
      <>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Kişi</th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Kart No</th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden md:table-cell">Tür</th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden md:table-cell">Belge / Raf</th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden lg:table-cell">Veren</th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden lg:table-cell">Verildi</th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {historyData.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400"><Clock className="w-10 h-10" /><span className="text-sm">Geçmiş kayıt yok.</span></div>
                </td></tr>
              ) : historyData.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{a.personnel ? `${a.personnel.firstName} ${a.personnel.lastName}` : '-'}</div>
                    {a.reason === 'guest' && a.visitedPersonnel && <div className="text-xs text-gray-400">Ziyaret: {a.visitedPersonnel.firstName} {a.visitedPersonnel.lastName}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">{a.tempCardNumber}</td>
                  <td className="px-4 py-3 hidden md:table-cell"><span className="text-xs">{reasonLabels[a.reason] || a.reason}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 hidden md:table-cell">
                    {[a.documentType ? docTypeLabels[a.documentType] || a.documentType : null, a.shelfNo ? `Raf: ${a.shelfNo}` : null].filter(Boolean).join(' / ') || '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 hidden lg:table-cell">{a.issuer?.fullName || '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 hidden lg:table-cell">{formatDateTime(a.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[a.status] || statusColors.expired}`}>
                      {statusLabels[a.status] || a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {historyTotal > 20 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Toplam {historyTotal} kayıt</span>
            <div className="flex items-center gap-1">
              <button disabled={historyPage <= 1} onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-gray-600 dark:text-gray-300">{historyPage} / {historyTotalPages}</span>
              <button disabled={historyPage >= historyTotalPages} onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </>
    )}
  </div>
);

/* ================================================================== */
/* AccessLogsSection — Geçiş Kayıtları                                 */
/* ================================================================== */

interface AccessLogsSectionProps {
  myLocation: MyLocationResp | null;
  accessLogs: AccessLog[];
  accessLogsTotal: number;
  accessLogsPage: number;
  accessLogsTotalPages: number;
  setAccessLogsPage: (p: number) => void;
  accessLogsSearch: string;
  setAccessLogsSearch: (v: string) => void;
  accessLogsDate: string;
  setAccessLogsDate: (v: string) => void;
  accessLogsLoading: boolean;
  onSearch: () => void;
  onRefresh: () => void;
}

const AccessLogsSection = ({
  myLocation, accessLogs, accessLogsTotal, accessLogsPage, accessLogsTotalPages, setAccessLogsPage,
  accessLogsSearch, setAccessLogsSearch, accessLogsDate, setAccessLogsDate, accessLogsLoading, onSearch, onRefresh,
}: AccessLogsSectionProps) => {
  if (!myLocation?.location) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <AlertCircle className="w-12 h-12" />
          <p className="text-sm font-medium">Lokasyon Atanmamış</p>
          <p className="text-xs text-center max-w-sm">Geçiş kayıtlarını görebilmek için yöneticinizden varsayılan lokasyon ataması isteyiniz.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Filters */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <MapPin className="w-4 h-4 text-orange-500" />
            <span className="font-medium">{myLocation.location.name}</span>
          </div>
          <div className="flex flex-1 gap-2 sm:ml-4">
            <input
              type="date"
              value={accessLogsDate}
              onChange={(e) => setAccessLogsDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={accessLogsSearch}
                onChange={(e) => setAccessLogsSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                placeholder="Personel ara..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <button onClick={onSearch}
              className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium transition-colors">
              Ara
            </button>
            <button onClick={onRefresh} title="Yenile"
              className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <RefreshCw className={`w-4 h-4 ${accessLogsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <th className="px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Personel</th>
              <th className="px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300 hidden md:table-cell">Cihaz</th>
              <th className="px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Zaman</th>
              <th className="px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Yön</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {accessLogs.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-16 text-center">
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <ClipboardList className="w-10 h-10" />
                  <span className="text-sm">{accessLogsLoading ? 'Yükleniyor...' : 'Geçiş kaydı bulunamadı.'}</span>
                </div>
              </td></tr>
            ) : accessLogs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {log.personnel ? `${log.personnel.firstName} ${log.personnel.lastName}` : `UID: ${log.deviceUserId || '-'}`}
                  </div>
                  {log.personnel?.department && (
                    <div className="text-xs text-gray-400">{log.personnel.department}</div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-300 hidden md:table-cell">
                  {log.device?.name || '-'}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-300">
                  {formatDateTime(log.eventTime)}
                </td>
                <td className="px-4 py-2.5">
                  {log.direction === 'in' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <ArrowDownLeft className="w-3 h-3" /> Giriş
                    </span>
                  ) : log.direction === 'out' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      <ArrowUpRight className="w-3 h-3" /> Çıkış
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {accessLogsTotal > 50 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Toplam {accessLogsTotal} kayıt</span>
          <div className="flex items-center gap-1">
            <button disabled={accessLogsPage <= 1} onClick={() => setAccessLogsPage(Math.max(1, accessLogsPage - 1))}
              className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-gray-600 dark:text-gray-300">{accessLogsPage} / {accessLogsTotalPages}</span>
            <button disabled={accessLogsPage >= accessLogsTotalPages} onClick={() => setAccessLogsPage(Math.min(accessLogsTotalPages, accessLogsPage + 1))}
              className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ================================================================== */
/* FieldInput                                                          */
/* ================================================================== */

const FieldInput = ({
  label, value, onChange, required, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string;
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
  </div>
);

/* ================================================================== */
/* PersonnelSearchField                                                */
/* ================================================================== */

interface PersonnelSearchFieldProps {
  label: string;
  search: string;
  onSearchChange: (v: string) => void;
  results: Personnel[];
  setResults: (r: Personnel[]) => void;
  selected: Personnel | null;
  onSelect: (p: Personnel) => void;
  onClear: () => void;
  loading: boolean;
  setLoading: (l: boolean) => void;
  required?: boolean;
  placeholder?: string;
  departmentFilter?: string;
}

const PersonnelSearchField = ({
  label, search, onSearchChange, results, setResults, selected, onSelect, onClear,
  loading, setLoading, required, placeholder, departmentFilter,
}: PersonnelSearchFieldProps) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    if (!search.trim()) { setResults([]); return; }
    setLoading(true);
    searchRef.current = setTimeout(async () => {
      try {
        const params: Record<string, string> = { search: search.trim(), limit: '10' };
        if (departmentFilter) params.department = departmentFilter;
        const res = await api.get('/personnel', { params });
        const data = res.data.data || res.data;
        setResults(Array.isArray(data) ? data : []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (selected) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
          <UserIcon className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-900 dark:text-white flex-1">
            {selected.firstName} {selected.lastName}
            {selected.department && <span className="text-xs text-gray-400 ml-2">({selected.department})</span>}
          </span>
          <button onClick={onClear} className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400"><X className="w-4 h-4" /></button>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" value={search}
          onChange={(e) => { onSearchChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
        {loading && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-300 border-t-orange-600 rounded-full animate-spin" />}
      </div>
      {open && search.trim() && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">{loading ? 'Aranıyor...' : 'Sonuç bulunamadı'}</p>
          ) : results.map((per) => (
            <button key={per.id} onClick={() => { onSelect(per); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors">
              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden">
                {per.photoUrl ? <img src={per.photoUrl} alt="" className="w-full h-full object-cover" /> : <>{per.firstName.charAt(0)}{per.lastName.charAt(0)}</>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{per.firstName} {per.lastName}</p>
                <p className="text-xs text-gray-400 truncate">{[per.department, per.cardNumber].filter(Boolean).join(' - ')}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default OperatorPanelPage;
