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
Rev. ID    : 066
Rev. Date  : 13.05.2026
Rev. Time  : 18:52:00
Rev. Prompt: Cihaz Bilgisi: tum kullanicilar, son 50 kayit, cihaz saati

Rev. Report: (
  "Cihaz Bilgisi" modal'i daha kapsamli oldu:
  - Onceki: ilk 10 kullanici, ilk 5 kayit
  - Yeni: tum kullanicilar (10k cap), en yeni 50 kayit, cihaz + sunucu saati

  BACKEND — devices.controller.ts pullDeviceData:
  - usersLimit default 10 → 10000 (max 10000)
  - Attendances now sorted by record_time DESC, then sliced (son 50)
  - getTime(zk) cagrilir (sessiz hata) → deviceTime ISO
  - serverTime: yeni NOW().toISOString() eklendi

  FRONTEND — Devices/index.tsx Cihaz Bilgisi modal:
  - Yeni "Saat" bolumu: cihaz saati vs sunucu saati yan yana, fark gosterilir
    (yesil <30s, amber <5dk, kirmizi >5dk)
  - "Kullanicilar (N / M)" — M cihazda toplam, N gosterilen
  - "Son Kayitlar (en yeni N / M)" — eski "ilk N" yanlis ifadesi duzeltildi
  - Iki tablo max-h-[40vh] overflow-y-auto + sticky thead — uzun listede
    kaymadan basliklar gorunur
  - Attendance row ts fallback: record_time / recordTime / timestamp
  - UID alani user_id / userId / uid fallback

  Degisen dosyalar: 4 (devices.controller.ts, Devices/index.tsx,
    CHANGELOG.md, version.ts)
)
---------------------------------------------------------
Rev. ID    : 065
Rev. Date  : 13.05.2026
Rev. Time  : 18:44:00
Rev. Prompt: Cihaz-DB log tutarsizligi: A) sikilastirma B) DB temizlik C) cihaz oto-temizlik

Rev. Report: (
  Tanı: 4.Ar-Ge'de 212 kayit 2001-2019 + 12 kayit 2027 (gelecek), Fabrika 2'de
  3 kayit 1999-2007. Cihaz saati hatalı dönemlerde gelmis kayitlar DB'ye
  yazilmis. Ayrica cihazlarda 1300-5500 attendance log birikmis (clear hic
  yapilmiyor), her sync'te tum log set'i cekilip dedup yapiliyordu.

  A) BACKEND — Timestamp filtre sikilastirma:
  - sync.service.ts: year-bazli filtre yerine zaman-bazli:
    eventMs > NOW+1h OR eventMs < NOW-7y → reject
  - adms.service.ts: ayni filtre
  → Yeni kayitlar artik kirli timestamp ile DB'ye girmez.

  B) BACKEND — Bozuk kayit temizlik:
  - access-logs.service.ts: cleanupInvalidTimestamps(dryRun)
    * dryRun: scanned + perDevice breakdown
    * dryRun=false: DELETE WHERE event_time > NOW+1h OR < NOW-7y
  - access-logs.controller.ts: POST /access-logs/cleanup-invalid-timestamps
    (admin only, audit-logged)

  B) FRONTEND — Settings/Sistem.tsx:
  - Yeni bolum: "Bozuk Timestamp Temizligi"
  - "Tara" butonu → dryRun=true, sonuc toast + cihaz-bazli liste
  - "Sil" butonu → confirm + dryRun=false → silinen sayi toast
  - Tara sonucu acik amber kart icinde gosterilir

  C) BACKEND — Cihaz log oto-temizlik (opt-in):
  - device.entity.ts: yeni alan autoCleanupLogs:boolean (default false)
  - create-device.dto.ts: autoCleanupLogs eklendi
  - sync.service.ts: sync basarili + logs.length>0 + device.autoCleanupLogs
    → clearAttendanceLog cagrilir. Cihaz buffer'i yiginlanmaz.

  C) FRONTEND — Devices form:
  - DeviceFormData/EMPTY_FORM'a autoCleanupLogs eklendi
  - openEditModal device.autoCleanupLogs yuklenir
  - handleSave payload'a autoCleanupLogs eklenir
  - types/index.ts Device interface guncellendi
  - Comm Key altina checkbox: "Log otomatik temizligi" + aciklama

  Test akisi:
  1. Settings > Sistem > Bozuk Timestamp > Tara → 215 etkilenecek
  2. Sil → temizlenir
  3. Cihazlar > 4.Ar-Ge > Duzenle > "Log otomatik temizligi" tikle Kaydet
  4. Sonraki sync'te cihaz buffer'i temizlenir, ileride birikme olmaz

  Degisen dosyalar: 8 backend + 3 frontend + CHANGELOG + version.ts
)
---------------------------------------------------------
Rev. ID    : 064
Rev. Date  : 09.05.2026
Rev. Time  : 18:24:00
Rev. Prompt: Admin > Sistem'e 'Cihaz Sifirla' (sadece sifirla, push yok) butonu

