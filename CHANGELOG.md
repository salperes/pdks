# PDKS - Changelog

> Max 11 kayıt tutulur. 11 kayıt dolunca eski 1-10 arşivlenir (`temp/changelog{NNN}-{NNN}.md`),
> yeni dosya eski dosyanın son kaydıyla başlar (bağlam referansı olarak).
> Arşiv: temp/changelog_001-010.md, temp/changelog_010-020.md, temp/changelog_020-029.md, temp/changelog_028-038.md

---------------------------------------------------------
Rev. ID    : 038
Rev. Date  : 21.03.2026
Rev. Time  : 15:30:00
Rev. Prompt: Ayarlar sayfasi alt sayfalara bolundu, Denetim Gunlugu ayri menu

Rev. Report: (
  1567 satirlik tek Ayarlar sayfasi 5 alt sayfaya bolundu. Sol menude Ayarlar
  collapsible parent yapildi. Denetim Gunlugu ayri ust-duzey menu ogesi oldu.

  FRONTEND — Yeni sayfalar:
  - Settings/Genel.tsx      → /admin/settings/genel (Calisma Saatleri)
  - Settings/Bildirimler.tsx → /admin/settings/bildirimler (Mesajlasma & Bildirimler)
  - Settings/Tatiller.tsx   → /admin/settings/tatiller (Tatil Gunleri)
  - Settings/Portal.tsx     → /admin/settings/portal (Portal Entegrasyonu)
  - Settings/Sistem.tsx     → /admin/settings/sistem (Sistem Bilgisi & Yedekleme)
  - Settings/styles.ts      → Paylasilan stil sabitleri
  - DenetimGunlugu/index.tsx → /admin/denetim-gunlugu (Denetim Gunlugu - ayri parent)

  FRONTEND — Degistirilen dosyalar:
  - Settings/index.tsx → Re-export'a donusturuldu
  - App.tsx → Yeni route'lar eklendi, /admin/settings redirect edildi
  - Sidebar.tsx → NavItem children destegi, collapsible Ayarlar,
    Denetim Gunlugu ayri menu ogesi

  Degisen dosyalar: 3 (App.tsx, Sidebar.tsx, Settings/index.tsx)
  Yeni dosyalar: 7
)
---------------------------------------------------------
Rev. ID    : 039
Rev. Date  : 21.03.2026
Rev. Time  : 17:00:00
Rev. Prompt: Personel yönetimi — kolon sıralaması, kartsız personel filtresi, hatalı kayıtlar filtresi

Rev. Report: (
  Personel listesinde kolon bazlı artan/azalan sıralama, kartsız personel
  ve hatalı kayıt (mükerrer kart) filtreleri eklendi.

  BACKEND — personnel.service.ts:
  - FindAllOptions interface'e sortBy, sortDir, noCard, duplicateCards eklendi
  - findAll(): noCard filtresi (cardNumber IS NULL OR = ''), duplicateCards filtresi
    (subquery ile COUNT > 1 olan kart numaraları), allowedSort haritası ile
    dinamik ORDER BY (firstName, lastName, cardNumber, department, isActive, createdAt)

  BACKEND — personnel.controller.ts:
  - @Query params eklendi: sortBy, sortDir, noCard, duplicateCards
  - findAll() çağrısına yeni parametreler iletiliyor

  FRONTEND — Personnel/index.tsx:
  - sortBy, sortDir, noCard, duplicateCards state'leri eklendi
  - fetchPersonnel() yeni parametreleri kabul ediyor, API params'a ekliyor
  - handleSort(): kolon adına göre sıralama yönünü değiştirir
  - SortIcon bileşeni: ChevronUp/Down (aktif) | ChevronsUpDown (pasif)
  - Tablo başlıkları: Ad Soyad, Kart No, Departman, Durum — tıklanabilir
  - Filtre çubuğuna "Kartsız" ve "Hatalı Kayıtlar" checkbox'ları eklendi
    (ikisi birbirini dışlar: biri seçilince diğeri sıfırlanır)

  Değişen dosyalar: 3 (personnel.service.ts, personnel.controller.ts,
    frontend/Personnel/index.tsx)
)
---------------------------------------------------------
Rev. ID    : 040
Rev. Date  : 21.03.2026
Rev. Time  : 17:30:00
Rev. Prompt: Personel — Kullanıcı Adı ve Son Giriş kolonlarına da sıralama eklendi

