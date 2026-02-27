# PDKS - Changelog

> Max 11 kayıt tutulur. 11 kayıt dolunca eski 1-10 arşivlenir (`temp/changelog{NNN}-{NNN}.md`),
> yeni dosya eski dosyanın son kaydıyla başlar (bağlam referansı olarak).
> Arşiv: temp/changelog_001-010.md, temp/changelog_010-020.md, temp/changelog_020-029.md

---------------------------------------------------------
Rev. ID    : 028
Rev. Date  : 22.02.2026
Rev. Time  : 17:58:54
Rev. Prompt: Bildirim sistemi msgService'e taşıma — çift kanal (e-posta + WhatsApp)

Rev. Report: (
  Tüm bildirim gönderimlerini nodemailer/SMTP'den msgService API'sine taşıdı.
  E-posta Ayarları kartı kaldırıldı, bildirim türleri Mesajlaşma Servisi altına
  birleştirildi. Her bildirim türü artık hem e-posta hem WhatsApp kanalını
  bağımsız olarak destekliyor.

  BACKEND — SystemSettings Entity:
  - 9 yeni kolon eklendi (her bildirim türü için email/WA toggle + WA alıcıları):
    notify_absence_email_enabled, notify_absence_wa_enabled, notify_absence_wa_recipients,
    notify_hr_email_enabled, notify_hr_wa_enabled, notify_hr_wa_recipients,
    notify_system_error_email_enabled, notify_system_error_wa_enabled,
    notify_system_error_wa_recipients
  - SMTP kolonları @deprecated olarak işaretlendi (silinmedi, kullanılmıyor)

  BACKEND — EmailLog Entity:
  - channel kolonu eklendi (varchar(20), default: 'email') — 'email' | 'whatsapp'

  BACKEND — EmailModule:
  - MessagingModule import eklendi (MessagingService enjeksiyonu için)

  BACKEND — EmailService (tam refactor):
  - nodemailer import ve getTransporter() kaldırıldı
  - MessagingService constructor'a enjekte edildi
  - sendEmail(): nodemailer yerine messagingService.sendEmail() kullanıyor
  - Yeni sendWhatsAppNotification(): WA gönderimi + EmailLog kaydı (channel: 'whatsapp')
  - scheduledCheck(): Guard emailEnabled → msgServiceEnabled olarak değişti
  - sendAbsenceWarnings(): Çift kanal — e-posta + WhatsApp bağımsız gönderim
  - sendHrDailyReport(): Çift kanal
  - sendSystemErrorNotification(): Guard güncellendi + WA kanalı eklendi
  - testConnection() ve sendTestEmail() kaldırıldı (MessagingController hallediyor)
  - getEmailLogs(): Opsiyonel channel filtresi eklendi

  BACKEND — EmailController:
  - POST /email/test-connection kaldırıldı
  - POST /email/send-test kaldırıldı
  - GET /email/logs: channel query parametresi eklendi

  BACKEND — Settings Service/Controller:
  - Pick tipine ve body tipine 9 yeni alan eklendi

  FRONTEND — Settings Sayfası (büyük refactor):
  - EmailSettings + MsgServiceSettings interfaceleri → birleşik NotificationSettings
  - EmailLogEntry → NotificationLogEntry (channel alanı eklendi)
  - Ayrık state'ler → tek notifSettings state'i
  - E-posta Ayarları kartı tamamen kaldırıldı
  - Mesajlaşma Servisi kartı genişletildi → "Mesajlaşma & Bildirimler":
    · Master toggle + bağlantı ayarları (URL + API Key)
    · Test butonları (bağlantı, e-posta, WhatsApp)
    · Bildirim Türleri: her tür için master toggle + kanal toggle'ları
      - Devamsızlık: saat + e-posta toggle/alıcılar + WA toggle/telefonlar
      - İK Rapor: saat + e-posta toggle/alıcılar + WA toggle/telefonlar
      - Sistem Hatası: e-posta toggle/alıcılar + WA toggle/telefonlar
    · Bildirim Geçmişi tablosu — Kanal kolonu (e-posta mavi / WhatsApp yeşil badge)

  Değişen backend: 7 (system-settings.entity.ts, email-log.entity.ts,
    email.module.ts, email.service.ts, email.controller.ts,
    settings.service.ts, settings.controller.ts)
  Değişen frontend: 1 (Settings/index.tsx)
)
---------------------------------------------------------
Rev. ID    : 030
Rev. Date  : 26.02.2026
Rev. Time  : 18:35:19
Rev. Prompt: Operatör paneli yeniden tasarım — iki sekmeli form + route kısıtlaması

