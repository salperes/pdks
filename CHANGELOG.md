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