Rev. Report: (
  BACKEND — personnel.service.ts:
  - allowedSort haritasına username eklendi
  - lastAccessTime sıralaması için correlated subquery: MAX(event_time) doğrudan ORDER BY'da
    (LEFT JOIN subquery TypeORM'da alias çözümleyemediği için düzeltildi)

  FRONTEND — Personnel/index.tsx:
  - "Kullanıcı Adı" ve "Son Giriş" başlıkları tıklanabilir hale getirildi

  Değişen dosyalar: 2 (personnel.service.ts, frontend/Personnel/index.tsx)
)
---------------------------------------------------------
Rev. ID    : 041
Rev. Date  : 21.03.2026
Rev. Time  : 18:00:00
Rev. Prompt: Personel CSV dışa aktarma (Ad, Soyad, Kart No, Kullanıcı Adı, Departman, Aktif/Pasif)

Rev. Report: (
  Personel listesini UTF-8 BOM CSV olarak indiren endpoint ve frontend butonu eklendi.
  Portal eşleştirmesi için kullanılacak.

  BACKEND — personnel.service.ts:
  - exportCsv(): Tüm personeli firstName/lastName sıralı çekip ; ayrımlı CSV üretir
    Sütunlar: Ad;Soyad;KartNo;KullaniciAdi;Departman;Aktif
    Değerlerde özel karakter varsa RFC 4180 çift-tırnak kaçışı uygulanır

  BACKEND — personnel.controller.ts:
  - Res + Response importları eklendi
  - GET /personnel/export: BOM (\uFEFF) ile UTF-8 CSV response döner
    Content-Disposition: attachment; filename="personel.csv"
    (:id'den önce tanımlandı — route çakışmasını önlemek için)

  FRONTEND — Personnel/index.tsx:
  - Download ikonu import edildi
  - handleExport(): api.get responseType:'blob' → Blob URL → <a download> tetikleme
  - "Dışa Aktar" butonu filtre çubuğuna eklendi (Toplu İçe Aktar'ın soluna)

  Değişen dosyalar: 3 (personnel.service.ts, personnel.controller.ts,
    frontend/Personnel/index.tsx)
)
---------------------------------------------------------
Rev. ID    : 042
Rev. Date  : 21.03.2026
Rev. Time  : 20:00:00
Rev. Prompt: Detayli sorgu modulu - kisi adi / kart numarasi ile anlik sorgulama

Rev. Report: (
  Admin menusune Detayli Sorgu sayfasi (/admin/query) eklendi.
  Iki sorgu modu: Kisi (ad/username/kart ile arama) ve Kart numarasi.

  BACKEND - backend/src/query/ (yeni modul):
  - query.service.ts: searchByPerson() + searchByCard(); window/GROUP BY ile N+1 yok
  - query.controller.ts: GET /query/person?q= + GET /query/card?number=
  - query.module.ts

  BACKEND - app.module.ts: QueryModule eklendi

  FRONTEND - pages/Admin/Query/index.tsx:
  - Kisi/Kart sekmeleri, accordion PersonCard (son 5 log),
    CardResultView (son 20 log), orphan log kutusu, ornek sorgu butonlari

  FRONTEND - Sidebar.tsx + App.tsx: yeni route ve menu ogesi

  Degisen/yeni dosyalar: 6
)
---------------------------------------------------------
Rev. ID    : 043
Rev. Date  : 25.03.2026
Rev. Time  : 14:30:00
Rev. Prompt: Geçiş kayıtları — varsayılan filtre bugün, tabloya Kart No kolonu

Rev. Report: (
  Geçiş Kayıtları sayfasında iki iyileştirme yapıldı.

  FRONTEND — AccessLogs/index.tsx:
  - todayFilters() yardımcı fonksiyon eklendi: startDate alanını bugünün tarihi
    (YYYY-MM-DD) olarak döner.
  - filters ve appliedFilters state'leri todayFilters() ile başlatıldı;
    böylece sayfa açılışında yalnızca bugünkü kayıtlar listelenir.
  - "Temizle" butonu da emptyFilters yerine todayFilters() ile sıfırlanır.
  - Tabloya "Kart No" sütunu eklendi (Personel ile Cihaz arasına);
    log.personnel?.cardNumber değerini monospace font ile gösterir.
  - colCount: 5/6 → 6/7 (bulk actions dahil)

  Değişen dosyalar: 1 (frontend/AccessLogs/index.tsx)
)
---------------------------------------------------------
Rev. ID    : 044
Rev. Date  : 25.03.2026
Rev. Time  : 14:45:00
Rev. Prompt: Geçiş kayıtları — varsayılan filtre düzeltme: endDate=bugün (geçmişe yönelik)

Rev. Report: (
  Rev 043'te startDate=bugün olarak ayarlanan default filtre yanlış yönde çalışıyordu
  (bugünden itibaren ileri = 2027 gibi hatalı saat kayıtları görünüyordu).
  Doğru mantık: endDate=bugün → DB'nin ilk kaydından bugüne kadar göster,
  gelecek tarihli hatalı saat kayıtlarını filtreler.

  FRONTEND — AccessLogs/index.tsx:
  - todayFilters(): startDate → endDate (tek satır değişiklik)

  Değişen dosyalar: 1 (frontend/AccessLogs/index.tsx)
)
---------------------------------------------------------
Rev. ID    : 045
Rev. Date  : 25.03.2026
Rev. Time  : 15:00:00
Rev. Prompt: Geçiş kayıtları — endDate inclusive düzeltme (bugünün kayıtları görünsün)

Rev. Report: (
  endDate filtresi '2026-03-25' string'i olarak gönderilince PostgreSQL bunu
  '2026-03-25 00:00:00' olarak yorumluyordu; gün içindeki kayıtlar dışarıda kalıyordu.
  Backend'de endDate değerine ' 23:59:59' eklenerek gün sonu dahil edildi.
  Bu fix hem findAll hem de export endpoint'ini kapsıyor (aynı applyFilters kullanılıyor).

  BACKEND — access-logs.service.ts:
  - applyFilters(): endDate <= :endDate → endDate + ' 23:59:59'

  Değişen dosyalar: 1 (backend/access-logs/access-logs.service.ts)
)
---------------------------------------------------------
Rev. ID    : 055
Rev. Date  : 21.04.2026
Rev. Time  : 22:14:00
Rev. Prompt: Matris görünümünde header satırı scroll etmesin (sticky)

Rev. Report: (
  Erişim Yönetimi matrisi uzun personel listelerinde aşağı scroll edildiğinde
  cihaz adlarını içeren header satırı kaybolup hangi sütunun hangi cihaz
  olduğu takip edilemez hale geliyordu. Header artık dikey scroll sırasında
  yapışık kalıyor.

  FRONTEND — Supervisor/index.tsx (matris tablo):
  - Dış container: overflow-x-auto → max-h-[70vh] overflow-auto
  - Table: border-separate border-spacing-0 (sticky + border uyumu için)
  - Thead <th> "Personel": sticky left-0 top-0 z-30 (sol üst köşe)
  - Thead <th> cihaz kolonları: sticky top-0 z-20 bg-gray-50/dark-900
  - Tbody sol <td> (personel kolonu): zaten sticky left-0 z-10 (değişmedi)

  Değişen dosyalar: 3 (Supervisor/index.tsx, CHANGELOG.md, version.ts)
)
---------------------------------------------------------
Rev. ID    : 054
Rev. Date  : 21.04.2026
Rev. Time  : 22:09:00
Rev. Prompt: Supervisor API response parse hatası: res.data.results yerine res.data

Rev. Report: (
  Rev 053 sonrası her atama/kaldırma işleminde "Atama başarısız" toast'u
  gösteriliyordu. Sebep: frontend `res.data?.results ?? []` okuyordu ama
  backend `AssignmentResult[]` array'ini doğrudan döndürüyor (res.data = array).
  Her zaman `results[0]` undefined → success=false branch'ı tetikleniyordu.

  Eski bir bug; Rev 053 optimistic UI ile daha görünür hale geldi.
  BulkAssign yolu zaten doğru kodlanmış (Array.isArray(res.data)).

  FRONTEND — Supervisor/index.tsx:
  - handleAssignDevices (single path)  → Array.isArray(res.data) ? res.data : []
  - handleAssignLocation                → Array.isArray(res.data) ? res.data : []
  - handleUnassign                      → Array.isArray(res.data) ? res.data : []
  - handleMatrixCellClick               → Array.isArray(res.data) ? res.data : []

  Değişen dosyalar: 3 (Supervisor/index.tsx, CHANGELOG.md, version.ts)
)
---------------------------------------------------------
Rev. ID    : 053
Rev. Date  : 21.04.2026
Rev. Time  : 22:04:00
Rev. Prompt: Matris UX: optimistic update + net toast; CLAUDE.md cihaz IP'leri

Rev. Report: (
  Erişim Yönetimi matris görünümünde enrolled hücreye tıklayan kullanıcı
  "atamak istediğinde" toggle mantığı sessizce /unassign çağırıyor ve sonuç
  toast'u "{cihaz}: Kaldırıldı" olduğu için "atama başarısız" olarak
  algılanıyordu. Ayrıca CLAUDE.md'deki cihaz IP tablosu prod'daki gerçek
  değerlerle eşleşmiyordu.

  FRONTEND — Supervisor/index.tsx (matris UX):
  - Toast tipine 'info' (mavi) eklendi; ToastContainer renk koşulu güncellendi
  - addToast imzası 'success' | 'error' | 'info' default 'success'
  - handleMatrixCellClick:
    • Optimistic matris güncellemesi (setMatrix ile assignment anında değişir)
    • Tıklama anında info toast: "{Ad Soyad} → {Cihaz}: Kaldırılıyor…/Atanıyor…"
    • Sonuç toast'ı: "{Ad Soyad} → {Cihaz}: Kaldırıldı./Atandı."
    • Hata toast'ı: "Kaldırma/Atama başarısız ({pair}): {err}"
    • Hata durumunda fetchMatrix ile rollback

  CLAUDE.md:
  - Cihaz IP tablosu prod DB ile eşleştirildi:
    * Fabrika 1       192.168.204.233 → 192.168.255.9
    * Fabrika 2       192.168.152.233 → 192.168.155.9
    * Merkez Ofis     192.168.104.242 → 192.168.105.9
    * Optik Oda       192.168.104.241 → 192.168.105.8
    * 4.Ar-Ge Arka K. 192.168.107.240 → 192.168.113.9
  - "UDP 4370" notu: tüm cihazlar çalışıyor (önceki durum: sadece Fabrika 2)
  - 4.Ar-Ge durumu "Erisim disi" → "UDP + CommKey, sync aktif"

  Değişen dosyalar: 4 (Supervisor/index.tsx, CLAUDE.md, CHANGELOG.md, version.ts)
)
---------------------------------------------------------
Rev. ID    : 052
Rev. Date  : 21.04.2026
Rev. Time  : 19:30:00
Rev. Prompt: Yedekleme 0 byte — pg_dump backend container'ında yok

Rev. Report: (
  Admin > Sistem > Yedekleme sayfasında oluşturulan yedekler 0 byte ve
  "Başarısız" durumunda idi. Sebep: backend (node:20-alpine) image'inde
  pg_dump yüklü değildi; execSync("pg_dump ...") ENOENT ile çöküyordu.

  BACKEND — Dockerfile:
  - postgresql16-client apk paketi eklendi (pg_dump + pg_restore)
  - /app/backups dizini mkdir -p ile garanti altına alındı

  BACKEND — backup.service.ts:
  - pg_dump stderr artık 2>&1 ile yakalanıp errorMessage'a yazılıyor
  - 0-byte dosya tespit edilirse "boş dosya üretti" hatası fırlatılıyor
  - Başarısız yedekte 0-byte artık dosya silinir (kirli iz bırakmaz)

  Değişen dosyalar: 2 (backend/Dockerfile, backend/src/backup/backup.service.ts)
)
---------------------------------------------------------
Rev. ID    : 051
Rev. Date  : 21.04.2026
Rev. Time  : 19:20:00
Rev. Prompt: Giriş/Çıkış türev hesaplama — cihazlar tek yönlü, gündeki ilk kayıt giriş, son kayıt çıkış

Rev. Report: (
  Cihazlar hem giriş hem çıkışta aynı. "direction" artık kayıt anında değil,
  sorgulama anında türetiliyor: personel başına gündeki (TR 00:00-23:59) ilk
  kart okuması = giriş, son = çıkış, aradakiler = ara geçiş.

  BACKEND — Yazma tarafı (direction artık null):
  - device-comm/sync.service.ts → direction yazımı kaldırıldı
  - adms/adms.service.ts        → direction yazımı kaldırıldı

  BACKEND — Entity:
  - entities/access-log.entity.ts → @Index(['personnelId', 'eventTime'])

  BACKEND — access-logs.service.ts:
  - derivedDirectionCase(): WHERE filtresi için CASE deseni
  - attachDerivedDirections(): sayfa logları için min/max toplu sorgu + etiket
  - findAll / findForExport / findUnknown → derivedDirection alanı eklendi
  - findPaired() → 'paired' modu kaldırıldı, ilk/son event üzerinden süre
  - getPersonnelCountByLocation() → bugünkü son tap lokasyonu
  - checkNotifications() → direction==='in' geç kalma bloğu devre dışı
    (izin/görev modülüyle birlikte yeniden ele alınacak)

  BACKEND — DTO:
  - query-access-logs.dto.ts → direction enum 'in'|'out'|'transit',
    includeTransit boolean eklendi

  BACKEND — dashboard.service.ts:
  - todayArrived = bugün en az 1 kaydı olan personel sayısı
  - currentlyInside = bugünkü kayıt sayısı tek olan (turnike varsayımı)
  - getHourlyStats → CTE + CASE ile türev in/out histogramı

  BACKEND — reports.service.ts:
  - calcPairedMinutes() kaldırıldı
  - processDayLogs → ilk/son event'e göre
  - resolveConfigForLogs → ilk logun lokasyonu

  BACKEND — query.service.ts, personnel.service.ts:
  - Tüm "direction" SQL referansları türev CASE ifadesiyle değiştirildi
  - lastDirection → son log için türev yön

  FRONTEND — AccessLogs (pages/AccessLogs/index.tsx):
  - DirectionBadge 'transit' (gri, ↔) eklendi
  - Filtre dropdown'a "Ara" seçeneği
  - Tablo rendir → log.derivedDirection ?? log.direction
  - Excel export Giriş/Çıkış/Ara

  FRONTEND — types/index.ts:
  - AccessLog.direction tipi 'in'|'out'|'transit'|null
  - AccessLog.derivedDirection eklendi
  - Personnel.lastDirection tipi genişletildi

  NOT: DB'deki eski "direction" kolonu korundu (destructive değişiklik yok);
  hiçbir kod yolu artık o kolonu okumuyor. Eski kayıtlar da türev modelle
  yeniden yorumlanıyor.

  Değişen dosyalar: 12
  Backend: 10 (sync.service.ts, adms.service.ts, access-log.entity.ts,
    access-logs.service.ts, query-access-logs.dto.ts, dashboard.service.ts,
    reports.service.ts, query.service.ts, personnel.service.ts)
  Frontend: 2 (AccessLogs/index.tsx, types/index.ts)
)
---------------------------------------------------------
Rev. ID    : 050
Rev. Date  : 25.03.2026
Rev. Time  : 17:00:00
Rev. Prompt: Portal sync — isActive önceliği: PDKS pasifse portal aktif etmesin

Rev. Report: (
  Portal sync sırasında PDKS'de pasif yapılan personel, portal aktif gönderince
  tekrar aktif hale geliyordu. Yeni kural: existing.isActive && user.isActive
  — PDKS pasif ise pasif kalır; portal pasif gönderirse PDKS'yi de pasif yapar.

  BACKEND — portal-sync.service.ts:
  - existing.isActive = user.isActive → existing.isActive && user.isActive

  Değişen dosyalar: 1 (backend/src/portal-sync/portal-sync.service.ts)
)
---------------------------------------------------------
Rev. ID    : 049
Rev. Date  : 25.03.2026
Rev. Time  : 16:30:00
Rev. Prompt: employeeId otomatik atama (1-99999); create, importBulk, portal sync, supervisor assign

Rev. Report: (
  employeeId boş olan personel için MAX+1 stratejisiyle 1-99999 arasında
  unique ID otomatik atanıyor. Misafir kart aralığı dahil.

  BACKEND — personnel.service.ts:
  - nextEmployeeId(): MAX(employee_id)+1, 1-99999 arasında
  - create(): employeeId yoksa otomatik ata
  - importBulk(): her yeni kayıt için employeeId yoksa otomatik ata
  - create() null cardNumber için conflict check atlanır

  BACKEND — portal-sync.service.ts:
  - nextEmployeeId(): aynı MAX+1 sorgusu
  - Yeni personnel oluşturulurken employeeId otomatik atanıyor

  BACKEND — supervisor.service.ts:
  - ensureEmployeeId(): employeeId yoksa MAX+1 ata ve kaydet
  - resolveUid(): limit 3000 → 99999
  - assign(): ensureEmployeeId() çağrısı eklendi
  - bulkAssign(): ensureEmployeeId() çağrısı eklendi

  Değişen dosyalar: 3 (personnel.service.ts, portal-sync.service.ts,
    supervisor.service.ts)
)
---------------------------------------------------------
Rev. ID    : 048
Rev. Date  : 25.03.2026
Rev. Time  : 16:00:00
Rev. Prompt: Erişim yönetimi — atama hatası mesajı backend'den gösterilsin

Rev. Report: (
  Cihaz atama işleminde "işlem sırasında hata oluştu" yerine backend'in
  gönderdiği hata mesajı (örn: "Emre CAN icin gecerli employeeId yok")
  toast'ta gösterilecek.

  FRONTEND — Supervisor/index.tsx:
  - handleAssignDevices catch: err?.response?.data?.message fallback ile
  - handleAssignLocation catch: aynı pattern
  - handleBulkAssignLocation catch: aynı pattern
  - handleMatrixCellClick catch: aynı pattern

  Değişen dosyalar: 1 (frontend/src/pages/Supervisor/index.tsx)
)
---------------------------------------------------------
Rev. ID    : 047
Rev. Date  : 25.03.2026
Rev. Time  : 15:30:00
Rev. Prompt: Portal senkronizasyon — displayName son boşlukta bölünsün (ad, soyad)

Rev. Report: (
  Portal'dan gelen displayName alanı ilk boşlukta bölününce "S. Alper ES" gibi
  isimlerde "S." firstName, "Alper ES" lastName oluyordu.
  Son boşlukta bölünerek "S. Alper" firstName, "ES" lastName doğru atanır.

  BACKEND — portal-sync.service.ts:
  - splitDisplayName(): indexOf(' ') → lastIndexOf(' ')

  Değişen dosyalar: 1 (backend/src/portal-sync/portal-sync.service.ts)
)
---------------------------------------------------------
Rev. ID    : 046
Rev. Date  : 25.03.2026
Rev. Time  : 15:15:00
Rev. Prompt: Personel güncelleme — mükerrer kart numarası 500 yerine 409 Conflict dönsün

Rev. Report: (
  PATCH /personnel/:id kart numarası dolu başka bir kayda atanmaya çalışılırsa
  PostgreSQL unique constraint hatası (23505) backend'de yakalanmıyordu ve 500 dönüyordu.
  update() metoduna try/catch eklendi; 23505 + card_number ise ConflictException (409) fırlatılıyor.
  Frontend zaten err?.response?.data?.message ile backend mesajını toast'ta gösteriyor.

  BACKEND — personnel.service.ts:
  - update(): save() çağrısı try/catch ile sarmalandı
  - err.code === '23505' && err.detail.includes('card_number') → 409 ConflictException
    mesaj: "Bu kart numarası başka bir personele atanmış."

  Değişen dosyalar: 1 (backend/personnel/personnel.service.ts)
)
---------------------------------------------------------