Rev. Report: (
  Operatör paneli tamamen yeniden tasarlandı. Modal yerine iki sekmeli inline
  form yapısına geçildi. Operatör kullanıcıları artık sadece operatör paneline
  erişebiliyor (diğer sayfalar kısıtlı).

  BACKEND — TempCardAssignment Entity:
  - 4 yeni kolon: document_type (kimlik/ehliyet/pasaport), shelf_no,
    visited_personnel_id (FK→Personnel), visit_reason
  - visitedPersonnel ManyToOne relation eklendi

  BACKEND — IssueTempCardDto:
  - 5 yeni alan: guestPhone, documentType, shelfNo, visitedPersonnelId, visitReason

  BACKEND — OperatorPanelService:
  - issueTempCard: guestPhone desteği, yeni alanlar assignment kaydına dahil
  - getActiveAssignments: visitedPersonnel relation join eklendi
  - getHistory: visitedPersonnel relation eklendi

  FRONTEND — App.tsx (Route Kısıtlaması):
  - OperatorRedirect bileşeni eklendi: operator rolündeki kullanıcıları
    /operator-panel'e yönlendiriyor
  - Tüm non-operator route'lar OperatorRedirect ile sarmalandı
  - Operatör artık dashboard, personel, cihazlar, raporlar vb. sayfalara erişemiyor

  FRONTEND — Sidebar.tsx:
  - Operatör rolü sadece "Operatör Paneli" navigasyon öğesini görüyor
  - Admin/viewer rolleri ise tüm menü yapısını görmeye devam ediyor

  FRONTEND — OperatorPanel/index.tsx (Tam Yeniden Yazım):
  - Modal tabanlı tasarım → inline iki sekmeli form tasarımına geçildi
  - Ana görünüm: "Geçici Kart Ver" formu + "Geçmiş" arasında geçiş
  - Form sekmeleri:
    · "Misafir Geçici Kart": ad, soyad, telefon, kimlik türü dropdown
      (kimlik/ehliyet/pasaport), raf no, ziyaret edilen personel (aranabilir),
      ziyaret nedeni (textarea)
    · "Personel Geçici Kart": personel arama (typeahead) + sağ tarafta
      fotoğraf önizleme
  - Ortak alanlar: bitiş zamanı (9:00/12:00/15:00/18:00 dropdown, varsayılan
    18:00), kart no, cihaz seçimi (lokasyon bazlı gruplu)
  - Aktif kartlar tablosu formun altında gösteriliyor
  - Geçmiş görünümü sayfalı tablo
  - PersonnelSearchField: yeniden kullanılabilir arama bileşeni (debounce)

  FRONTEND — types/index.ts:
  - TempCardAssignment: documentType, shelfNo, visitedPersonnelId,
    visitedPersonnel, visitReason alanları eklendi

  Değişen backend: 3 (temp-card-assignment.entity.ts, issue-temp-card.dto.ts,
    operator-panel.service.ts)
  Değişen frontend: 4 (App.tsx, Sidebar.tsx, OperatorPanel/index.tsx, types/index.ts)
)
---------------------------------------------------------
Rev. ID    : 031
Rev. Date  : 26.02.2026
Rev. Time  : 18:51:25
Rev. Prompt: Operatör paneli — kart geri verme + geçiş kayıtları sekmeleri

