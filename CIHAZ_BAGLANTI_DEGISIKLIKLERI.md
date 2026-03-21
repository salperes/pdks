# Cihaz Baglanti Degisiklikleri ve Connection Metodu Notlari

Bu dokuman, cihaz baglanti tarafinda yaptigim degisiklikleri ve ozellikle `connect` akisinda neden/neyin duzeltildigini aciklar.

## 1) Ozet

Ana degisiklikler:

1. `commKey` ile `CMD_AUTH` paketinin olusturulma sekli SC403 uyumlu hale getirildi.
2. TCP basarisiz oldugunda UDP fallback akisi guclendirildi.
3. UDP chunk veri cekiminde (`users`, `attendance`) paket akisi elle ve guvenli sekilde yonetildi.
4. Farkli cihaz veri formatlari (28/72 user paketi, 16/40 log paketi) icin dinamik decode eklendi.
5. Cihaza anlik baglanip veri cekmek icin yeni API endpoint eklendi: `POST /api/v1/devices/:id/pull`.

---

## 2) Degisen Dosyalar

- `backend/src/device-comm/zkteco-client.service.ts`
- `backend/src/devices/devices.controller.ts`

---

## 3) Connection Metodunda Ne Duzeltildi?

### 3.1 Sorun

Eski akista `CMD_AUTH` payload'i sadece `uint32 LE` olarak yollaniyordu. SC403 serisinde bu format cogu durumda yeterli olmuyor ve cihaz `ACK_UNAUTH (2005)` donebiliyor.

### 3.2 Cozum

`commKey` payload uretimi, SC403/pyzk tarafinda kullanilan `make_commkey` mantigina cekildi:

1. `commKey` 32-bit bit-level reverse edilir.
2. Cihaz `sessionId` ile toplanir.
3. Sonuc `ZKSO` sabiti ile XOR edilir.
4. 16-bit word swap yapilir.
5. Tick byte (`50`) ile son XOR uygulanir.
6. Bu 4-byte payload `CMD_AUTH` icin gonderilir.

Kod tarafi:

- `buildCommKeyBuffer(commKey, sessionId, ticks=50)`
- `authenticateWithCommKey(client, commKey, transport)`
- `connect(ip, port, commKey?)`

### 3.3 Yeni `connect` Akisi

`connect` akisi artik su sekilde:

1. `ZKLib.createSocket()` ile baglanmayi dener.
2. `commKey` varsa `authenticateWithCommKey(...)` calisir.
3. `getInfo()` ile baglanti dogrulama yapilir.
4. Bu yol fail olursa UDP fallback baslar:
   - `ZUDP.createSocket()` + `zudp.connect()`
   - `commKey` varsa yine `authenticateWithCommKey(...)`
   - `getInfo()` desteklenmiyorsa baglanti yine kabul edilir.

---

## 4) UDP Veri Cekiminde Duzeltmeler

### 4.1 Neden gerekliydi?

`zkteco-js` UDP akisi bazi SC403 firmware kombinasyonlarinda:

- `CMD_PREPARE_DATA` / `CMD_DATA` / `CMD_ACK_OK` sirasinda
- trailing ACK paketleri
- chunk senkronizasyonu

konularinda stale packet veya timeout uretebiliyordu.

### 4.2 Eklenen mantik

`zkteco-client.service.ts` icinde:

- `readWithBufferUdp(...)`
- `readPreparedUdpData(...)`
- `safeFreeData(...)`

eklendi.

Kritik noktalar:

1. `CMD_PREPARE_DATA` beklenen paket olarak ele aliniyor.
2. Son `CMD_DATA` sonrasi kisa bir bekleme ile trailing `CMD_ACK_OK` tuketiliyor.
3. Socket listener temizligi kontrollu yapiliyor.
4. Timeout ve hata mesajlari daha anlamli hale getirildi.

---

## 5) Decode Tarafindaki Duzeltmeler

Cihazdan gelen payload formati modele/firmware'e gore degisebildigi icin dinamik secim eklendi:

- Users: `28` veya `72` byte packet
- Attendance: `16` veya `40` byte packet

Bu secim:

- modulo kontrolu
- skorlamali fallback (gecerli veri orani)

ile yapiliyor.

Ilgili metodlar:

- `decodeUsersFromUdpPayload(...)`
- `decodeAttendancesFromUdpPayload(...)`

---

## 6) Yeni Endpoint: Cihazdan Anlik Veri Cekme

`DevicesController` icine yeni endpoint eklendi:

- `POST /api/v1/devices/:id/pull`
- Yetki: `admin`
- Query parametreleri:
  - `usersLimit` (default: `10`, max: `1000`)
  - `logsLimit` (default: `50`, max: `5000`)

Donen icerik:

- `device` ozeti
- `info` (cihaz free-sizes vb.)
- `counts.users`
- `counts.attendances`
- `samples.users`
- `samples.attendances`

Bu endpoint, cihaza baglanir -> users/log ceker -> baglantiyi kapatir.

---

## 7) Hangi Problemler Cozuldu?

Pratikte asagidaki iyilesmeler goruldu:

1. `commKey=202212` olan cihazlarda auth basarili hale geldi.
2. `Merkez Ofis` ve `Optik Oda` cihazlarinda `users/log` sayilari dogru cekildi.
3. `Fabrika 2` cihazindan da tutarli veri cekimi alindi.
4. Erisilemeyen cihazlar (`timeout`) ile auth problemi olan cihazlar ayrisabiliyor.

---

## 8) Notlar

1. Backend acilisinda `DeviceManager` aktif cihazlara baglanmayi denedigi icin, erisilemeyen cihaz sayisi fazla ise uygulama acilisi gecikebilir.
2. `TIMEOUT_ON_WRITING_MESSAGE` cogu durumda ag erisimi/VLAN/route problemi veya cihazin cevap vermemesi kaynaklidir.
3. `CMD_AUTH failed (2005)` dogrudan hatali `commKey` veya beklenmeyen auth davranisina isaret eder.

---

## 9) Hizli Kullanim Ornegi

```bash
POST /api/v1/devices/<deviceId>/pull?usersLimit=3&logsLimit=3
Authorization: Bearer <admin_jwt>
```

Bu cagri ile baglanti + auth + users + attendance tek adimda test edilebilir.