Rev. Report: (
  Mevcut "Cihaz Sifirla & Yeniden Yukle" (re-push'lu) yanina ikinci buton:
  "Sadece Sifirla". Cihaz user/log silinir, PDKS push YAPILMAZ. DB
  personnel_devices atamalari 'pending' durumuna duser, sonradan Esitle
  butonuyla manuel yuklenebilir.

  BACKEND — reconcile.service.ts:
  - factoryResetAndReload(device) → factoryReset(device, opts: { reload })
    olarak yeniden adlandirildi. opts.reload default true (geriye uyum).
  - reload=false durumunda re-push adimi atlanir; personnel_devices'a tek
    bir UPDATE ile { status: 'pending' } yazilir.

  BACKEND — factory-reset.controller.ts:
  - POST /:deviceId        → factoryReset(device, { reload: true })  (eski)
  - POST /:deviceId/wipe   → factoryReset(device, { reload: false }) (yeni)

  FRONTEND — Settings/Sistem.tsx:
  - handleFactoryReset() → runFactoryReset(mode: 'reload' | 'wipe')
  - Iki buton: kirmizi 'Sifirla & Yukle' + outline-red 'Sadece Sifirla'
  - 2-asamali onay (confirm + cihaz adi prompt) ikisinde de aktif
  - Mod'a gore farkli sonuc toast'i (reload: "X yuklendi", wipe: "cihaz bos")

  Degisen dosyalar: 5 (reconcile.service.ts, factory-reset.controller.ts,
    Sistem.tsx, CHANGELOG, version.ts)
)
---------------------------------------------------------
Rev. ID    : 063
Rev. Date  : 09.05.2026
Rev. Time  : 15:20:00
Rev. Prompt: Erisim Yonetimi: Personel Bazli ile Matris Gorunumu sync olmuyor

Rev. Report: (
  Tab degisiminde aktif sekmenin verisi yeniden cekilmiyordu. Kullanici
  Matris'te aksiyon yapip Personel Bazli'ya gectiginde (veya tersi) eski
  veri gorunebiliyordu. Aksiyon handler'lari sekmelerden birini guncelliyor
  ama digerine gecince stale state.

  FRONTEND — pages/Supervisor/index.tsx:
  - Yeni useEffect: activeTab degisince
    * matrix sekmesi → fetchMatrix()
    * personnel sekmesi + personel secili + bulk degil → fetchAssignments(id)
  Bu sayede sekmeden sekmeye gecince hep taze veri gorulur.

  Diger handler'lar (handleAssignDevices, handleAssignLocation, handleUnassign,
  handleMatrixCellClick) zaten ilgili refresh'leri yapiyordu — bunlara
  dokunulmadi.

  Degisen dosyalar: 3 (Supervisor/index.tsx, CHANGELOG.md, version.ts)
)
---------------------------------------------------------
Rev. ID    : 062
Rev. Date  : 09.05.2026
Rev. Time  : 15:13:00
Rev. Prompt: Turkce karakterli isimler siralamada listenin sonuna dusuyordu (S/I/C/O/U/G)

