# PDKS - Changelog

> Max 11 kayıt tutulur. 11 kayıt dolunca eski 1-10 arşivlenir (`temp/changelog{NNN}-{NNN}.md`),
> yeni dosya eski dosyanın son kaydıyla başlar (bağlam referansı olarak).
> Arşiv: temp/changelog_001-010.md

---------------------------------------------------------
Rev. ID    : 010
Rev. Date  : 18.02.2026
Rev. Time  : --:--:--
Rev. Prompt: Toplu atama iyileştirme + Cihaz kullanıcı listesi + ZkTeco decode/encode düzeltmeleri

Rev. Report: (
  Toplu personel atama özelliği eklendi, performans optimizasyonu yapıldı,
  cihaz kullanıcı listesi görüntüleme eklendi ve ZkTeco veri okuma/yazma
  sorunları düzeltildi.

  TOPLU ATAMA (BULK ASSIGN):
  - POST /supervisor/bulk-assign — çoklu personeli çoklu cihaza ata
  - POST /supervisor/bulk-assign-location — çoklu personeli lokasyona ata
  - BulkAssignmentResult interface eklendi
  - Frontend: "Tümünü Seç" butonu, checkbox ile çoklu seçim
  - Bulk mode sağ panel (2+ personel seçilince)

  PERFORMANS OPTİMİZASYONU:
  - bulkAssign cihaz-merkezli yeniden yazıldı: her cihaza 1 bağlantı
    (önceki: her personel × her cihaz = ayrı bağlantı)
  - UDP port tükenmesi (EADDRINUSE) sorunu çözüldü
  - upsertPersonnelDevice helper metodu eklendi

  CİHAZ KULLANICI LİSTESİ:
  - POST /devices/:id/users — cihazdan tüm tanımlı kullanıcıları çeker
  - Cihaz kartında "Kullanıcılar" butonu eklendi
  - Kullanıcı listesi modalı: arama, UID/Ad/Kart No/User ID/Rol tablosu
  - Toplam kullanıcı sayısı, filtreleme durumu gösterimi

  ZKTECO DECODE İYİLEŞTİRMELERİ:
  - decodeUsersFromUdpPayload: detaylı diagnostik loglama eklendi
    (raw data boyutu, hex dump, format tespiti, skor bilgisi)
  - Yeni scoreUsers() metodu: rol geçerliliği (+3), isim varlığı (+3),
    şüpheli rol değerleri (-2 ceza) ile daha iyi format tespiti
  - Frontend: userId alan ismi düzeltildi (userid → userId)
  - Frontend: boş string kontrolü düzeltildi (?? → ||)

  ZKTECO ENCODE DÜZELTMELERİ:
  - transliterateTurkish() helper: ç→c, ğ→g, ı→i, İ→I, ö→o, ş→s, ü→u
  - setUser'da isim ASCII'ye çevriliyor (cihaz Türkçe karakter desteklemez)

  Değişen dosyalar: 4 (supervisor.service.ts, supervisor.controller.ts,
  zkteco-client.service.ts, devices.controller.ts)
  Değişen frontend: 2 (Supervisor/index.tsx, Devices/index.tsx)
)
---------------------------------------------------------
Rev. ID    : 011
Rev. Date  : 18.02.2026
Rev. Time  : --:--:--
Rev. Prompt: ZkTeco cihaz okuma/yazma format düzeltmeleri + format-prime mekanizması

