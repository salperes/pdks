# PDKS - Eksik Alanlar ve Yapilacaklar

## Mevcut Durum

| Alan | Backend | Frontend | Not |
|------|---------|----------|-----|
| Login/Auth | OK | OK | JWT + refresh token |
| Dashboard | Kismi | Kismi | currentlyInside hep 0, cihaz durumu eksik |
| Personel CRUD | OK | OK | Arama, filtreleme, sayfalama |
| Cihaz CRUD | OK | OK | Test, connect, sync, pull, enroll API hazir |
| Lokasyon CRUD | OK | OK | |
| Erisim Kayitlari | OK | OK | Tarih, yon, cihaz, lokasyon filtresi, 30sn auto-refresh |
| Kullanici Yonetimi | OK | OK | admin/operator/viewer rolleri |
| Periyodik Sync | OK | - | 2dk aralik, dedup, timezone duzeltmesi |
| Cihaza Kart Yazma | OK | YOK | API hazir (enroll/enroll-all), UI yok |
| ADMS Push | OK | - | iclock endpoint, cihaz otomatik veri gonderiyor |
| WebSocket | OK | Kullanilmiyor | access-log, device-status eventleri |

---

## 1. Cihaz Islemleri UI (Yuksek Oncelik)

Frontend'de cihaz kartlarinda su butonlar/bilgiler eksik:

- [ ] **Sync butonu** - `POST /devices/:id/sync` API hazir, buton yok
- [ ] **Toplu tanimla butonu** - `POST /devices/:id/enroll-all` API hazir, buton yok
- [ ] **Pull butonu** - `POST /devices/:id/pull` ile cihazdaki veriyi gosterme
- [ ] **Saat senkronizasyonu** - Backend'de `getTime` var, `setTime` eksik, endpoint yok
- [ ] **Kapasite gosterimi** - Cihazdaki kullanici/log sayisi
- [ ] **Son sync zamani** - Gercek zamanli guncelleme (WebSocket)
- [ ] **Cihaz bilgi karti** - Firmware, model, seri no gosterimi

---

## 2. Raporlar Sayfasi (Yuksek Oncelik)

Sayfa tamamen bos (placeholder). Yapilacaklar:

- [ ] **Gunluk devam raporu** - Tarih secimi, personel listesi, giris/cikis saatleri
- [ ] **Aylik devam ozeti** - Personel bazli toplam gun, gec kalma, erken cikma
- [ ] **Departman bazli analiz** - Departmana gore devam oranlari
- [ ] **Gec kalanlar listesi** - Belirlenen mesai baslangicindan sonra gelenler
- [ ] **Erken cikanlar listesi** - Mesai bitisinden once gidenler
- [ ] **CSV/Excel export** - Tum raporlarda indirme butonu
- [ ] **Tarih araligi secimi** - Baslangic/bitis tarih filtresi
- [ ] **Giris-cikis eslestirme** - Punch pair analizi (toplam calisma suresi)

---

## 3. Ayarlar Sayfasi (Orta Oncelik)

Sayfa tamamen bos (placeholder). Yapilacaklar:

- [ ] **Calisma saatleri** - Mesai baslangic/bitis saati tanimlama (orn: 08:00-17:00)
- [ ] **Timezone ayari** - Sistem geneli saat dilimi (simdilik UTC+3 hardcoded)
- [ ] **Sync araligi** - Periyodik sync suresi (simdilik 120sn hardcoded)
- [ ] **Tatil gunleri takvimi** - Resmi tatil/ozel gun tanimlama
- [ ] **Sistem bilgisi** - Versiyon, DB durumu, cihaz sayisi, kayit sayisi
- [ ] **Yedekleme** - DB backup/restore

---

## 4. Dashboard Iyilestirme (Orta Oncelik)

- [ ] **currentlyInside hesaplamasi** - Giris yapip henuz cikis yapmayanlar
- [ ] **Cihaz durumu karti** - Online/offline cihazlarin gercek zamanli durumu
- [ ] **Gunluk istatistik** - Bugun gelen/giden sayilari (saat bazli grafik)
- [ ] **WebSocket entegrasyonu** - Canli veri guncellemesi (yeni giris/cikis aninda)
- [ ] **Hizli erisim butonlari** - Sync all, raporlar vb.