Rev. Report: (
  PostgreSQL default collation Turkce karakterleri (S/I/C/O/U/G) Latin
  alfabesinin sonuna koyuyordu. Tum SQL ORDER BY'larina ICU Turkce
  collation eklendi: `COLLATE "tr-TR-x-icu"`. Container Postgres 16 ICU ile
  geliyor (zaten mevcut). Frontend'de bir yerde 'tr' locale eksikti, eklendi.

  BACKEND — TR collation eklenen ORDER BY'lar:
  - personnel.service.ts (findAll allowedSort + exportCsv)
  - query.service.ts (searchByPerson)
  - reports.service.ts (getDailyAttendance, getMonthlySummary)
  - supervisor.service.ts (getAssignments, getMatrix)
  - locations.service.ts (findAll)

  TypeORM `find({ order: ... })` formati COLLATE destegi vermediginden
  ilgili cagrilar QueryBuilder'a cevrildi.

  FRONTEND:
  - pages/Supervisor/index.tsx:317 — locationName.localeCompare(b, 'tr')
    parametresi eklendi (digerleri zaten 'tr' kullanmaktaydi).

  Etki: Personel listesi, supervisor matrisi, gunluk/aylik raporlar, kart/
  isim aramasi, lokasyon dropdown'lari — hepsinde Turkce siralama dogru.
  "Sevgi" Latin alfabesindeki yerinde, "Sukran" S'den sonra, "Ihsan" I'dan
  sonra siralanir.

  Degisen dosyalar: 7 (5 backend + 1 frontend + CHANGELOG + version.ts)
)
---------------------------------------------------------
Rev. ID    : 061
Rev. Date  : 09.05.2026
Rev. Time  : 15:01:00
Rev. Prompt: Reconcile duplicate-cardno: exp.uid cihazda olsa bile duplicate'leri kontrol et

Rev. Report: (
  Rev 060'taki duplicate-cardno mantigi exp.uid cihazda zaten varsa hic
  calismiyordu. Kullanici "Esitle" basinca "Fabrika 2: 0 eklendi, 0 silindi"
  goruyordu. Cunku Fabrika 2'de Abdulsamet uid=164 zaten kayitliydi
  (PDKS push etmisti) ve uid=546 ZKAccess kalintisi ayrica vardi —
  exp.uid=164 mevcut → continue → uid=546 hic kontrol edilmedi.

  BACKEND — reconcile.service.ts:
  - Duplicate-cardno kontrolu artik "if (deviceUidSet.has(exp.uid)) continue"
    kontrolunden ONCE. Yani exp.uid cihazda olsa bile (PDKS push'i basariyla
    yapmis) ayni cardno baska uid'lerde varsa onlar yine silinir.
  - Push (setUser) hala continue sonrasinda — gereksiz tekrar push yapilmaz.

  Akis duzeltme:
    eski: 1) exp.uid var mi → varsa atla
          2) (atlandiginda) duplicate kontrolu de atlandi
    yeni: 1) duplicate cardno temizligi (her durumda)
          2) exp.uid yoksa setUser

  Degisen dosyalar: 3 (reconcile.service.ts, CHANGELOG.md, version.ts)
)
---------------------------------------------------------
Rev. ID    : 060
Rev. Date  : 09.05.2026
Rev. Time  : 14:53:00
Rev. Prompt: Reconcile duplicate-cardno + Cihazi Sifirla & Yeniden Yukle

