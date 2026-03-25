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
