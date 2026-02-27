# PDKS - Personel Devam Kontrol Sistemi

## Mevcut Versiyon: 1.0.033

## Proje Ozeti
ZKTeco SC403 kart okuyucu terminallerle entegre personel devam kontrol sistemi.
NestJS backend + React frontend + PostgreSQL veritabani.

## Teknoloji Stack
- **Backend**: NestJS + TypeORM + PostgreSQL + JWT Auth
- **Frontend**: React + Vite + Tailwind CSS + Zustand
- **Cihaz Iletisimi**: ADMS push protokolu (HTTP) + zkteco-js (UDP/TCP fallback)
- **Veritabani**: PostgreSQL 16 (Docker container)
- **Deployment**: Docker Compose (postgres + backend + frontend/nginx)

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
├── docker-compose.yml  # PostgreSQL + Backend + Frontend (tam stack)
├── temp/               # ZKAccess3.5 dosyalari (git'e dahil degil)
└── personel.txt        # Personel listesi (git'e dahil degil)
```

## Veritabani Ayarlari
Container icinde: `DB_HOST=postgres`, `DB_PORT=5432` (docker-compose.yml'de tanimli).
Host'tan erisim: `localhost:5433` (port mapping 5433:5432).
TypeORM `synchronize: true` (development). Tablolar otomatik olusur.

## Varsayilan Admin Kullanici
- **Username**: admin
- **Password**: admin123
- Auth service ilk calistirmada otomatik olusturur

## ZKTeco Cihazlar (5 adet SC403, firmware Ver 6.60)
| Cihaz | IP (guncel) | Seri No | CommPassword | comm_type | Durum |
|-------|------------|---------|--------------|-----------|-------|
| Fabrika 1 | 192.168.204.233 | AJ8O223760445 | (yok) | 3 (ADMS) | UDP calisiyor, 92 user, 1 log |
| Fabrika 2 | 192.168.152.233 | AJ8O223760433 | (yok) | 3 (ADMS) | UDP calisiyor (prod'dan erisim var) |
| Merkez Ofis | 192.168.104.242 | 6079214600262 | 202212 | 3 (ADMS) | UDP calisiyor (prod'dan CommKey auth basarili) |
| Optik Oda | 192.168.104.241 | 6079214600523 | 202212 | 3 (ADMS) | UDP calisiyor (prod'dan CommKey auth basarili) |
| 4.Ar-Ge Arka Kapi | 192.168.107.240 | AJ8O203360369 | 202212 | 3 (ADMS) | Erisim disi (ping yok) |

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

## Calistirma (Docker Compose)
```bash
# Tum servisleri baslat (postgres + backend + frontend)
docker-compose up -d --build

# Loglari izle
docker-compose logs -f backend

# Servisleri durdur
docker-compose down
```
- **Frontend**: http://localhost:5174 (nginx, API proxy backend:3000'e yonlendirir)
- **Backend API**: http://localhost:3000/api/v1
- **ADMS Endpoint**: http://localhost:3000/iclock/cdata (cihazlar buraya baglanir)
- **PostgreSQL**: localhost:5433 (host'tan erisim)

### Gelistirme Modu (opsiyonel)
```bash
cd backend && npm install && npm run start:dev   # port 3000
cd frontend && npm install && npm run dev         # port 5173 (Vite proxy aktif)
```

## Production Deploy
- **Sunucu**: 192.168.88.111 (mssadmin / Ankara12!)
- **URL**: http://192.168.88.111:5174
- **Dizin**: /home/mssadmin/pdks
- **Container'lar**: pdks-postgres, pdks-server, pdks-client
- **Dis port**: Sadece 5174 (frontend nginx)
- **Backend/DB**: Internal Docker network (dis erisim yok)
- **DB yedek dizini**: /home/mssadmin/pdks/backup
- **Ilk deploy**: 19.02.2026 (v1.0.014)

### Sunucudaki Diger Servisler ve Port Haritasi
| Port | Servis |
|------|--------|
| 22 | SSH |
| 80 | Portal (nginx) |
| 3010 | Portal-FTS |
| 5000 | TaskMgmt |
| 5174 | **PDKS** |
| 8080 | RMS |
| 18088 | OnlyOffice |

## Siradaki Adimlar
1. Cihazlarda ADMS server adresini `http://192.168.88.111:3000` olarak ayarla
2. Access.mdb'den 54,954 tarihsel kaydi PostgreSQL'e aktar
3. Tum cihazlardan canli ADMS push'u test et

## Onemli Teknik Detaylar
- Backend API prefix: `/api/v1` (main.ts'de setGlobalPrefix)
- ADMS endpointleri `/iclock/*` - global prefix'ten haric
- Frontend nginx: `/api/` ve `/socket.io/` isteklerini backend:3000'e proxy yapar
- Frontend dev mode: Vite proxy ayarlari `vite.config.ts`'de
- Frontend axios baseURL: `VITE_API_URL || '/api/v1'` (container'da relative path)
- JWT: 15dk access token, 7 gun refresh token
- Device entity'de `commKey` alani var (nullable varchar)
- DeviceManagerService baslangicta tum aktif cihazlara otomatik baglanir
- SyncService 60 saniyede bir tum bagli cihazlardan log ceker
- WebSocket gateway mevcut ama henuz frontend'de kullanilmiyor
- ZUDP inport range: 5200-5300 (rotate)
- `getInfo()` opsiyonel - bazi modeller desteklemiyor, hata durumunda atlanir

## Docker Servisleri (Production)
| Servis | Image | Container | Port (host:container) |
|--------|-------|-----------|----------------------|
| postgres | postgres:16-alpine | pdks-postgres | (internal) |
| backend | ./backend (node:20-alpine) | pdks-server | (internal) |
| frontend | ./frontend (nginx:alpine) | pdks-client | 5174:80 |

## Git
- Repo: https://github.com/salperes/pdks.git (private)
- Branch: main
- .gitignore: temp/, personel.txt, *.mdb, .env, node_modules/, .claude/