Rev. Report: (
  Saha tanisi: Abdulsamet OZCAN (kart 4253004) Fabrika 2'de "Tanimsiz - Kart
  #546" olarak loglaniyordu. Sebep cihazda eski ZKAccess'ten kalma uid=546
  + PDKS'in push ettigi uid=164 ayni cardno'ya iki kez kayitli. ZKTeco kucuk
  uid'i match'liyor → "Tanimsiz". Ayni tablo Fabrika 2'de uid 83/796/2576/
  2759 icin de var. Reconcile (Rev 057) "bilinmeyen uid'lere dokunma" kurali
  nedeniyle bu duplicate'leri silmiyordu.

  BACKEND — reconcile.service.ts (duplicate-cardno detection):
  - reconcileDevice() push donusunde: PDKS expected user push edilirken o
    cardno cihazda farkli uid'de varsa once duplicate'ler silinir, sonra
    setUser yapilir. result.deleted artar.

  BACKEND — reconcile.service.ts (factoryResetAndReload):
  - Yeni method: cihazi sifirdan kurar
    1) SyncService.syncDevice ile kalan loglari PDKS'e cek (veri kaybi yok)
    2) getUsers + her uid icin deleteUser
    3) clearAttendanceLog
    4) personnel_devices ∩ personnel.isActive icin tek tek setUser
    5) result: syncedLogs, cleared, attendanceCleared, pushed, failed, errors
  - SyncService forwardRef ile inject (devre baglilik)

  BACKEND — factory-reset.controller.ts (YENI):
  - POST /api/v1/device-comm/factory-reset/:deviceId (admin only)
  - Cihazi bul, factoryResetAndReload cagir, sonucu don

  BACKEND — device-comm.module.ts:
  - FactoryResetController controllers'a eklendi

  FRONTEND — Settings/Sistem.tsx (Cihaz Sifirla & Yeniden Yukle bolumu):
  - Cihaz dropdown (GET /devices'tan listelenir)
  - Kirmizi "Cihazi Sifirla & Yukle" butonu (RotateCcw + AlertTriangle)
  - 2-asamali onay:
    1) confirm: islem geri alinamaz uyarisi
    2) prompt: cihaz adini AYNEN yazma zorunlulugu
  - Sonuc toast: "X log alindi, Y kullanici silindi, Z kullanici yuklendi"

  Issue #1, #3'un kalan vakalari (eski ZKAccess kalintilari) cozulmus oldu.
  Yeni cihazlar ekleyince ayni senaryo bir defa "Esitle" ile temizlenir.

  Degisen dosyalar: 6
  Backend: 3 (reconcile.service.ts, factory-reset.controller.ts YENI,
    device-comm.module.ts)
  Frontend: 1 (Sistem.tsx)
  Diger: CHANGELOG.md, version.ts
)
---------------------------------------------------------
Rev. ID    : 059
Rev. Date  : 02.05.2026
Rev. Time  : 08:20:00
Rev. Prompt: Yon belirtilen cihazlarda direction kayda yazilsin, turev sadece yon belirtilmeyen cihazlarda kaslin

