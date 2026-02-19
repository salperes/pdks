# PDKS - Changelog

> Max 11 kayıt tutulur. 11 kayıt dolunca eski 1-10 arşivlenir (`temp/changelog{NNN}-{NNN}.md`),
> yeni dosya eski dosyanın son kaydıyla başlar (bağlam referansı olarak).
> Arşiv: temp/changelog_001-010.md, temp/changelog_010-020.md

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
Rev. ID    : 021
Rev. Date  : 19.02.2026
Rev. Time  : 17:02:00
Rev. Prompt: Cihaz lokasyon güncelleme hatası düzeltmesi

Rev. Report: (
  Cihaz düzenleme modalında lokasyon değişikliğinin kaydedilmemesi sorunu
  düzeltildi. İki ayrı hata tespit edilip giderildi.

  BACKEND — DEVICES SERVICE:
  - update() metodu değiştirildi: Object.assign + save yerine
    repository.update() + findById kullanılıyor
  - Neden: TypeORM findById ile yüklenen location relation nesnesi,
    save() sırasında yeni locationId'yi eziyor (relation öncelikli)
  - Düzeltme: repository.update() doğrudan SQL UPDATE çalıştırır,
    relation çakışması olmaz

  FRONTEND — CİHAZ SAYFASI:
  - handleSave payload'ında locationId artık her zaman gönderiliyor
  - Lokasyon seçildiyse: UUID gönderilir
  - Lokasyon temizlendiyse: null gönderilir
  - Önceki: if (form.locationId) koşulu boş string'i atlıyordu

  Değişen backend: 1 (devices.service.ts)
  Değişen frontend: 1 (Devices/index.tsx)
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
Rev. ID    : 022
Rev. Date  : 19.02.2026
Rev. Time  : 17:24:00
Rev. Prompt: Lokasyon sayfasında cihaz sayısı 0 gösterme hatası düzeltmesi

Rev. Report: (
  Lokasyonlar sayfasında cihaz sayısının her zaman 0 görünmesi sorunu
  düzeltildi. Backend ve frontend arasında alan adı uyumsuzluğu vardı.

  BACKEND — LOCATIONS SERVICE:
  - findAll() içindeki loadRelationCountAndMap alan adı düzeltildi:
    'l.deviceCount' → 'l.devicesCount'
  - Frontend Location interface'i 'devicesCount' bekliyor, backend
    'deviceCount' döndürüyordu → undefined ?? 0 = her zaman 0

  Değişen backend: 1 (locations.service.ts)
)
---------------------------------------------------------
Rev. ID    : 023
Rev. Date  : 19.02.2026
Rev. Time  : 19:58:58
Rev. Prompt: E-posta entegrasyonu — SMTP ayarları, bildirimler, gönderim geçmişi

Rev. Report: (
  Sisteme tam e-posta gönderim altyapısı eklendi. Admin ayarlar sayfasında
  SMTP yapılandırması, 3 farklı bildirim türü ve gönderim geçmişi izleme.

  BACKEND — YENİ BAĞIMLILIK:
  - nodemailer + @types/nodemailer kuruldu

  BACKEND — YENİ ENTITY (EmailLog):
  - email_logs tablosu: id, type, recipients, subject, status, error_message, created_at
  - type: 'absence_warning' | 'hr_daily_report' | 'system_error' | 'test'

  BACKEND — SystemSettings ENTITY GENİŞLETME:
  - 14 yeni kolon eklendi: SMTP ayarları (host, port, security, username, password,
    from_address, from_name), email_enabled ana toggle, 3 bildirim türü için
    enabled/recipients/time alanları

  BACKEND — YENİ MODÜL (EmailModule):
  - email.module.ts: Module tanımı, entity importları
  - email.service.ts: SMTP transport, zamanlanmış görevler (@Interval 60sn),
    devamsızlık uyarısı (kart basmayanlara), İK günlük raporu (özet tablo),
    sistem hatası bildirimi (cihaz başına 30dk throttle), test e-postası,
    çift gönderim koruması (in-memory + DB), tatil/hafta sonu kontrolü
  - email.controller.ts: test-connection, send-test, logs endpoint'leri

  BACKEND — MEVCUT DOSYA DEĞİŞİKLİKLERİ:
  - entities/index.ts: EmailLog export eklendi
  - app.module.ts: EmailLog entity + EmailModule import
  - settings.service.ts: smtpPassword maskeleme ('********'), email alanları tip genişletme
  - settings.controller.ts: body tipine email alanları eklendi
  - sync.service.ts: EmailService inject, sync hatalarında sendSystemErrorNotification()
  - device-comm.module.ts: EmailModule import

  FRONTEND — AYARLAR SAYFASI:
  - E-posta Ayarları kartı eklendi (Ayarları Kaydet ile Tatil Günleri arasında)
  - Ana toggle: E-posta Bildirimlerini Etkinleştir
  - SMTP Yapılandırması: sunucu, port (25/465/587), güvenlik (Yok/TLS/SSL),
    kullanıcı adı, şifre, gönderen adresi, gönderen adı
  - Bağlantı Testi ve Test E-postası Gönder butonları + sonuç gösterimi
  - Bildirim Türleri: Devamsızlık Uyarısı (toggle+saat+alıcılar),
    İK Günlük Rapor (toggle+saat+alıcılar), Sistem Hatası (toggle+alıcılar)
  - E-posta Gönderim Geçmişi tablosu (tarih, tür, alıcı, konu, durum)

  Yeni dosyalar: 3 (email-log.entity.ts, email.module.ts, email.service.ts, email.controller.ts)
  Değişen backend: 6 (system-settings.entity.ts, entities/index.ts, app.module.ts,
    settings.service.ts, settings.controller.ts, sync.service.ts, device-comm.module.ts)
  Değişen frontend: 1 (Settings/index.tsx)
)
---------------------------------------------------------
