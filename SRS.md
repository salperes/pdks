# PDKS - Personel Devam Kontrol Sistemi
## Yazılım Gereksinim Spesifikasyonu (SRS)

**Versiyon:** 1.0
**Tarih:** 17.02.2026
**Durum:** Taslak

---

## İçindekiler

1. [Giriş](#1-giris)
2. [Sistem Genel Bakış](#2-sistem-genel-bakis)
3. [Donanım Mimarisi](#3-donanim-mimarisi)
4. [Yazılım Mimarisi](#4-yazilim-mimarisi)
5. [Fonksiyonel Gereksinimler - Faz 1](#5-fonksiyonel-gereksinimler---faz-1)
6. [Fonksiyonel Gereksinimler - Faz 2](#6-fonksiyonel-gereksinimler---faz-2)
7. [Veritabanı Şeması](#7-veritabani-semasi)
8. [API Tasarımı](#8-api-tasarimi)
9. [Cihaz Haberleşme Protokolü](#9-cihaz-haberlesme-protokolu)
10. [Kullanıcı Arayüzü](#10-kullanici-arayuzu)
11. [Fonksiyonel Olmayan Gereksinimler](#11-fonksiyonel-olmayan-gereksinimler)
12. [Deployment Mimarisi](#12-deployment-mimarisi)
13. [Riskler ve Kısıtlar](#13-riskler-ve-kisitlar)

---

## 1. Giriş

### 1.1 Amaç

Bu doküman, PDKS (Personel Devam Kontrol Sistemi) yazılımının gereksinimlerini tanımlar. Sistem, çeşitli lokasyonlarda bulunan ZKTeco SC403 kart okuyucular ve turnikeler aracılığıyla personel giriş/çıkış takibi yapmayı amaçlar.

### 1.2 Kapsam

- **Faz 1:** Giriş/çıkış takibi, cihaz yönetimi, personel yönetimi, gerçek zamanlı izleme, raporlama
- **Faz 2:** Vardiya yönetimi, izin/devamsızlık takibi, mesai/fazla mesai hesaplama

### 1.3 Tanımlar ve Kısaltmalar

| Terim | Açıklama |
|-------|----------|
| **PDKS** | Personel Devam Kontrol Sistemi |
| **SC403** | ZKTeco SC403 RFID Standalone Access Control Terminal |
| **Turnikele** | Geçiş kontrol bariyeri, SC403 tarafından kontrol edilir |
| **Geçiş Kaydı** | Bir personelin kart okutarak yaptığı giriş veya çıkış olayı |
| **Lokasyon** | Kart okuyucu ve turnikele bulunan fiziksel alan (bina, şantiye, tesis vb.) |
| **Polling** | Sunucunun periyodik olarak cihazdan veri çekmesi |
| **Push Event** | Cihazın gerçek zamanlı olarak sunucuya olay göndermesi |

### 1.4 Referanslar

- [ZKTeco SC403 Ürün Sayfası](https://www.zkteco-sa.com/product-details/sc403)
- [ZKTeco Standalone SDK](https://github.com/ZKTeco/Standalone-SDK)
- [ZKTeco İletişim Protokolü (Topluluk Dökümantasyonu)](https://github.com/adrobinoga/zk-protocol/blob/master/protocol.md)
- [zkteco-js - Node.js SDK](https://github.com/coding-libs/zkteco-js)

---

## 2. Sistem Genel Bakış

### 2.1 Sistem Bileşenleri

```
┌─────────────────────────────────────────────────────────┐
│                    PDKS Sistemi                          │
│                                                          │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │  React    │◄──►│  NestJS      │◄──►│ PostgreSQL   │   │
│  │  Frontend │    │  Backend     │    │ Veritabanı   │   │
│  └──────────┘    └──────┬───────┘    └──────────────┘   │
│                         │                                │
│                         │ TCP/IP                         │
│                         ▼                                │
│         ┌───────────────────────────────┐                │
│         │     Cihaz Haberleşme Katmanı  │                │
│         │     (ZKTeco Protokolü)        │                │
│         └───────┬───────┬───────┬───────┘                │
│                 │       │       │                         │
│                 ▼       ▼       ▼                         │
│           ┌────────┐ ┌────────┐ ┌────────┐              │
│           │ SC403  │ │ SC403  │ │ SC403  │  ...          │
│           │ Lok.1  │ │ Lok.2  │ │ Lok.N  │              │
│           └───┬────┘ └───┬────┘ └───┬────┘              │
│               │          │          │                    │
│           ┌───┴────┐ ┌───┴────┐ ┌───┴────┐              │
│           │Turnikele│ │Turnikele│ │Turnikele│             │
│           └────────┘ └────────┘ └────────┘              │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Çalışma Prensibi

1. Personel, lokasyondaki SC403 cihazına RFID kartını okutarak geçiş yapar
2. SC403 cihazı **hibrit modda** çalışır:
   - **Online:** Kendi yerel veritabanına göre geçiş kararı verir + sunucuya gerçek zamanlı event gönderir
   - **Offline:** Sunucu erişilemezse, cihaz kendi yerel veritabanı ile çalışmaya devam eder. Loglar cihazda birikir
3. Sunucu iki yöntemle veri toplar:
   - **Real-time events:** Cihaz her geçişte TCP üzerinden push event gönderir
   - **Periyodik senkronizasyon:** Sunucu düzenli aralıklarla cihazdan logları çeker (veri bütünlüğü kontrolü)
4. Web arayüzü üzerinden gerçek zamanlı izleme, raporlama ve yönetim yapılır

### 2.3 Ölçek

| Parametre | Değer |
|-----------|-------|
| Lokasyon sayısı | 1-5 |
| Toplam personel | <500 |
| Cihaz sayısı (maks.) | ~20 (lokasyon başına birden fazla olabilir) |
| Eşzamanlı web kullanıcısı | ~10-20 |

---

## 3. Donanım Mimarisi

### 3.1 ZKTeco SC403 Özellikleri

| Özellik | Değer |
|---------|-------|
| Doğrulama | RFID kart (125kHz EM) + PIN |
| Kart kapasitesi | 30.000 |
| Log kapasitesi | 100.000 |
| Haberleşme | TCP/IP, RS232/485 |
| Ek portlar | Wiegand giriş/çıkış, kilit kontrol, alarm, kapı sensörü, çıkış butonu |
| Ekran | LCD (menü ve konfigürasyon için) |
| USB | USB-Host (veri aktarımı için) |
| Boyutlar | 143 × 95.5 × 39.5 mm |

### 3.2 Turnikele Entegrasyonu

SC403 cihazı turnikeleyi doğrudan kontrol eder:
- **Kilit kontrol çıkışı** → turnikele açma sinyali
- **Kapı sensörü girişi** → geçiş tamamlandı sinyali
- **Çıkış butonu** → acil çıkış / içeriden geçiş

### 3.3 Ağ Topolojisi

```
                    ┌──────────────┐
                    │   Sunucu     │
                    │  (Backend)   │
                    └──────┬───────┘
                           │
                    ┌──────┴───────┐
                    │   Switch /   │
                    │   Router     │
                    └──┬───┬───┬───┘
                       │   │   │
            ┌──────────┘   │   └──────────┐
            │              │              │
     ┌──────┴──────┐ ┌────┴──────┐ ┌─────┴─────┐
     │  Lokasyon 1 │ │ Lokasyon 2│ │ Lokasyon N │
     │  SC403 (×N) │ │ SC403 (×N)│ │ SC403 (×N) │
     │  + Turnikele│ │ + Turnikele│ │ + Turnikele│
     └─────────────┘ └───────────┘ └───────────┘
```

Her SC403 cihazı statik IP adresi ile ağda yer alır. Cihazlar sunucu ile aynı ağda veya VPN/VLAN üzerinden erişilebilir olmalıdır.

---

## 4. Yazılım Mimarisi

### 4.1 Teknoloji Stack

| Katman | Teknoloji |
|--------|-----------|
| **Backend** | NestJS (Node.js + TypeScript) |
| **Frontend** | React 18+ (TypeScript, Vite) |
| **Styling** | Tailwind CSS (dark mode: `class` stratejisi) |
| **State Management** | Zustand (persist middleware ile) |
| **Data Fetching** | TanStack Query (React Query) |
| **HTTP Client** | Axios (JWT interceptor ile) |
| **İkonlar** | Lucide React |
| **Routing** | React Router v7 |
| **Veritabanı** | PostgreSQL |
| **Cache** | Redis (opsiyonel, oturum yönetimi) |
| **Cihaz SDK** | zkteco-js veya özel TCP client (ZKTeco protokolü) |
| **Gerçek zamanlı** | WebSocket (Socket.IO) - frontend'e canlı geçiş bildirimi |
| **Containerization** | Docker + Docker Compose |

> **Not:** Frontend tasarım dili MSS Portal ile tutarlıdır. Detaylı UI pattern'leri, component örnekleri, renk paleti ve tema sistemi için bkz. [ui_template.md](ui_template.md)

### 4.2 Backend Modülleri

```
src/
├── app.module.ts
├── main.ts
│
├── auth/                    # Kimlik doğrulama
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── jwt.strategy.ts
│   └── guards/
│
├── users/                   # Kullanıcı yönetimi (web kullanıcıları)
│   ├── users.module.ts
│   ├── users.controller.ts
│   └── users.service.ts
│
├── personnel/               # Personel yönetimi (kart sahipleri)
│   ├── personnel.module.ts
│   ├── personnel.controller.ts
│   └── personnel.service.ts
│
├── devices/                 # Cihaz yönetimi (SC403)
│   ├── devices.module.ts
│   ├── devices.controller.ts
│   ├── devices.service.ts
│   └── device-health.service.ts
│
├── access-logs/             # Geçiş kayıtları
│   ├── access-logs.module.ts
│   ├── access-logs.controller.ts
│   └── access-logs.service.ts
│
├── locations/               # Lokasyon yönetimi
│   ├── locations.module.ts
│   ├── locations.controller.ts
│   └── locations.service.ts
│
├── device-comm/             # Cihaz haberleşme katmanı
│   ├── device-comm.module.ts
│   ├── zkteco-client.service.ts   # TCP bağlantı yönetimi
│   ├── sync.service.ts            # Periyodik senkronizasyon
│   └── realtime.service.ts        # Gerçek zamanlı event dinleme
│
├── reports/                 # Raporlama
│   ├── reports.module.ts
│   ├── reports.controller.ts
│   └── reports.service.ts
│
├── gateway/                 # WebSocket gateway
│   ├── gateway.module.ts
│   └── events.gateway.ts
│
├── entities/                # TypeORM entity'leri
│   ├── user.entity.ts
│   ├── personnel.entity.ts
│   ├── device.entity.ts
│   ├── location.entity.ts
│   └── access-log.entity.ts
│
└── common/                  # Ortak utility'ler
    ├── decorators/
    ├── filters/
    ├── interceptors/
    └── dto/
```

### 4.3 Frontend Yapısı

```
src/
├── App.tsx
├── main.tsx
├── index.css                        # Tailwind directives
│
├── components/
│   ├── common/                      # Button, Card, Modal, Avatar, Badge,
│   │                                  Alert, Dropdown, Loading, EmptyState
│   ├── forms/                       # Input, Select, Textarea, Checkbox, SearchInput
│   ├── layout/                      # Layout, Header, Sidebar, PageHeader
│   └── dashboard/                   # Dashboard widget'ları
│
├── pages/
│   ├── Login/
│   ├── Dashboard/                   # Ana dashboard (canlı geçişler, istatistikler)
│   ├── Personnel/                   # Personel listesi ve detay
│   ├── Devices/                     # Cihaz yönetimi ve durum
│   ├── Locations/                   # Lokasyon yönetimi
│   ├── AccessLogs/                  # Geçiş kayıtları (filtreleme + arama)
│   ├── Reports/                     # Raporlar
│   └── Admin/
│       ├── Users/                   # Web kullanıcı yönetimi
│       └── Settings/               # Sistem ayarları
│
├── hooks/
│   ├── useWebSocket.ts              # Gerçek zamanlı event hook
│   ├── usePersonnel.ts              # TanStack Query hooks
│   ├── useDevices.ts
│   └── useAccessLogs.ts
│
├── services/
│   ├── api.ts                       # Axios instance + JWT interceptors
│   ├── personnelApi.ts
│   ├── devicesApi.ts
│   └── accessLogsApi.ts
│
├── store/
│   ├── authStore.ts                 # Zustand + persist
│   └── themeStore.ts                # Light/dark tema
│
└── types/                           # TypeScript type tanımları
```

### 4.4 Frontend Mimari Kararlar

| Karar | Açıklama |
|-------|----------|
| **Layout** | Fixed header (h-12, `#001529`) + fixed sidebar (w-64) + scrollable content area |
| **Tema** | Zustand persist ile `dark` class toggle, Tailwind `darkMode: 'class'` |
| **API Pattern** | Axios instance → feature-specific API service → TanStack Query hook → component |
| **Auth Flow** | Login → JWT token → localStorage → Axios interceptor auto-attach → 401'de refresh |
| **Renk sistemi** | Primary: `#0078d4`, Dark navy: `#001529`, Status: emerald/amber/red |
| **Component stilleri** | Tailwind utility classes, rounded-lg, shadow-sm, border pattern |

> Tüm component pattern'leri (Button, Card, Modal, Alert, Badge, Avatar, Form elemanları, Loading/Empty state) [ui_template.md](ui_template.md) dosyasında kod örnekleri ile tanımlıdır.

---

## 5. Fonksiyonel Gereksinimler - Faz 1

### 5.1 Kimlik Doğrulama ve Yetkilendirme (AUTH)

| ID | Gereksinim | Öncelik |
|----|-----------|---------|
| AUTH-01 | Sistem, kullanıcı adı ve şifre ile giriş yapılabilmelidir | Yüksek |
| AUTH-02 | JWT tabanlı oturum yönetimi kullanılmalıdır (access + refresh token) | Yüksek |
| AUTH-03 | Kullanıcı rolleri desteklenmelidir: `admin`, `operator`, `viewer` | Yüksek |
| AUTH-04 | Admin tüm işlemleri yapabilmeli, operator geçiş kayıtlarını ve personeli yönetebilmeli, viewer sadece görüntüleyebilmelidir | Yüksek |
| AUTH-05 | Başarısız giriş denemelerinde hesap geçici olarak kilitlenmelidir (5 deneme → 15 dk kilit) | Orta |

**Roller ve Yetkiler:**

| Yetenek | Admin | Operator | Viewer |
|---------|-------|----------|--------|
| Dashboard görüntüleme | ✅ | ✅ | ✅ |
| Geçiş kayıtlarını görüntüleme | ✅ | ✅ | ✅ |
| Rapor oluşturma | ✅ | ✅ | ✅ |
| Personel ekleme/düzenleme | ✅ | ✅ | ❌ |
| Cihaz yönetimi | ✅ | ❌ | ❌ |
| Lokasyon yönetimi | ✅ | ❌ | ❌ |
| Kullanıcı yönetimi | ✅ | ❌ | ❌ |
| Sistem ayarları | ✅ | ❌ | ❌ |

### 5.2 Personel Yönetimi (PER)

| ID | Gereksinim | Öncelik |
|----|-----------|---------|
| PER-01 | Personel CRUD işlemleri yapılabilmelidir | Yüksek |
| PER-02 | Her personelin benzersiz bir kart numarası (RFID UID) atanmalıdır | Yüksek |
| PER-03 | Personel bilgileri: TC Kimlik No, ad, soyad, sicil no, departman, unvan, telefon, e-posta | Yüksek |
| PER-04 | Personel aktif/pasif durumu yönetilebilmelidir | Yüksek |
| PER-05 | Personel belirli lokasyonlara atanabilmelidir | Orta |
| PER-06 | Personel kartı cihazlara senkronize edilebilmelidir (web'den cihaza kart yükleme) | Yüksek |
| PER-07 | Toplu personel ekleme (CSV/Excel import) desteklenmelidir | Orta |
| PER-08 | Personel fotoğrafı yüklenebilmelidir | Düşük |
| PER-09 | Personel listesi filtreleme, arama ve sıralama desteklemelidir | Orta |

### 5.3 Lokasyon Yönetimi (LOC)

| ID | Gereksinim | Öncelik |
|----|-----------|---------|
| LOC-01 | Lokasyon CRUD işlemleri yapılabilmelidir | Yüksek |
| LOC-02 | Lokasyon bilgileri: ad, adres, açıklama, aktif/pasif durumu | Yüksek |
| LOC-03 | Her lokasyona bir veya daha fazla cihaz atanabilmelidir | Yüksek |
| LOC-04 | Lokasyon bazlı geçiş raporları alınabilmelidir | Orta |

### 5.4 Cihaz Yönetimi (DEV)

| ID | Gereksinim | Öncelik |
|----|-----------|---------|
| DEV-01 | Cihaz CRUD işlemleri yapılabilmelidir (IP, port, seri no, ad, lokasyon) | Yüksek |
| DEV-02 | Cihaz bağlantı durumu gerçek zamanlı izlenebilmelidir (online/offline) | Yüksek |
| DEV-03 | Cihaz bilgileri sorgulanabilmelidir (firmware versiyonu, kart sayısı, log sayısı, cihaz zamanı) | Orta |
| DEV-04 | Cihaz saati sunucu ile senkronize edilebilmelidir | Yüksek |
| DEV-05 | Cihaz yeniden başlatılabilmelidir (uzaktan) | Orta |
| DEV-06 | Cihaz kapısı uzaktan açılabilmelidir (acil durum) | Orta |
| DEV-07 | Cihaz üzerindeki kullanıcı (kart) listesi yönetilebilmelidir (senkronizasyon) | Yüksek |
| DEV-08 | Cihaz logları temizlenebilmelidir (senkronizasyon sonrası) | Orta |
| DEV-09 | Yeni cihaz eklendiğinde bağlantı testi yapılabilmelidir | Orta |
| DEV-10 | Cihaz offline olduğunda admin'e bildirim gönderilmelidir | Orta |

### 5.5 Geçiş Kayıtları (LOG)

| ID | Gereksinim | Öncelik |
|----|-----------|---------|
| LOG-01 | Cihazlardan alınan tüm kart okuma olayları veritabanına kaydedilmelidir | Yüksek |
| LOG-02 | Her geçiş kaydı: personel, cihaz, lokasyon, zaman damgası, yön (giriş/çıkış) bilgilerini içermelidir | Yüksek |
| LOG-03 | Giriş/çıkış yönü otomatik belirlenmelidir (cihaz bazlı veya sıralı geçiş mantığı) | Yüksek |
| LOG-04 | Geçiş kayıtları tarih aralığı, personel, lokasyon, departman bazında filtrelenebilmelidir | Yüksek |
| LOG-05 | Tanımsız kart okumaları ayrıca loglanmalı ve raporlanmalıdır | Orta |
| LOG-06 | Geçiş kayıtları Excel/CSV olarak dışa aktarılabilmelidir | Orta |
| LOG-07 | Gerçek zamanlı geçiş feed'i dashboard'da gösterilmelidir (WebSocket) | Yüksek |

### 5.6 Giriş/Çıkış Yönü Belirleme (DIR)

| ID | Gereksinim | Öncelik |
|----|-----------|---------|
| DIR-01 | Cihaz bazlı yön atama desteklenmelidir (bir cihaz sadece giriş, diğeri sadece çıkış) | Yüksek |
| DIR-02 | Tek cihazlı lokasyonlarda toggle mantığı kullanılmalıdır (ilk okuma = giriş, ikinci = çıkış) | Yüksek |
| DIR-03 | Yön belirleme kuralları lokasyon bazında konfigüre edilebilmelidir | Orta |

### 5.7 Dashboard ve Gerçek Zamanlı İzleme (DASH)

| ID | Gereksinim | Öncelik |
|----|-----------|---------|
| DASH-01 | Anlık lokasyon bazında personel sayısı gösterilmelidir (içeride/dışarıda) | Yüksek |
| DASH-02 | Son geçiş kayıtları canlı akış olarak gösterilmelidir | Yüksek |
| DASH-03 | Cihaz durumları özet olarak gösterilmelidir (online/offline/hata) | Yüksek |
| DASH-04 | Günlük giriş/çıkış istatistikleri grafik olarak gösterilmelidir | Orta |
| DASH-05 | Bugün henüz giriş yapmamış personel listesi gösterilmelidir | Orta |
| DASH-06 | Lokasyon bazlı doluluk durumu gösterilmelidir | Düşük |

### 5.8 Raporlama (RPT)

| ID | Gereksinim | Öncelik |
|----|-----------|---------|
| RPT-01 | Günlük puantaj raporu: personel bazında giriş, çıkış, toplam çalışma süresi | Yüksek |
| RPT-02 | Aylık puantaj özeti: personel bazında çalışılan gün sayısı, toplam saat | Yüksek |
| RPT-03 | Devamsızlık raporu: belirli tarih aralığında giriş yapmayan personel | Yüksek |
| RPT-04 | Geç kalma raporu: tanımlı mesai başlangıcına göre geç giriş yapan personel | Orta |
| RPT-05 | Erken çıkma raporu: tanımlı mesai bitişinden önce çıkan personel | Orta |
| RPT-06 | Departman bazlı özet rapor | Orta |
| RPT-07 | Lokasyon bazlı geçiş yoğunluğu raporu | Düşük |
| RPT-08 | Tüm raporlar PDF ve Excel formatında dışa aktarılabilmelidir | Orta |
| RPT-09 | Raporlar için varsayılan mesai saatleri tanımlanabilmelidir (Faz 1'de basit) | Orta |

### 5.9 Cihaz Senkronizasyonu (SYNC)

| ID | Gereksinim | Öncelik |
|----|-----------|---------|
| SYNC-01 | Sunucu periyodik olarak tüm cihazlardan geçiş loglarını çekmelidir (configurable interval, varsayılan: 1 dk) | Yüksek |
| SYNC-02 | Cihazlardan gelen real-time event'ler dinlenmelidir | Yüksek |
| SYNC-03 | Duplicate log tespiti yapılmalıdır (aynı kaydın birden fazla kaydedilmesi engellenmeli) | Yüksek |
| SYNC-04 | Personel kartları sunucudan cihaza toplu olarak yüklenebilmelidir | Yüksek |
| SYNC-05 | Cihaz offline olduktan sonra tekrar online olduğunda biriken loglar otomatik senkronize edilmelidir | Yüksek |
| SYNC-06 | Senkronizasyon durumu ve geçmişi izlenebilmelidir | Orta |
| SYNC-07 | Senkronizasyon hatalarında otomatik retry mekanizması olmalıdır (exponential backoff) | Orta |

---

## 6. Fonksiyonel Gereksinimler - Faz 2

> Faz 2 gereksinimleri ileride detaylandırılacaktır. Aşağıdakiler yüksek seviye gereksinimlerdir.

### 6.1 Vardiya Yönetimi (SFT)

| ID | Gereksinim |
|----|-----------|
| SFT-01 | Esnek vardiya tanımlama (başlangıç/bitiş saati, tolerans süreleri) |
| SFT-02 | Personel-vardiya atama (bireysel ve toplu) |
| SFT-03 | Vardiya rotasyonu ve şablon desteği |
| SFT-04 | Gece vardiyası desteği (gün geçişli vardiyalar) |
| SFT-05 | Vardiyaya göre otomatik giriş/çıkış değerlendirme |

### 6.2 İzin ve Devamsızlık (LVE)

| ID | Gereksinim |
|----|-----------|
| LVE-01 | İzin türleri tanımlama (yıllık, mazeret, hastalık, doğum, vb.) |
| LVE-02 | İzin talebi oluşturma ve onay süreci |
| LVE-03 | İzin bakiye takibi |
| LVE-04 | Raporlu gün girişi ve otomatik devamsızlık kapatma |
| LVE-05 | İzin takvimi görünümü |

### 6.3 Mesai ve Fazla Mesai (OVT)

| ID | Gereksinim |
|----|-----------|
| OVT-01 | Çalışma saati otomatik hesaplama (giriş-çıkış farkı) |
| OVT-02 | Fazla mesai otomatik tespiti (vardiya tanımına göre) |
| OVT-03 | Fazla mesai onay süreci |
| OVT-04 | Hafta sonu ve resmi tatil mesai kuralları |
| OVT-05 | Aylık mesai özet raporu |

---

## 7. Veritabanı Şeması

### 7.1 ER Diyagramı

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    users     │     │  locations   │     │   devices    │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id (PK)      │     │ id (PK)      │     │ id (PK)      │
│ username     │     │ name         │     │ name         │
│ password_hash│     │ address      │     │ serial_number│
│ full_name    │     │ description  │     │ ip_address   │
│ email        │     │ is_active    │     │ port         │
│ role         │     │ created_at   │     │ location_id  │◄── FK
│ is_active    │     │ updated_at   │     │ direction    │
│ created_at   │     └──────────────┘     │ is_online    │
│ updated_at   │                          │ last_sync_at │
└──────────────┘                          │ is_active    │
                                          │ created_at   │
┌──────────────┐                          │ updated_at   │
│  personnel   │                          └──────────────┘
├──────────────┤
│ id (PK)      │     ┌──────────────────┐
│ tc_kimlik_no │     │   access_logs    │
│ first_name   │     ├──────────────────┤
│ last_name    │     │ id (PK)          │
│ employee_id  │     │ personnel_id     │◄── FK
│ card_number  │     │ device_id        │◄── FK
│ department   │     │ location_id      │◄── FK
│ title        │     │ event_time       │
│ phone        │     │ direction        │  (in/out)
│ email        │     │ source           │  (realtime/sync)
│ photo_url    │     │ raw_data         │
│ is_active    │     │ device_user_id   │
│ created_at   │     │ created_at       │
│ updated_at   │     └──────────────────┘
└──────────────┘
                     ┌──────────────────┐
                     │ unknown_events   │
                     ├──────────────────┤
                     │ id (PK)          │
                     │ device_id        │◄── FK
                     │ card_number      │
                     │ event_time       │
                     │ created_at       │
                     └──────────────────┘

                     ┌──────────────────┐
                     │  sync_history    │
                     ├──────────────────┤
                     │ id (PK)          │
                     │ device_id        │◄── FK
                     │ sync_type        │  (pull/push_card)
                     │ status           │  (success/failed)
                     │ records_synced   │
                     │ error_message    │
                     │ started_at       │
                     │ completed_at     │
                     └──────────────────┘
```

### 7.2 Tablo Detayları

#### `users` - Web Kullanıcıları

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(100) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255),
    role            VARCHAR(20) NOT NULL DEFAULT 'viewer',  -- admin, operator, viewer
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `personnel` - Personel (Kart Sahipleri)

```sql
CREATE TABLE personnel (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tc_kimlik_no    VARCHAR(11) UNIQUE,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    employee_id     VARCHAR(50) UNIQUE,                     -- sicil no
    card_number     VARCHAR(50) NOT NULL UNIQUE,            -- RFID kart UID
    department      VARCHAR(100),
    title           VARCHAR(100),
    phone           VARCHAR(20),
    email           VARCHAR(255),
    photo_url       VARCHAR(500),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_personnel_card ON personnel(card_number);
CREATE INDEX idx_personnel_department ON personnel(department);
```

#### `locations` - Lokasyonlar

```sql
CREATE TABLE locations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    address         TEXT,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `devices` - Cihazlar (SC403)

```sql
CREATE TABLE devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    serial_number   VARCHAR(100) UNIQUE,
    ip_address      VARCHAR(45) NOT NULL,
    port            INTEGER NOT NULL DEFAULT 4370,
    location_id     UUID REFERENCES locations(id),
    direction       VARCHAR(10) DEFAULT 'both',             -- in, out, both
    is_online       BOOLEAN NOT NULL DEFAULT false,
    last_sync_at    TIMESTAMPTZ,
    last_online_at  TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devices_location ON devices(location_id);
```

#### `access_logs` - Geçiş Kayıtları

```sql
CREATE TABLE access_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id    UUID REFERENCES personnel(id),
    device_id       UUID NOT NULL REFERENCES devices(id),
    location_id     UUID REFERENCES locations(id),
    event_time      TIMESTAMPTZ NOT NULL,
    direction       VARCHAR(5),                             -- in, out
    source          VARCHAR(20) NOT NULL DEFAULT 'sync',    -- realtime, sync
    device_user_id  INTEGER,                                -- cihaz üzerindeki user ID
    raw_data        JSONB,                                  -- ham cihaz verisi
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(device_id, device_user_id, event_time)           -- duplicate engelleme
);

CREATE INDEX idx_access_logs_personnel ON access_logs(personnel_id);
CREATE INDEX idx_access_logs_event_time ON access_logs(event_time);
CREATE INDEX idx_access_logs_location ON access_logs(location_id);
CREATE INDEX idx_access_logs_direction ON access_logs(direction);
CREATE INDEX idx_access_logs_composite ON access_logs(personnel_id, event_time);
```

#### `unknown_events` - Tanımsız Kart Okumaları

```sql
CREATE TABLE unknown_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID NOT NULL REFERENCES devices(id),
    card_number     VARCHAR(50) NOT NULL,
    event_time      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `sync_history` - Senkronizasyon Geçmişi

```sql
CREATE TABLE sync_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID NOT NULL REFERENCES devices(id),
    sync_type       VARCHAR(20) NOT NULL,                   -- pull_logs, push_cards, time_sync
    status          VARCHAR(20) NOT NULL,                   -- success, failed, partial
    records_synced  INTEGER DEFAULT 0,
    error_message   TEXT,
    started_at      TIMESTAMPTZ NOT NULL,
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_sync_history_device ON sync_history(device_id);
```

---

## 8. API Tasarımı

Tüm endpoint'ler `/api/v1` prefix'i altındadır. JWT Bearer token ile korunur (login hariç).

### 8.1 Auth

| Method | Endpoint | Açıklama | Yetki |
|--------|----------|----------|-------|
| POST | `/auth/login` | Kullanıcı girişi | Herkese açık |
| POST | `/auth/refresh` | Token yenileme | Herkese açık |
| POST | `/auth/logout` | Çıkış | Tüm roller |
| GET | `/auth/me` | Aktif kullanıcı bilgisi | Tüm roller |

### 8.2 Users

| Method | Endpoint | Açıklama | Yetki |
|--------|----------|----------|-------|
| GET | `/users` | Kullanıcı listesi | Admin |
| POST | `/users` | Kullanıcı oluşturma | Admin |
| GET | `/users/:id` | Kullanıcı detayı | Admin |
| PATCH | `/users/:id` | Kullanıcı güncelleme | Admin |
| DELETE | `/users/:id` | Kullanıcı silme (soft) | Admin |
| PATCH | `/users/:id/password` | Şifre değiştirme | Admin |

### 8.3 Personnel

| Method | Endpoint | Açıklama | Yetki |
|--------|----------|----------|-------|
| GET | `/personnel` | Personel listesi (filtre + sayfalama) | Tüm roller |
| POST | `/personnel` | Personel ekleme | Admin, Operator |
| GET | `/personnel/:id` | Personel detayı | Tüm roller |
| PATCH | `/personnel/:id` | Personel güncelleme | Admin, Operator |
| DELETE | `/personnel/:id` | Personel silme (soft) | Admin, Operator |
| POST | `/personnel/import` | Toplu import (CSV/Excel) | Admin |
| POST | `/personnel/:id/photo` | Fotoğraf yükleme | Admin, Operator |
| GET | `/personnel/:id/access-logs` | Personele ait geçiş kayıtları | Tüm roller |

### 8.4 Locations

| Method | Endpoint | Açıklama | Yetki |
|--------|----------|----------|-------|
| GET | `/locations` | Lokasyon listesi | Tüm roller |
| POST | `/locations` | Lokasyon ekleme | Admin |
| GET | `/locations/:id` | Lokasyon detayı | Tüm roller |
| PATCH | `/locations/:id` | Lokasyon güncelleme | Admin |
| DELETE | `/locations/:id` | Lokasyon silme (soft) | Admin |
| GET | `/locations/:id/occupancy` | Anlık doluluk | Tüm roller |

### 8.5 Devices

| Method | Endpoint | Açıklama | Yetki |
|--------|----------|----------|-------|
| GET | `/devices` | Cihaz listesi | Tüm roller |
| POST | `/devices` | Cihaz ekleme | Admin |
| GET | `/devices/:id` | Cihaz detayı | Tüm roller |
| PATCH | `/devices/:id` | Cihaz güncelleme | Admin |
| DELETE | `/devices/:id` | Cihaz silme (soft) | Admin |
| POST | `/devices/:id/test` | Bağlantı testi | Admin |
| POST | `/devices/:id/sync-time` | Saat senkronizasyonu | Admin |
| POST | `/devices/:id/sync-logs` | Manuel log çekme | Admin |
| POST | `/devices/:id/sync-cards` | Kart listesi yükleme | Admin |
| POST | `/devices/:id/open-door` | Uzaktan kapı açma | Admin |
| POST | `/devices/:id/restart` | Cihaz yeniden başlatma | Admin |
| GET | `/devices/:id/info` | Cihaz bilgileri sorgulama | Admin |

### 8.6 Access Logs

| Method | Endpoint | Açıklama | Yetki |
|--------|----------|----------|-------|
| GET | `/access-logs` | Geçiş kayıtları (filtre + sayfalama) | Tüm roller |
| GET | `/access-logs/live` | WebSocket endpoint - canlı geçiş akışı | Tüm roller |
| GET | `/access-logs/export` | CSV/Excel export | Tüm roller |
| GET | `/access-logs/unknown` | Tanımsız kart okumaları | Admin, Operator |

### 8.7 Reports

| Method | Endpoint | Açıklama | Yetki |
|--------|----------|----------|-------|
| GET | `/reports/daily` | Günlük puantaj | Tüm roller |
| GET | `/reports/monthly` | Aylık puantaj özeti | Tüm roller |
| GET | `/reports/absence` | Devamsızlık raporu | Tüm roller |
| GET | `/reports/late-arrival` | Geç kalma raporu | Tüm roller |
| GET | `/reports/early-departure` | Erken çıkma raporu | Tüm roller |
| GET | `/reports/department-summary` | Departman özeti | Tüm roller |

### 8.8 Dashboard

| Method | Endpoint | Açıklama | Yetki |
|--------|----------|----------|-------|
| GET | `/dashboard/summary` | Genel özet (personel sayısı, cihaz durumu, bugünkü istatistik) | Tüm roller |
| GET | `/dashboard/occupancy` | Lokasyon bazlı doluluk | Tüm roller |
| GET | `/dashboard/not-arrived` | Bugün gelmeyenler | Tüm roller |
| GET | `/dashboard/hourly-stats` | Saatlik giriş/çıkış dağılımı | Tüm roller |

### 8.9 Sync (Admin)

| Method | Endpoint | Açıklama | Yetki |
|--------|----------|----------|-------|
| GET | `/sync/status` | Tüm cihazların senkronizasyon durumu | Admin |
| GET | `/sync/history` | Senkronizasyon geçmişi | Admin |
| POST | `/sync/trigger-all` | Tüm cihazlardan manuel senkronizasyon tetikle | Admin |

---

## 9. Cihaz Haberleşme Protokolü

### 9.1 ZKTeco TCP/IP Protokolü

SC403, ZKTeco'nun özel TCP/IP protokolünü kullanır. Port: **4370** (varsayılan).

#### Paket Yapısı

```
┌──────────┬──────────────┬─────────────────────────────────────┐
│  Header  │ Payload Size │              Payload                │
│ (4 byte) │  (4 byte)    │          (değişken)                 │
├──────────┼──────────────┼──────┬──────┬──────┬──────┬─────────┤
│ 50 50 82 │   XX XX XX   │ CMD  │ CHK  │ SID  │ REPLY│  DATA   │
│ 7D       │   XX         │(2B)  │(2B)  │(2B)  │(2B)  │(var)    │
└──────────┴──────────────┴──────┴──────┴──────┴──────┴─────────┘
```

#### Temel Komutlar

| Komut | ID | Açıklama |
|-------|----|----------|
| CMD_CONNECT | 1000 | Bağlantı kurma, session başlatma |
| CMD_EXIT | 1001 | Bağlantı kapatma |
| CMD_ENABLEDEVICE | 1002 | Cihazı etkinleştirme |
| CMD_DISABLEDEVICE | 1003 | Cihazı devre dışı bırakma |
| CMD_RESTART | 1004 | Yeniden başlatma |
| CMD_GET_TIME | 201 | Cihaz saatini sorgulama |
| CMD_SET_TIME | 202 | Cihaz saatini ayarlama |
| CMD_ATTLOG_RRQ | 13 | Geçiş loglarını çekme |
| CMD_CLEAR_ATTLOG | 15 | Geçiş loglarını silme |
| CMD_USER_WRQ | 8 | Kullanıcı (kart) yükleme |
| CMD_USERTEMP_RRQ | 9 | Kullanıcı listesi çekme |
| CMD_DELETE_USER | 18 | Kullanıcı silme |
| CMD_UNLOCK | 31 | Kapı açma |

#### Real-time Event Yapısı

Cihaz, her geçiş olayında sunucuya özel bir TCP paketi gönderir (session ID alanı event kodu olarak kullanılır). Bu event'ler bağlantı kurulduktan sonra otomatik gelir.

### 9.2 Node.js Entegrasyon Yaklaşımı

```
┌─────────────────────────────────────────────────┐
│              device-comm Module                   │
│                                                   │
│  ┌─────────────────┐   ┌──────────────────────┐  │
│  │ ZktecoClient    │   │ DeviceManager        │  │
│  │ Service         │   │ Service              │  │
│  │                 │   │                      │  │
│  │ - connect()     │   │ - registerDevice()   │  │
│  │ - disconnect()  │   │ - removeDevice()     │  │
│  │ - getAttLogs()  │   │ - getDeviceStatus()  │  │
│  │ - getUsers()    │   │ - healthCheck()      │  │
│  │ - setUser()     │   │                      │  │
│  │ - getTime()     │   │ Aktif bağlantıları   │  │
│  │ - setTime()     │   │ yönetir (Map)        │  │
│  │ - unlock()      │   │                      │  │
│  │ - restart()     │   └──────────────────────┘  │
│  │ - onEvent()     │                              │
│  └─────────────────┘   ┌──────────────────────┐  │
│                        │ SyncScheduler        │  │
│                        │ Service              │  │
│                        │                      │  │
│                        │ - Cron job ile        │  │
│                        │   periyodik log çekme │  │
│                        │ - Retry mekanizması   │  │
│                        │ - Senkronizasyon      │  │
│                        │   geçmişi kaydetme    │  │
│                        └──────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 9.3 Bağlantı Yönetimi

- Uygulama başlatıldığında aktif tüm cihazlara bağlantı kurulur
- Her cihaz için ayrı bir TCP socket yönetilir
- Bağlantı koptuğunda otomatik yeniden bağlanma denenmelidir (exponential backoff: 5s, 10s, 20s, 40s, max 60s)
- Heartbeat mekanizması ile bağlantı sağlığı kontrol edilir (30s interval)
- Cihaz online/offline durumu veritabanında güncellenir ve WebSocket ile frontend'e bildirilir

### 9.4 Senkronizasyon Akışı

```
Her 1 dakikada (configurable):

  ┌─────────┐                    ┌─────────┐                    ┌──────────┐
  │ Cron    │                    │ ZKTeco  │                    │ Database │
  │ Service │                    │ Client  │                    │          │
  └────┬────┘                    └────┬────┘                    └────┬─────┘
       │  Her aktif cihaz için:       │                              │
       │─────────────────────────────►│                              │
       │  getAttendanceLogs()         │                              │
       │                              │  TCP: CMD_ATTLOG_RRQ         │
       │                              │─────────────────►            │
       │                              │  ◄──── log verileri          │
       │  ◄───── loglar               │                              │
       │                              │                              │
       │  Her log için:               │                              │
       │──────────────────────────────────────────────────────────►  │
       │  UPSERT (duplicate check)    │                              │
       │  card_number → personnel_id  │                              │
       │  device → direction          │                              │
       │  ◄───────────────────────────────────────── kaydedildi      │
       │                              │                              │
       │  Senkronizasyon geçmişi kaydet                              │
       │──────────────────────────────────────────────────────────►  │
```

---

## 10. Kullanıcı Arayüzü

### 10.1 Sayfa Listesi

| Sayfa | Açıklama | Erişim |
|-------|----------|--------|
| **Login** | Kullanıcı girişi | Herkese açık |
| **Dashboard** | Özet istatistikler, canlı geçiş feed'i, cihaz durumu | Tüm roller |
| **Personel Listesi** | Personel tablosu, arama, filtre | Tüm roller |
| **Personel Detay** | Personel bilgileri + geçiş geçmişi | Tüm roller |
| **Geçiş Kayıtları** | Tüm geçiş logları tablosu, filtre, export | Tüm roller |
| **Raporlar** | Rapor türü seçimi ve parametre girişi | Tüm roller |
| **Cihaz Yönetimi** | Cihaz listesi, durum, kontrol | Admin |
| **Lokasyon Yönetimi** | Lokasyon CRUD | Admin |
| **Kullanıcı Yönetimi** | Web kullanıcı CRUD | Admin |
| **Ayarlar** | Senkronizasyon aralığı, mesai saatleri, bildirim ayarları | Admin |

### 10.2 Dashboard Wireframe

```
┌─────────────────────────────────────────────────────────────────┐
│  PDKS - Dashboard                                    [user] [⚙] │
├────────┬────────────────────────────────────────────────────────┤
│        │                                                        │
│  📊    │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ Dash   │  │ Toplam   │ │ Bugün    │ │ İçeride  │ │ Cihaz    │  │
│        │  │ Personel │ │ Gelen    │ │ Olan     │ │ Durumu   │  │
│  👥    │  │   487    │ │   423    │ │   312    │ │ 12/14 ✅ │  │
│ Perso. │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│        │                                                        │
│  📋    │  ┌─────────────────────────┐ ┌────────────────────────┐│
│ Geçiş  │  │ Saatlik Giriş/Çıkış    │ │ Canlı Geçiş Feed      ││
│        │  │          📊             │ │                        ││
│  📈    │  │  ▁▃▇█▇▅▃▂▁▁▂▃▅▇█▇▃▁   │ │ 14:32 Ali Yılmaz  GİR ││
│ Rapor  │  │  08 09 10 11 .. 16 17  │ │ 14:31 Ayşe Kaya  ÇIK  ││
│        │  │                         │ │ 14:30 Mehmet Öz  GİR  ││
│  🔧    │  └─────────────────────────┘ │ 14:28 Zeynep A.  ÇIK  ││
│ Cihaz  │                              │ ...                    ││
│        │  ┌─────────────────────────┐ └────────────────────────┘│
│  📍    │  │ Henüz Gelmeyenler      │                           │
│ Lokasy.│  │ • Ahmet Demir (Üretim) │                           │
│        │  │ • Fatma Şen (Muhasebe) │                           │
│  👤    │  │ • ... (+23 kişi)       │                           │
│ Kull.  │  └─────────────────────────┘                           │
│        │                                                        │
│  ⚙️    │                                                        │
│ Ayar   │                                                        │
├────────┴────────────────────────────────────────────────────────┤
│  v1.0.001 | Son senkronizasyon: 14:32:15                        │
└─────────────────────────────────────────────────────────────────┘
```

### 10.3 Tasarım Sistemi

PDKS frontend'i MSS Portal ile aynı tasarım dilini kullanır. Detaylı pattern'ler ve kod örnekleri [ui_template.md](ui_template.md) dosyasındadır.

**Temel prensipler:**

| Prensip | Uygulama |
|---------|----------|
| **Layout** | Fixed header (`#001529`, h-12) + fixed sidebar (w-64) + content (p-6, `#F0F2F5`) |
| **Renkler** | Primary `#0078d4`, hover `#106ebe`, sidebar `#001529`, avatar `#1890FF` |
| **Tema** | Light varsayılan, dark mode Zustand persist + Tailwind `dark:` prefix |
| **Tipografi** | text-2xl/bold (H1), text-xl/semibold (H2), text-sm/gray-500 (muted) |
| **Spacing** | p-4 (compact card), p-6 (standard card), gap-3 (standard), space-y-6 (sections) |
| **Component'ler** | rounded-lg, shadow-sm, border border-gray-200 dark:border-gray-700 |
| **Responsive** | Desktop öncelikli, lg breakpoint'te sidebar gizleme, grid-cols responsive |
| **Tablo** | Sayfalama, sıralama, filtreleme, sütun seçimi |
| **Bildirimler** | Toast notification (başarı/hata/uyarı), border-l-4 alert pattern |
| **Gerçek zamanlı** | WebSocket ile canlı güncelleme (geçiş feed, cihaz durumu) |
| **Export** | Tablo verilerinin CSV/Excel/PDF olarak dışa aktarılması |
| **Loading** | Loader2 animate-spin, skeleton (animate-pulse), button disabled state |
| **Empty state** | İkon + başlık + açıklama + aksiyon butonu |

---

## 11. Fonksiyonel Olmayan Gereksinimler

### 11.1 Performans

| Gereksinim | Hedef |
|-----------|-------|
| API yanıt süresi (CRUD) | < 200ms |
| API yanıt süresi (rapor) | < 2s |
| Cihaz senkronizasyon süresi (1000 log) | < 5s |
| WebSocket event gecikme | < 500ms |
| Eşzamanlı web kullanıcısı | 20 |
| Eşzamanlı cihaz bağlantısı | 20 |

### 11.2 Güvenlik

| Gereksinim | Açıklama |
|-----------|----------|
| Kimlik doğrulama | JWT (access: 15 dk, refresh: 7 gün) |
| Şifre politikası | Minimum 8 karakter, hash: bcrypt |
| CORS | Sadece izin verilen origin'ler |
| Rate limiting | Login: 5 deneme/15dk, API: 100 istek/dk |
| HTTPS | Production'da zorunlu |
| SQL Injection | TypeORM parametrize sorgular |
| XSS | React otomatik escaping + CSP header |

### 11.3 Güvenilirlik

| Gereksinim | Açıklama |
|-----------|----------|
| Cihaz offline toleransı | Cihaz logları yerel olarak saklar, online olunca otomatik senkronize |
| Duplicate koruma | UNIQUE constraint + upsert |
| Veri kaybı önleme | Periyodik senkronizasyon ile real-time event doğrulama |
| Veritabanı yedekleme | Günlük pg_dump (cron) |
| Uptime hedefi | %99.5 (yıllık ~43 saat planlı bakım toleransı) |

### 11.4 Ölçeklenebilirlik

Faz 1 için tek sunucu yeterlidir. İleriye dönük olarak:
- Cihaz haberleşme servisi ayrı bir microservice'e çıkarılabilir
- Veritabanı access_logs tablosu partitioning ile ölçeklenebilir (aylık)
- Redis ile session ve cache yönetimi eklenebilir

---

## 12. Deployment Mimarisi

### 12.1 Docker Compose Yapısı

```yaml
# docker-compose.yml (kavramsal)
services:
  backend:
    # NestJS uygulama
    ports: ["3000:3000"]
    depends_on: [postgres]
    environment:
      - DATABASE_URL
      - JWT_SECRET
      - SYNC_INTERVAL_MS=60000

  frontend:
    # React uygulama (nginx ile serve)
    ports: ["80:80"]

  postgres:
    # PostgreSQL 16
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
```

### 12.2 Ortam Gereksinimleri

| Bileşen | Minimum | Önerilen |
|---------|---------|----------|
| CPU | 2 core | 4 core |
| RAM | 4 GB | 8 GB |
| Disk | 20 GB | 50 GB (loglar büyüyebilir) |
| OS | Linux (Ubuntu 22.04+) veya Windows Server 2019+ | Linux |
| Node.js | 18 LTS | 20 LTS |
| PostgreSQL | 15 | 16 |
| Docker | 24+ | En güncel |

### 12.3 Ağ Gereksinimleri

- Backend sunucu ↔ SC403 cihazları: TCP port **4370** açık olmalı
- Frontend ↔ Backend: HTTP/HTTPS port 80/443
- Backend ↔ PostgreSQL: TCP port 5432
- Cihazlar sabit IP'ye sahip olmalı
- VPN/VLAN gereksinimleri lokasyonlara göre değişir

---

## 13. Riskler ve Kısıtlar

### 13.1 Teknik Riskler

| Risk | Etki | Olasılık | Azaltma |
|------|------|----------|---------|
| SC403 TCP protokolü dökümante edilmemiş / kararsız olabilir | Yüksek | Orta | Topluluk SDK'ları (zkteco-js) kullanılacak, ihtiyaç halinde reverse-engineer |
| Real-time event desteği tüm SC403 firmware'lerde olmayabilir | Orta | Orta | Periyodik polling fallback mekanizması |
| Cihaz firmware farklılıkları protokol uyumsuzluğuna yol açabilir | Orta | Düşük | Cihaz firmware sürümü standartlaştırılacak |
| Ağ kesintileri veri kaybına neden olabilir | Yüksek | Düşük | Hibrit mod: cihaz offline çalışır + periyodik senkronizasyon |

### 13.2 Kısıtlar

- SC403 cihazı yalnızca RFID kart destekler (parmak izi yok)
- Cihaz yerel kapasitesi: 30.000 kart, 100.000 log
- Topluluk Node.js SDK'ları resmi olarak desteklenmez; bakım riski mevcut
- İlk fazda vardiya/izin/mesai yok; raporlarda "mesai" kavramı basit sabit saat tanımına dayanır

### 13.3 Bağımlılıklar

| Bağımlılık | Açıklama |
|-----------|----------|
| ZKTeco cihaz erişimi | Geliştirme ve test için en az 1 adet SC403 cihazına erişim gereklidir |
| Ağ altyapısı | Cihazların sunucuya TCP erişimi olmalıdır |
| RFID kartlar | Test için RFID kart seti gereklidir |

---

## Ek A: Faz Planı

### Faz 1 - Temel Sistem (Bu Doküman)

```
1. Proje altyapısı (NestJS + React + PostgreSQL + Docker)
2. Auth modülü (login, JWT, roller)
3. Personel CRUD
4. Lokasyon CRUD
5. Cihaz yönetimi + bağlantı testi
6. Cihaz haberleşme katmanı (ZKTeco protokolü)
7. Geçiş log senkronizasyonu (pull)
8. Real-time event dinleme (push)
9. Giriş/çıkış yönü belirleme
10. Dashboard + canlı feed (WebSocket)
11. Geçiş kayıtları sayfası + filtre + export
12. Raporlama (günlük/aylık puantaj, devamsızlık, geç kalma)
13. Cihaz kart senkronizasyonu (sunucu → cihaz)
```

### Faz 2 - Gelişmiş Özellikler

```
1. Vardiya yönetimi
2. İzin/devamsızlık takibi + onay süreci
3. Mesai/fazla mesai hesaplama
4. Gelişmiş raporlama
5. E-posta bildirimleri
6. Mobil uyumlu arayüz / PWA
```

---

## Ek B: Sözlük

| Terim | Açıklama |
|-------|----------|
| Puantaj | Personelin günlük/aylık çalışma sürelerinin kayıt tablosu |
| Turnikele | Döner bariyer tipi geçiş kontrol ekipmanı |
| RFID | Radio-Frequency Identification - radyo frekansı ile kimlik tanıma |
| Wiegand | Kart okuyucu haberleşme protokolü |
| SC403 | ZKTeco marka RFID tabanlı geçiş kontrol terminali |
| Exponential Backoff | Her başarısız denemede bekleme süresinin katlanarak arttığı yeniden deneme stratejisi |