Rev. Report: (
  Sahaya yon-bazli cihazlar (SC800 vb. giris/cikis ayri okuyucular) eklenmek
  uzere. device.direction='in' veya 'out' ise log artik o yonu DOGRUDAN yaziyor;
  direction='both' (mevcut SC403'ler) icin Rev 051'deki turev (ilk/son) kurali
  korunuyor. Hibrit model.

  BACKEND — Yazma tarafi:
  - device-comm/sync.service.ts: device.direction in ('in','out') ise
    accessLog.direction = device.direction yaziliyor
  - adms/adms.service.ts: ayni mantik

  BACKEND — access-logs.service.ts:
  - derivedDirectionCase() SQL CASE'in basina:
      WHEN log.direction IN ('in', 'out') THEN log.direction
      WHEN log.personnel_id IS NULL THEN NULL
      ... (turev ilk/son fallback)
  - attachDerivedDirections() JS: log.direction varsa onu yaz, yoksa min/max
    hesabi
  - findPaired() gunluk rapor: direction='in' kayit varsa ilk 'in' = giris,
    direction='out' kayit varsa son 'out' = cikis; yoksa ilk/son fallback

  BACKEND — Diger servisler:
  - dashboard.service.ts > getHourlyStats(): CASE basina
    WHEN log.direction IN ('in','out') THEN log.direction
  - query.service.ts: 3 CASE bloku ve last_log/last_day CTE'lerine direction
    kolonu + oncelik
  - personnel.service.ts: lastDirection CASE'i + recentLogs CASE'i

  BACKEND — reports.service.ts > processDayLogs():
  - inLogs/outLogs filter'i + fallback turev mantigi (Rev 051 oncesi davranisin
    iyilestirilmis hali)

  Ortak desen: Cihaz yon damgali ise cihazi dinle; degilse personel-gun bazinda
  ilk/son turev. Hibrit model SC403 + SC800 birlikte calisirken her ikisi de
  dogru gosterilir.

  FRONTEND degismedi (zaten log.derivedDirection ?? log.direction zincirini
  kullaniyor — Rev 051'den beri).

  Degisen dosyalar: 7 (sync.service.ts, adms.service.ts, access-logs.service.ts,
    dashboard.service.ts, query.service.ts, personnel.service.ts,
    reports.service.ts) + CHANGELOG + version.ts
)
---------------------------------------------------------
Rev. ID    : 058
Rev. Date  : 28.04.2026
Rev. Time  : 16:20:00
Rev. Prompt: Kart cakismasi: cakisan personel adini goster + 'Karti Cikar' butonu

Rev. Report: (
  issues.txt #4: "kart numarasi zaten kayitli" hatasinda kullanici hangi
  personelle cakistigini goremiyordu. Ayrica eski sahipten karti kaldirmak
  icin form alanini elle bosaltmak gerekiyordu (UX nede acik degildi).

  BACKEND — personnel.service.ts:
  - buildCardConflictMessage(cardNumber, owner) yardimcisi:
    "X kart numarasi zaten kayitli: Ad Soyad (employeeId: N), durum: aktif/pasif.
     Eski sahipten kaldirmak icin ilgili personeli acip ✕ butonunu kullanin."
  - create(): conflict mesaji detaylandirildi
  - update(): cardNumber degisirken on-conflict check + 23505 fallback'inde
    de detayli mesaj

  FRONTEND — Personnel/index.tsx:
  - Kart No artik zorunlu degil (validation: sadece Ad+Soyad)
  - Form'da bos kart no gonderilirse edit modunda payload.cardNumber=null
    (Rev 056 sayesinde cihazlardan otomatik silinir)
  - Kart No input'unun yanina ✕ "Karti Cikar" mini buton (sadece edit
    modunda + dolu kart):
    onclick → confirm → form'da cardNumber'i bosalt → user save ile commit
  - Placeholder: "Kart no (opsiyonel)"

  Issues #1 ve #3 Rev 057 (reconcile job) ile, #2 Rev 056 ile coreldu.
  Issue #4 icin tani+UX kapatildi: yeni vakada cakisan kim oldugu hemen
  gorunecek; cikartmak icin tek tik yeterli.

  Degisen dosyalar: 4 (personnel.service.ts, Personnel/index.tsx,
    CHANGELOG.md, version.ts)
)
---------------------------------------------------------
Rev. ID    : 057
Rev. Date  : 28.04.2026
Rev. Time  : 15:25:00
Rev. Prompt: Reconcile job: DB - cihaz tutarliligi (gece cron + manuel buton)