---

## 5. Personel Sayfasi Iyilestirme (Orta Oncelik)

- [ ] **Cihaza tanimla butonu** - Secili personeli belirli cihaza enroll etme
- [ ] **Toplu import** - CSV/Excel ile personel yukleme
- [ ] **Foto yukleme** - `photoUrl` alani var, upload mekanizmasi yok
- [ ] **Son giris bilgisi** - Her personelin son giris tarihi/saati/lokasyonu
- [ ] **Devam istatistigi** - Personel detay sayfasinda devam ozeti
- [ ] **Aktif/Pasif toggle** - Durumu hizli degistirme

---

## 6. Erisim Kayitlari Iyilestirme (Dusuk Oncelik)

- [ ] **CSV/Excel export** - Filtrelenmis kayitlari indirme
- [ ] **Personel bazli gecmis** - Tek personelin tum gecisi
- [ ] **Giris-cikis eslestirme** - IN/OUT pair gosterimi, calisma suresi
- [ ] **Timezone-aware gosterim** - Saatlerin dogru gosterilmesi
- [ ] **Gelismis arama** - Kart numarasi, employee ID ile arama

---

## 7. Diger (Dusuk Oncelik)

- [ ] **Sifre degistirme** - Kullanicinin kendi sifresini degistirmesi
- [ ] **Audit log** - Sistem degisikliklerinin kaydedilmesi
- [ ] **Bildirim sistemi** - Anormal giris/cikis uyarilari
- [ ] **Coklu dil destegi** - Simdilik sadece Turkce hardcoded
- [ ] **Toplu silme** - Secili kayitlari topluca silme
- [ ] **Otomatik yedekleme** - Zamanlanmis DB backup

---

## Teknik Notlar

### Timezone
- Cihazlar yerel saat (UTC+3) donduruyor
- `sync.service.ts` icinde -3 saat cevrimi yapiliyor
- DB'de UTC olarak saklaniyor
- Frontend `toLocaleString('tr-TR')` kullaniyor (browser timezone'a bagli)

### Cihaz Protokolu
- SC403 cihazlari TCP reddediyor, UDP uzerinden calisiyor
- CommKey auth: pyzk make_commkey algoritmasi (reverseBits32 + ZKSO XOR)
- Paket formatlari: 28/72 byte user, 16/40 byte attendance (dinamik secim + skorlama)
- `setUser` / `deleteUser` UDP uzerinden `executeCmd` ile calisiyor

### Mevcut API Endpointleri

```
Auth:
  POST /api/v1/auth/login
  POST /api/v1/auth/refresh
  GET  /api/v1/auth/me

Dashboard:
  GET  /api/v1/dashboard/summary

Personnel:
  GET    /api/v1/personnel
  POST   /api/v1/personnel
  GET    /api/v1/personnel/:id
  PATCH  /api/v1/personnel/:id
  DELETE /api/v1/personnel/:id

Devices:
  GET    /api/v1/devices
  POST   /api/v1/devices
  GET    /api/v1/devices/:id
  PATCH  /api/v1/devices/:id
  DELETE /api/v1/devices/:id
  POST   /api/v1/devices/:id/test
  POST   /api/v1/devices/:id/connect
  POST   /api/v1/devices/:id/disconnect
  POST   /api/v1/devices/:id/sync
  POST   /api/v1/devices/sync-all
  POST   /api/v1/devices/:id/pull
  POST   /api/v1/devices/:id/enroll/:personnelId
  DELETE /api/v1/devices/:id/enroll/:personnelId
  POST   /api/v1/devices/:id/enroll-all

Locations:
  GET    /api/v1/locations
  POST   /api/v1/locations
  GET    /api/v1/locations/:id
  PATCH  /api/v1/locations/:id
  DELETE /api/v1/locations/:id

Access Logs:
  GET  /api/v1/access-logs
  GET  /api/v1/access-logs/unknown

Users:
  GET    /api/v1/users
  POST   /api/v1/users
  GET    /api/v1/users/:id
  PATCH  /api/v1/users/:id
  DELETE /api/v1/users/:id

ADMS (cihaz push):
  GET  /iclock/cdata
  POST /iclock/cdata
  GET  /iclock/getrequest
  POST /iclock/devicecmd
```
