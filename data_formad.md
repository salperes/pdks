# SC403 Data Format

Bu dokuman, ZKTeco SC403 tarafinda kullanilan kullanici/kart/yetki/sifre veri formatlarini ozetler.

## 1) User Record Formatlari

Cihaz firmware tipine gore iki ana user record boyutu vardir:

- 28-byte format (genelde ZK6 tipi)
- 72-byte format (genelde ZK8 tipi)

### 1.1 28-byte User Record

Struct (pyzk referansi): `'<HB5s8sIxBhI'`

| Offset | Uzunluk | Alan | Tip | Not |
|---|---:|---|---|---|
| 0 | 2 | `uid` | uint16 | Cihaz ic uid |
| 2 | 1 | `privilege` | uint8 | Yetki seviyesi |
| 3 | 5 | `password` | char[5] | Null-terminated |
| 8 | 8 | `name` | char[8] | Null-terminated |
| 16 | 4 | `card` | uint32 | Kart no |
| 20 | 1 | `reserved` | byte | Ayrilmis alan |
| 21 | 1 | `group_id` | uint8 | Grup ID |
| 22 | 2 | `timezone` | uint16 | Timezone/zone kodu |
| 24 | 4 | `user_id` | uint32 | Kullanici ID (sayisal) |

Bu formatta `card`, `password`, `group_id`, `timezone` alanlari acik ve dogrudan parse edilebilir.

### 1.2 72-byte User Record

Struct (pyzk referansi): `'<HB8s24sIx7sx24s'`

| Offset | Uzunluk | Alan | Tip | Not |
|---|---:|---|---|---|
| 0 | 2 | `uid` | uint16 | Cihaz ic uid |
| 2 | 1 | `privilege` | uint8 | Yetki seviyesi |
| 3 | 8 | `password` | char[8] | Null-terminated |
| 11 | 24 | `name` | char[24] | Null-terminated |
| 35 | 4 | `card` | uint32 | Kart no |
| 39 | 1 | `reserved` | byte | Ayrilmis alan |
| 40 | 7 | `group_block` | char[7] | Group/zone ile ilgili blok |
| 47 | 1 | `reserved` | byte | Ayrilmis alan |
| 48 | 24 | `user_id` | char[24] | String user id |

Not:

- 72-byte formatta `group_id` alani 7-byte blok icinde tasinabilir.
- 72-byte formatta `timezone` 28-byte format kadar net ayrik degildir (model/firmware farki olabilir).

## 2) Privilege (Yetki) Kodlari

| Kod | Anlam |
|---:|---|
| 0 | USER_DEFAULT |
| 2 | USER_ENROLLER |
| 6 | USER_MANAGER |
| 14 | USER_ADMIN |

## 3) Attendance Record Formatlari (Ek)

Firmware/protokole gore log kaydi da farkli gelebilir:

- 16-byte format
- 40-byte format

PDKS tarafinda her iki format icin decode/fallback vardir.

## 4) ADMS (HTTP Push) Format (Ek)

ADMS modunda cihaz text satir push eder (binary degil):

`pin \t time \t status \t verify \t work_code ...`

## 5) PDKS Icinde Mevcut Durum

- `uid`, `role/privilege`, `name`, `userId` alanlari aktif kullaniliyor.
- `card`, `password`, `group_id`, `timezone` alanlari protokolde mevcut.
- 28-byte formatta bu 4 alan net parse edilebilir.
- 72-byte formatta `card` ve `password` net, `group_id/timezone` model-firmware davranisina bagli olabilir.