Rev. Report: (
  issues.txt #1 ve #3: Cihazda kullanici sessizce kaybolunca veya orphan
  kayit kalinca PDKS gercek durumu yansitamiyordu. Reconcile servisi:

  - Her gece 03:00'te @Cron('0 3 * * *') ile calisir
  - Manuel tetik: Devices sayfasinda her cihazda "Esitle" butonu

  Algoritma (her cihaz icin, veri kaybini engelleyen muhafazakar yaklasim):
  1) Cihaza connect, getUsers ile uid+cardno listesini al
  2) PDKS'in beklenen kullanicilarini hesapla
     (personnel_devices ∩ personnel.isActive=true ∩ employeeId 1-99999)
  3) PUSH: Cihazda olmayan beklenenler -> setUser
     (personnel_devices.status='enrolled' veya 'failed' guncellenir)
  4) DELETE: Cihazda var ama PDKS'te orphan olanlar -> deleteUser
     ORPHAN tanimi: uid PDKS'te bir personele esleser AMA personel pasif
     YA DA bu cihaza atanmamis. Bilinmeyen uid'lere DOKUNMA (admin /
     fabrika varsayilanlari korunur).

  BACKEND — yeni dosyalar:
  - device-comm/reconcile.service.ts (Cron + reconcileAll + reconcileDevice)
  - device-comm/reconcile.controller.ts (POST /device-comm/reconcile,
    POST /device-comm/reconcile/:deviceId — admin only)

  BACKEND — device-comm.module.ts:
  - PersonnelDevice TypeORM repo eklendi
  - ReconcileService provider, ReconcileController controller eklendi

  FRONTEND — Devices/index.tsx:
  - reconcilingIds state'i + handleReconcile() handler
  - Cihaz kartinda "Esitle" butonu (RefreshCw ikonu)
  - Toast: "X eklendi, Y silindi[, Z hata]" / "Cihaza erisilemedi"

  Issue #4 (4353911 kart cakismasi) reproduce edilemedi, ornek vaka
  geldiginde diagnoz yapilacak.

  Degisen dosyalar: 6
  Backend: 3 (reconcile.service.ts YENI, reconcile.controller.ts YENI,
    device-comm.module.ts)
  Frontend: 1 (Devices/index.tsx)
  Diger: CHANGELOG.md, version.ts
)
---------------------------------------------------------
Rev. ID    : 056
Rev. Date  : 28.04.2026
Rev. Time  : 15:08:00
Rev. Prompt: Personel sil/kart degistir akislarinda cihazdan deleteUser

Rev. Report: (
  issues.txt #2: A'nin kartini silip B'ye verdigimizde cihaz hala A olarak
  yorumluyordu (cihazda A'nin kaydi kaliyordu). Personel silme/kart degisikligi
  akislarinda artik bagli cihazlardan da temizlik yapiliyor.

  BACKEND — personnel.service.ts:
  - Logger eklendi
  - Constructor'a Device repo, PersonnelDevice repo, ZktecoClientService inject
  - removeFromAllAssignedDevices(personnel) yardimcisi:
    * personnel_devices tablosundaki tum atamalari al
    * Her cihaza connect, deleteUser(uid), disconnect (sessiz hata)
    * personnel_devices satirlarini sil
    * Re-enroll edilebilir cihaz id listesi doner
  - reenrollToDevices(personnel, deviceIds): yeni cardno ile setUser
  - update(): cardNumber degistiyse → eski cihazlardan sil → save → re-enroll
  - remove(): silmeden once cihazlardan deleteUser

  BACKEND — personnel.module.ts:
  - TypeOrmModule.forFeature'a PersonnelDevice eklendi
  - DeviceCommModule global oldugu icin ZktecoClientService otomatik inject

  Etkilenen senaryolar:
  - Personel sil → cihazlardan kullanici kaldirilir (kart artik gecemez)
  - cardNumber degistir → eski uid+cardno cihazdan silinir, yeni cardno ile
    aynei cihazlara re-enroll yapilir (otomatik UX)
  - Hata durumlari sessiz: cihaza erisilemezse log + status='failed'

  Issues #1 ve #3 icin reconcile job (gece cron + manuel buton) Rev 057'de
  yapilacak. Issue #4 (4353911 kart cakismasi) reproduce edilemedi, ornek
  vaka geldiginde ele alinacak.

  Degisen dosyalar: 4 (personnel.service.ts, personnel.module.ts,
    CHANGELOG.md, version.ts)
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