Rev. Report: (
  Operatör paneline iki yeni sekme eklendi: "Kart Geri Verme" ve "Geçiş Kayıtları".
  Toplam 4 sekme: Misafir Geçici Kart, Personel Geçici Kart, Kart Geri Verme,
  Geçiş Kayıtları. Backend değişikliği gerekmedi — mevcut endpoint'ler yeterli.

  FRONTEND — OperatorPanel/index.tsx (Yeniden Yapılandırma):
  - 2 sekmeli yapı → 4 sekmeli yapıya geçildi
  - view state: 'form' | 'history' → 'guest' | 'personnel' | 'return' | 'access-logs'
  - formTab state kaldırıldı (guest/personnel artık doğrudan üst seviye sekme)
  - Üst bar: 4 sekme butonu (ikon + etiket), lokasyon bilgisi gösterimi
  - Bileşen ayrımı: FormSection, ReturnSection, AccessLogsSection alt bileşenlere bölündü

  SEKME 3 — Kart Geri Verme (ReturnSection):
  - Alt sekmeler: "Aktif Kartlar" + "Geçmiş"
  - Aktif kartlar: mevcut tablonun form altından buraya taşınması
  - Her satırda "Geri Al" butonu (revoke işlemi)
  - fetchActive() artık locationId parametresi gönderiyor (operatörün lokasyonu)
  - Geçmiş: sayfalı tablo (mevcut history view'ın taşınması)
  - Boş durum gösterimi (CreditCard ikonu + mesaj)

  SEKME 4 — Geçiş Kayıtları (AccessLogsSection):
  - Operatörün varsayılan lokasyonundaki giriş/çıkış kayıtları
  - Lokasyon atanmamışsa bilgi mesajı (AlertCircle)
  - Filtreler: tarih (bugün varsayılan), personel arama (Enter veya Ara butonu)
  - Tablo: Personel (ad + departman), Cihaz, Zaman, Yön (Giriş/Çıkış badge)
  - Sayfalama (50/sayfa)
  - 30 saniyede bir auto-refresh
  - Manuel yenile butonu (RefreshCw ikonu, yüklenirken animasyon)
  - Mevcut GET /access-logs?locationId=...&startDate=...&endDate=... endpoint'i kullanılıyor

  Değişen dosyalar: 1 (OperatorPanel/index.tsx)
)
---------------------------------------------------------
Rev. ID    : 032
Rev. Date  : 26.02.2026
Rev. Time  : 19:02:33
Rev. Prompt: Geçici kart otomatik revoke — 1 saat grace period

Rev. Report: (
  Geçici kartların otomatik temizleme zamanlaması değiştirildi. Önceden kart
  süre dolduğu anda (~60sn içinde) cihazlardan siliniyordu. Artık süre
  dolduktan 1 saat sonra silinecek (grace period).

  BACKEND — OperatorPanelService.cleanupExpired():
  - LessThan(new Date()) → LessThan(new Date(Date.now() - 1h))
  - graceMs = 60 * 60 * 1000 (1 saat)
  - Örnek: expiresAt=18:00 → cihazdan silme 19:00'da gerçekleşir

  Değişen dosyalar: 1 (operator-panel.service.ts)
)
---------------------------------------------------------
Rev. ID    : 033
Rev. Date  : 26.02.2026
Rev. Time  : 19:22:46
Rev. Prompt: Operatör paneli fotoğraf boyutu 1.5x büyütme

Rev. Report: (
  Operatör panelindeki personel fotoğrafları 1.5x büyütüldü.

  FRONTEND — OperatorPanel/index.tsx:
  - Personel sekmesi fotoğraf kutusu: w-24 h-28 → w-36 h-[168px] (96×112 → 144×168px)
  - Kamera placeholder ikonu: w-8 h-8 → w-12 h-12
  - İsim etiketi max genişlik: max-w-24 → max-w-36
  - Arama dropdown avatar: w-7 h-7 → w-10 h-10 (28→40px), font text-xs → text-sm

  Değişen dosyalar: 1 (OperatorPanel/index.tsx)
)
---------------------------------------------------------
