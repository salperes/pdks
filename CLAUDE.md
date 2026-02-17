# PDKS - Personel Devam Kontrol Sistemi

## Proje Ozeti
ZKTeco SC403 kart okuyucu terminallerle entegre personel devam kontrol sistemi.
NestJS backend + React frontend + PostgreSQL veritabani.

## Teknoloji Stack
- **Backend**: NestJS + TypeORM + PostgreSQL + JWT Auth
- **Frontend**: React + Vite + Tailwind CSS + Zustand
- **Cihaz Iletisimi**: zkteco-js kutuphanesi (UDP/TCP), port 4370
- **Veritabani**: PostgreSQL 16 (Docker veya native)

## Proje Yapisi
```
PDKS/
├── backend/           # NestJS API (port 3000, prefix: api/v1)
│   ├── src/
│   │   ├── auth/              # JWT login, refresh token
│   │   ├── users/             # Kullanici CRUD (admin/operator/viewer)
│   │   ├── personnel/         # Personel CRUD
│   │   ├── devices/           # Cihaz CRUD + sync/test endpointleri
│   │   ├── locations/         # Lokasyon CRUD
│   │   ├── access-logs/       # Gecis kayitlari (pagination, filter)
│   │   ├── dashboard/         # Ozet istatistikler
│   │   ├── device-comm/       # ZKTeco cihaz iletisim katmani
│   │   │   ├── zkteco-client.service.ts   # TCP/UDP baglanti, CMD_AUTH
│   │   │   ├── device-manager.service.ts  # Baglanti havuzu yonetimi
│   │   │   └── sync.service.ts            # Otomatik senkronizasyon (60sn)
│   │   ├── entities/          # TypeORM entity'leri
│   │   └── gateway/           # WebSocket gateway (events)
│   └── .env.example
├── frontend/          # React SPA (port 5173)
│   └── src/
│       ├── pages/             # Login, Dashboard, Personnel, Devices, Locations, AccessLogs, Admin/Users
│       ├── components/layout/ # Header, Sidebar, Layout
│       ├── services/api.ts    # Axios + JWT interceptor
│       ├── store/             # authStore, themeStore (Zustand)
│       └── types/             # TypeScript interface'ler
├── docker-compose.yml  # PostgreSQL 16 (port 5433 -> 5432)
├── temp/               # ZKAccess3.5 dosyalari (git'e dahil degil)
└── personel.txt        # Personel listesi (git'e dahil degil)
```

## Veritabani Ayarlari
```
DB_HOST=localhost
DB_PORT=5432        # Docker kullaniliyorsa: 5433
DB_USERNAME=pdks
DB_PASSWORD=pdks123
DB_DATABASE=pdks
```
TypeORM `synchronize: true` (development). Tablolar otomatik olusur.

## Varsayilan Admin Kullanici
- **Username**: admin
- **Password**: Admin123!
- Auth service ilk calistirmada otomatik olusturur

## ZKTeco Cihazlar (5 adet SC403)
| Cihaz | IP (Access.mdb) | Seri No | CommPassword | comm_type | Durum |
|-------|-----------------|---------|-------------|-----------|-------|
| Fabrika 1 | 192.168.88.218 | AJ8O223760445 | (bos) | 3 (ADMS) | Erisim disi |
| Fabrika 2 | 192.168.152.233 | AJ8O223760433 | (bos) | 3 (ADMS) | Calisiyor (UDP) |
| Merkez Ofis | 192.168.104.242 | 6079214600262 | 202212 | 3 (ADMS) | ADMS push modu |
| Optik Oda | 192.168.104.241 | 6079214600523 | 202212 | 3 (ADMS) | ADMS push modu |
| 4.Ar-Ge Arka Kapi | 192.168.88.221 | AJ8O203360369 | 202212 | 3 (ADMS) | Erisim disi |

### Cihaz Iletisim Modlari
- **comm_type=3 = ADMS push modu**: Cihazlar HTTP ile sunucuya baglanir (sunucu cihaza degil!)
  - Cihaz → `GET /iclock/cdata?SN=...` (config ister)
  - Cihaz → `POST /iclock/cdata?SN=...&table=ATTLOG` (log gonderir)
  - Cihaz → `GET /iclock/getrequest?SN=...` (komut bekler)
- **UDP 4370**: Fabrika 2 calisiyor. Merkez Ofis/Optik Oda CMD_ACK_UNAUTH (2005).
- **TCP 4370**: Dev makineden KAPALI, VM'den (192.168.88.240) ACIK.
- **ADMS modulu**: `backend/src/adms/` - ADMS push server endpoint'leri
- `zkteco-client.service.ts` CMD_AUTH (1102) destegi mevcut (UDP fallback icin).
- Device `user_id` = Personnel `employeeId` (cardNumber degil!)
- Senkronizasyon: year < 2000 olan kayitlar atlanir, deviceId + eventTime + deviceUserId ile dedup yapilir.

### Tarihsel Veri
- `temp/ZKAccess3.5/` altinda Access.mdb var: **54,954 gecis kaydi** (2022-11'den itibaren)
- CHECKINOUT tablosu: USERID, CHECKTIME, CHECKTYPE, VERIFYCODE, sn (seri no), MachineId
- Bu veriler henuz PostgreSQL'e aktarilmadi

## Siradaki Adimlar (VM Uzerinde)
1. `git clone https://github.com/salperes/pdks.git`
2. PostgreSQL kur veya `docker-compose up -d` calistir
3. `cd backend && cp .env.example .env` (DB_PORT'u kontrol et)
4. `npm install && npm run start:dev`
5. `cd frontend && npm install && npm run dev`
6. Cihazlara TCP ile baglanmayi test et (VM'den TCP acik olmali)
7. CommKey'li cihazlara (Merkez Ofis, Optik Oda) baglanmayi test et
8. Access.mdb'den 54,954 tarihsel kaydi PostgreSQL'e aktar
9. Tum cihazlardan canli senkronizasyonu test et

## Onemli Teknik Detaylar
- Backend API prefix: `/api/v1` (main.ts'de setGlobalPrefix)
- Frontend axios baseURL: `http://localhost:3000/api/v1`
- JWT: 15dk access token, 7 gun refresh token
- Device entity'de `commKey` alani var (nullable varchar)
- DeviceManagerService baslangicta tum aktif cihazlara otomatik baglanir
- SyncService 60 saniyede bir tum bagli cihazlardan log ceker
- WebSocket gateway mevcut ama henuz frontend'de kullanilmiyor
- ZUDP inport range: 5200-5300 (rotate)
- `getInfo()` opsiyonel - bazi modeller desteklemiyor, hata durumunda atlanir

## Git
- Repo: https://github.com/salperes/pdks.git (private)
- Branch: main
- .gitignore: temp/, personel.txt, *.mdb, .env, node_modules/, .claude/