Rev. Report: (
  ZkTeco cihaz iletişiminde okuma (decode) ve yazma (encode) kodları
  düzeltildi. Cihaz bazlı paket formatı cache'leme ve format-prime
  mekanizması eklendi.

  DECODE DÜZELTMELERİ:
  - zkteco-client.service.ts:250 — decodeUserData28Legacy iyileştirildi
  - zkteco-client.service.ts:303 — decodeUsersFromUdpPayload'da cihaz
    bazlı paket formatı cache'leniyor (28|72 byte, IP bazlı Map)

  ENCODE DÜZELTMELERİ:
  - zkteco-client.service.ts:525 — SC403 uyumlu buildUserBuffer28 eklendi
  - zkteco-client.service.ts:545 — setUser UDP tarafı format-aware hale
    getirildi; varsayılan 28-byte, gerekirse 72-byte fallback

  FORMAT-PRIME MEKANİZMASI:
  - devices.controller.ts:237 ve :291 — Enroll öncesi getUsers çağrısı
    ile format tespiti prime ediliyor (cihazın kullandığı paket formatı
    önceden tespit edilip cache'e alınıyor)
  - Cihaza yazılan userId artık employeeId bazlı

  SUPERVISOR ENTEGRASYONU:
  - supervisor.service.ts:166 ve :380 — Supervisor enroll akışına aynı
    format-prime ve employeeId bazlı userId düzeltmesi eklendi

  Değişen dosyalar: 4 (zkteco-client.service.ts, devices.controller.ts,
  supervisor.service.ts, supervisor.controller.ts)
)
---------------------------------------------------------
Rev. ID    : 012
Rev. Date  : 18.02.2026
Rev. Time  : --:--:--
Rev. Prompt: resolveUid fallback + enroll hata yönetimi iyileştirmesi

Rev. Report: (
  Personel cihaza tanımlama sırasında employeeId olmayan personeller için
  internal server error (500) hatası düzeltildi.

  resolveUid FALLBACK:
  - employeeId yoksa veya 1-3000 arası değilse, cardNumber'dan hash ile
    1-3000 arası UID türetiliyor (önceki: direkt hata fırlatıyordu)
  - Son çare olarak fallbackIndex parametresi desteği eklendi

  HATA YÖNETİMİ:
  - enrollPersonnel: resolveUid hatası artık 500 yerine
    { success: false, message: "..." } döndürüyor
  - unenrollPersonnel: aynı düzeltme uygulandı

  Değişen dosyalar: 1 (devices.controller.ts)
)
---------------------------------------------------------
Rev. ID    : 013
Rev. Date  : 18.02.2026
Rev. Time  : --:--:--
Rev. Prompt: Personnel'e username alanı eklenmesi (portal auth desteği)

Rev. Report: (
  Portal üzerinden kimlik doğrulama için personel kaydına kullanıcı adı
  (username) alanı eklendi. Format: ad.soyad (örn: alper.es)

  BACKEND:
  - Personnel entity'ye username kolonu eklendi (varchar 100, unique,
    nullable, indexed)
  - CreatePersonnelDto'ya username alanı eklendi (@IsString, @IsOptional)
  - UpdatePersonnelDto otomatik olarak PartialType ile destekliyor

  FRONTEND — PERSONEL SAYFASI:
  - Personnel interface'e username alanı eklendi
  - PersonnelForm interface'e username eklendi
  - Personel ekleme/düzenleme modalına "Kullanıcı Adı" form alanı eklendi
    (Sicil No yanında)
  - Personel tablosuna "Kullanıcı Adı" kolonu eklendi (Departman'dan önce)
  - CSV import'ta username/kullaniciAdi/Kullanıcı Adı başlık desteği eklendi
  - colCount güncelllendi (admin: 8, diğer: 7)

  Yeni dosyalar: 0
  Değişen dosyalar: 4 (personnel.entity.ts, create-personnel.dto.ts,
  types/index.ts, Personnel/index.tsx)
)
---------------------------------------------------------
Rev. ID    : 014
Rev. Date  : 19.02.2026
Rev. Time  : 06:15:00
Rev. Prompt: İlk production deploy (192.168.88.111:5174) + veritabanı taşıma

Rev. Report: (
  PDKS uygulaması ilk kez production sunucusuna (192.168.88.111) deploy
  edildi. Veritabanı lokal ortamdan taşındı, cihazlara veri basılmadı.

  DOCKER-COMPOSE PRODUCTION UYARLAMASI:
  - Container isimleri template'e uyarlandı:
    pdks-backend → pdks-server, pdks-frontend → pdks-client
  - Backend ve PostgreSQL host port mapping kaldırıldı (güvenlik)
  - Sadece port 5174 dışarıya açık (frontend nginx)
  - PostgreSQL volume: Docker named volume → bind mount (./data/postgres)

  PRODUCTION DEPLOY:
  - Sunucu: 192.168.88.111, port: 5174
  - Container'lar: pdks-postgres, pdks-server, pdks-client
  - Dizin: /home/mssadmin/pdks
  - DB: pg_dump ile lokal export → docker cp ile container'a import
  - Taşınan veri: 94 personel, 5 cihaz, 5 lokasyon, 2747 erişim kaydı,
    2 kullanıcı

  CİHAZ BAĞLANTI DURUMU (prod sunucudan):
  - Merkez Ofis (192.168.104.242): UDP bağlandı (95 user, 471 log)
  - Optik Oda (192.168.104.241): UDP bağlandı (94 user, 2262 log)
  - Fabrika 2 (192.168.152.233): UDP bağlandı (96 user, 6 log)
  - Fabrika 1 (192.168.204.233): Timeout
  - 4.Ar-Ge (192.168.107.240): Timeout
  - Cihazlara veri BASILMADI (sadece okuma yapıldı)

  PORT PLANLAMASI (çakışma analizi):
  - 22: SSH, 80: Portal, 3010: Portal-FTS, 5000: TaskMgmt,
    8080: RMS, 18088: OnlyOffice → 5174: PDKS (boş, çakışma yok)

  Değişen dosyalar: 1 (docker-compose.yml)
)
---------------------------------------------------------
Rev. ID    : 015
Rev. Date  : 19.02.2026
Rev. Time  : 06:55:00
Rev. Prompt: Lokasyon bazlı mesai programı (esnek mesai desteği)

Rev. Report: (
  Her lokasyona özel mesai saatleri ve esnek mesai desteği eklendi.
  Raporlar ve bildirimler artık lokasyon bazlı çalışma saatlerini
  kullanıyor. Özel tanımı olmayan lokasyonlar global ayarlara fallback ediyor.

  BACKEND — VERİ MODELİ:
  - Location entity'ye 4 yeni kolon: workStartTime (varchar 5, nullable),
    workEndTime (varchar 5, nullable), isFlexible (boolean, default false),
    flexGraceMinutes (int, nullable)
  - CreateLocationDto'ya 4 yeni validated field (@Matches HH:MM, @Min/@Max)

  BACKEND — SETTINGS SERVİSİ:
  - buildWorkConfig(): mesai bilgilerinden WorkConfig nesnesi oluşturur
  - getWorkConfigForLocation(locationId): lokasyona özel veya global fallback
  - getAllLocationConfigs(): tüm lokasyon config'lerini toplu yükler
    (raporlar için Map<locationId, WorkConfig>)
  - SettingsModule'e Location entity import edildi

  BACKEND — RAPORLAR SERVİSİ (TAM REFACTORING):
  - WorkConfig interface genişletildi: isFlexible, flexGraceMinutes,
    shiftDurationMinutes
  - isLate(): esnek mesai → giriş penceresi sonuna kadar geç değil
  - isEarly(): esnek mesai → firstIn + shiftDuration'dan önce çıkış = erken
  - processDayLogs(): isEarly'ye firstIn geçirir
  - resolveConfigForLogs(): ilk giriş lokasyonundan config çözümler
  - getDailyAttendance, getMonthlySummary, getDepartmentSummary:
    tümü per-location config kullanacak şekilde güncellendi
  - Günlük rapor kayıtlarına workStart, workEnd, isFlexible eklendi

  BACKEND — BİLDİRİM SERVİSİ:
  - checkNotifications(): lokasyon bazlı mesai config çözümlüyor
  - Esnek mesai: lateThreshold = workStart + flexGraceMinutes + 15dk
  - Mesai dışı sınır: workEnd + flexGraceMinutes + 60dk

  FRONTEND — LOKASYON SAYFASI:
  - LocationForm: useCustomSchedule, workStartTime, workEndTime,
    isFlexible, flexGraceMinutes alanları eklendi
  - Modalda "Mesai Programı" bölümü: özel mesai toggle, saat input'ları,
    esnek mesai toggle, tolerans dakika input'u, açıklama metni
  - Lokasyon kartlarında mesai bilgisi: "08:00-17:30 (Esnek 60dk)"
    veya "Varsayılan mesai"

  FRONTEND — AYARLAR SAYFASI:
  - "Çalışma Saatleri" → "Varsayılan Çalışma Saatleri" olarak güncellendi
  - Açıklama notu eklendi: "Lokasyon bazlı mesai saatleri Lokasyon
    Yönetimi sayfasından ayarlanabilir"

  FRONTEND — TYPES:
  - Location interface'e workStartTime, workEndTime, isFlexible,
    flexGraceMinutes eklendi

  CHANGELOG ARŞİVLEME:
  - Rev 001-010 → temp/changelog_001-010.md arşivlendi

  Değişen backend: 6 (location.entity.ts, create-location.dto.ts,
  settings.service.ts, reports.service.ts, access-logs.service.ts,
  settings.module.ts)
  Değişen frontend: 3 (types/index.ts, Locations/index.tsx,
  Settings/index.tsx)
)
---------------------------------------------------------
Rev. ID    : 017
Rev. Date  : 19.02.2026
Rev. Time  : 10:11:00
Rev. Prompt: Mesai programları ayrı sayfa + lokasyona atama (WorkSchedule entity)

Rev. Report: (
  Mesai programları ayrı bir entity ve sayfaya taşındı. Birden fazla şablon
  oluşturup lokasyonlara atanabilir hale getirildi. Aynı mesai programı birden
  fazla lokasyona uygulanabilir, merkezi yönetim sağlandı.

  BACKEND — YENİ ENTITY: WorkSchedule
  - work_schedules tablosu: id (uuid PK), name (unique), workStartTime,
    workEndTime, isFlexible, flexGraceMinutes, createdAt, updatedAt
  - Entity: backend/src/entities/work-schedule.entity.ts

  BACKEND — YENİ MODÜL: WorkSchedules
  - CRUD service: findAll (locationCount dahil), findOne, create, update, remove
  - Silme koruması: atanmış lokasyonu olan program silinemez
  - REST controller: GET/POST/PATCH/DELETE /api/v1/work-schedules
  - DTO: name, workStartTime (@Matches HH:MM), workEndTime, isFlexible,
    flexGraceMinutes (0-240)
  - Dosyalar: work-schedules.module.ts, work-schedules.service.ts,
    work-schedules.controller.ts, dto/create-work-schedule.dto.ts

  BACKEND — LOCATION ENTITY DEĞİŞİKLİĞİ:
  - 4 inline kolon kaldırıldı: workStartTime, workEndTime, isFlexible,
    flexGraceMinutes
  - 1 FK eklendi: workScheduleId (uuid, nullable) → WorkSchedule
  - @ManyToOne relation (nullable, eager: true)
  - CreateLocationDto: 4 schedule field → workScheduleId (@IsUUID @IsOptional)
  - LocationsService.findAll: leftJoinAndSelect('workSchedule') eklendi

  BACKEND — SETTINGS SERVİSİ:
  - getWorkConfigForLocation(): location.workSchedule?.workStartTime kullanıyor
  - getAllLocationConfigs(): aynı pattern ile güncellendi

  FRONTEND — YENİ SAYFA: Mesai Programları
  - Tablo: Ad, Başlangıç, Bitiş, Esnek, Tolerans, Lokasyon Sayısı
  - Ekle/Düzenle modalı: name, time inputs, esnek toggle, tolerans
  - Sil butonu (atanmış lokasyon uyarısı)
  - Route: /admin/work-schedules
  - Sidebar: Clock ikonu ile "Mesai Programları" menü öğesi

  FRONTEND — LOKASYON SAYFASI:
  - Inline mesai formu kaldırıldı (toggle, time input'ları)
  - Yerine: WorkSchedule dropdown (+ "Varsayılan (Global)" seçeneği)
  - Kartta: atanan programın adı ve saatleri gösteriliyor

  FRONTEND — AYARLAR SAYFASI:
  - Açıklama metni güncellendi: "Mesai programı atanmamış lokasyonlar bu
    saatleri kullanır. Lokasyonlara özel mesai programları Mesai Programları
    sayfasından tanımlanabilir."

  Yeni backend: 5 (work-schedule.entity.ts, work-schedules.module.ts,
  work-schedules.service.ts, work-schedules.controller.ts,
  create-work-schedule.dto.ts)
  Değişen backend: 5 (entities/index.ts, location.entity.ts,
  create-location.dto.ts, locations.service.ts, settings.service.ts,
  app.module.ts)
  Yeni frontend: 1 (WorkSchedules/index.tsx)
  Değişen frontend: 5 (types/index.ts, Locations/index.tsx, App.tsx,
  Sidebar.tsx, Settings/index.tsx)
)
---------------------------------------------------------
Rev. ID    : 018
Rev. Date  : 19.02.2026
Rev. Time  : 10:55:00
Rev. Prompt: Mesai hesaplama modu — Brüt/Net seçeneği (WorkSchedule bazlı)

Rev. Report: (
  Mesai programlarına hesaplama modu seçeneği eklendi. Her program için
  "Brüt" (ilk giriş / son çıkış) veya "Net" (eşleştirilmiş giriş/çıkış)
  modu seçilebilir. Net modda gün içindeki molalar otomatik düşülür.

  Örnek: 08:00 IN, 12:00 OUT, 13:00 IN, 17:00 OUT
  - Brüt: 17:00 - 08:00 = 540dk (9 saat, mola dahil)
  - Net: (12:00-08:00) + (17:00-13:00) = 480dk (8 saat, mola düşülür)

  BACKEND — WORK SCHEDULE ENTITY:
  - Yeni kolon: calculation_mode (varchar 10, default 'firstLast')
  - İki değer: 'firstLast' (brüt) veya 'paired' (net)

  BACKEND — WORK SCHEDULE DTO:
  - calculationMode alanı eklendi (@IsIn(['firstLast', 'paired']), opsiyonel)

  BACKEND — SETTINGS SERVİSİ:
  - buildWorkConfig(): calculationMode parametresi ve return değeri eklendi
  - getWorkConfigForLocation() ve getAllLocationConfigs(): ws.calculationMode geçiriliyor

  BACKEND — REPORTS SERVİSİ:
  - WorkConfig interface'e calculationMode eklendi
  - calcPairedMinutes(): IN→OUT çift eşleştirme fonksiyonu (state machine)
  - processDayLogs(): calculationMode'a göre dallanma — paired ise çift
    eşleştirme, firstLast ise mevcut ilk giriş/son çıkış mantığı

  BACKEND — ACCESS-LOGS SERVİSİ:
  - findPaired(): lokasyon bazlı config çözümleme eklendi
  - calculationMode === 'paired' → IN/OUT çift eşleştirme ile süre hesabı
  - Response'a calculationMode alanı eklendi

  FRONTEND — TYPES:
  - WorkSchedule interface'e calculationMode alanı eklendi

  FRONTEND — MESAİ PROGRAMLARI SAYFASI:
  - Tabloya "Hesaplama" kolonu eklendi (Brüt: mavi badge, Net: mor badge)
  - Modalda "Hesaplama Modu" radio butonları eklendi:
    - Brüt (İlk Giriş / Son Çıkış): mavi seçim kutusu
    - Net (Eşleştirilmiş Giriş/Çıkış): mor seçim kutusu
  - Her iki seçenek için açıklama metni mevcut

  Değişen backend: 4 (work-schedule.entity.ts, create-work-schedule.dto.ts,
  settings.service.ts, reports.service.ts, access-logs.service.ts)
  Değişen frontend: 2 (types/index.ts, WorkSchedules/index.tsx)
)
---------------------------------------------------------
Rev. ID    : 019
Rev. Date  : 19.02.2026
Rev. Time  : 14:19:00
Rev. Prompt: Tarayıcı başlığı ve favicon güncellemesi

Rev. Report: (
  Tarayıcı sekmesinde görünen uygulama adı "frontend" yerine "PDKS" olarak
  güncellendi. Favicon olarak MSS göz logosu (mss_eye.png) eklendi.

  FRONTEND:
  - index.html: <title>frontend</title> → <title>PDKS</title>
  - index.html: favicon vite.svg → favicon.png (image/png)
  - public/favicon.png: resources/mss_eye.png kopyalandı

  Değişen frontend: 1 (index.html)
  Yeni frontend: 1 (public/favicon.png)
)
---------------------------------------------------------
Rev. ID    : 020
Rev. Date  : 19.02.2026
Rev. Time  : 14:45:00
Rev. Prompt: Portal SSO entegrasyonu — tek tıkla giriş

Rev. Report: (
  Portal uygulamasından SSO ile gelen kullanıcıların PDKS'ye otomatik giriş
  yapabilmesi sağlandı. Portal, HS256 ile imzalanmış kısa ömürlü (5dk) JWT
  üretip PDKS URL'sine sso_token parametresi olarak ekliyor. PDKS bu token'ı
  doğrulayıp kullanıcıyı kendi veritabanında arayarak oturum açıyor.

  BACKEND — ORTAM DEĞİŞKENLERİ:
  - .env.example: SSO_SECRET_KEY eklendi
  - docker-compose.yml: backend servisine SSO_SECRET_KEY env var eklendi

  BACKEND — AUTH SERVICE:
  - loginWithSsoToken(ssoToken): yeni metod
    1. SSO_SECRET_KEY ile jsonwebtoken.verify (sadece HS256)
    2. Token'dan username çıkarır
    3. usersService.findByUsername ile kullanıcı arar
    4. Kullanıcı yoksa veya pasifse → UnauthorizedException
    5. Mevcut generateTokens() ile PDKS access + refresh token üretir
  - Logger eklendi (SSO giriş başarı/başarısız logları)

  BACKEND — AUTH CONTROLLER:
  - GET /api/v1/auth/sso?sso_token=... endpoint eklendi (public, guard yok)
  - Başarılı girişte SSO_LOGIN audit log kaydı oluşturulur
  - Normal login response formatı ile aynı: { accessToken, refreshToken, user }

  FRONTEND — LOGIN SAYFASI:
  - useEffect ile sso_token query parametresi yakalanıyor
  - Token varsa: GET /auth/sso çağrılır, başarılıysa token'lar localStorage'a
    yazılıp authStore güncellenir, Dashboard'a yönlendirilir
  - URL'den token temizlenir (window.history.replaceState — replay koruması)
  - SSO işlemi sırasında loading spinner gösteriliyor
  - Hata durumunda login formu ile birlikte hata mesajı gösteriliyor
  - useRef ile çift çağrı önleniyor (React strict mode)

  GÜVENLİK:
  - Sadece HS256 algoritması kabul ediliyor (algorithm confusion koruması)
  - Token süresi 5dk (Portal tarafında ayarlanır)
  - PDKS'de kayıtlı olmayan kullanıcı girişi reddediliyor
  - Otomatik kullanıcı oluşturma YOK
  - Token URL'den hemen temizleniyor

  PORTAL TARAFINDA GEREKLİ:
  - SSO_SECRET_KEY paylaşımı (aynı gizli anahtar)
  - GET /api/integrations/pdks/launch-url endpoint
  - PDKS kartı eklenmesi (uygulamalar sayfasına)

  Değişen backend: 3 (.env.example, auth.service.ts, auth.controller.ts)
  Değişen config: 1 (docker-compose.yml)
  Değişen frontend: 1 (Login/index.tsx)
)
---------------------------------------------------------
Rev. ID    : 016
Rev. Date  : 19.02.2026
Rev. Time  : 08:55:00
Rev. Prompt: Cihaz zaman senkronizasyonu (otomatik saat düzeltme)

Rev. Report: (
  Sync döngüsüne cihaz zaman kontrolü eklendi. Her senkronizasyonda
  cihaz saati sunucu saatiyle karşılaştırılıyor, 60 saniyeden fazla
  sapma varsa otomatik düzeltiliyor.

  ZKTECO CLIENT:
  - setTime(zk, date) metodu eklendi — cihaz saatini ayarlar

  SYNC SERVICE:
  - checkAndSyncTime() metodu eklendi — her sync öncesi çalışır
  - Cihaz saatini getTime() ile okur, UTC+3 offset ile sunucu saatine
    karşılaştırır
  - Fark > 60s ise setTime() ile düzeltir, log yazar
  - Hata olursa attendance sync'i engellemez (try-catch)
  - TIME_SYNC_THRESHOLD_SECONDS = 60 (eşik değer)
  - TURKEY_OFFSET_MS = 3 saat (UTC+3)

  TEST SONUÇLARI:
  - Fabrika 2 (192.168.152.233): drift -1s → düzeltme gerekmedi
  - Fabrika 1 (192.168.204.233): drift -10123000s (~117 gün geri)
    → otomatik düzeltildi, sonraki döngüde drift 0s

  Değişen dosyalar: 2 (zkteco-client.service.ts, sync.service.ts)
)
---------------------------------------------------------
