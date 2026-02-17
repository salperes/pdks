# Changelog & Versioning System for AI-Assisted Development

> Bu sistem, AI (Claude Code vb.) ile gelistirme yapilan projelerde her degisikligi takip etmek,
> context window'u verimli kullanmak ve tutarli versiyon numaralandirmasi saglamak icin tasarlanmistir.
> Herhangi bir projeye uyarlanabilir.

---

## 1. Neden Bu Sistem?

AI ile gelistirme yaparken:
- Her prompt sonrasi ne yapildigini kayit altina almak gerekir
- Context window sinirli; buyuk changelog dosyasi context'i gereksiz doldurur
- Versiyon numarasi otomatik olarak degisiklik sayacina baglanirsa tutarlilik artar
- Arsivleme sayesinde eski kayitlar context'e yuklenmez ama gerektiginde erisilebilir

---

## 2. CHANGELOG.md Formati

Proje kokunde tek bir `CHANGELOG.md` dosyasi tutulur.

### Kayit Yapisi

```
---------------------------------------------------------
Rev. ID    : 001
Rev. Date  : DD.MM.YYYY
Rev. Time  : HH:MM:SS
Rev. Prompt: <Kullanicinin istegi - tek satirlik ozet>

Rev. Report: (
  <Yapilan degisikliklerin detayli aciklamasi>

  - Hangi dosyalar degisti
  - Ne eklendi / ne duzeltildi
  - Onemli teknik notlar

  Yeni dosyalar: N (listesi)
  Degisen dosyalar: N (listesi)
)
---------------------------------------------------------
```

### Alan Aciklamalari

| Alan | Aciklama |
|------|----------|
| **Rev. ID** | Artan sayac, 4 haneli zero-padded (0001, 0002, ..., 9999) |
| **Rev. Date** | Degisiklik tarihi (DD.MM.YYYY) |
| **Rev. Time** | Degisiklik saati (HH:MM:SS) |
| **Rev. Prompt** | Kullanicinin orijinal isteginin tek satirlik ozeti |
| **Rev. Report** | Yapilan degisikliklerin teknik raporu |

### Ornek Kayit

```
---------------------------------------------------------
Rev. ID    : 042
Rev. Date  : 10.02.2026
Rev. Time  : 04:30:00
Rev. Prompt: X-Ray Viewer hata duzeltme + yeni ozellikler

Rev. Report: (
  X-Ray Viewer'daki pan hatasi duzeltildi. Rotate 90, histogram
  kirpma ve deinterlace ozellikleri eklendi.

  BUG FIX - Pan calismiyordu:
  - rendererRef.current null olarak yakalaniyordu
  - Fix: rendererReady state degiskeni eklendi

  YENI - Dondurme (Rotate 90):
  - ImageProcessor.ts: rotateImage() fonksiyonu

  Degisen dosyalar: 5 (XRayViewer.tsx, ImageProcessor.ts,
  types.ts, ToolPanel.tsx, HistogramPanel.tsx)
)
---------------------------------------------------------
```

---

## 3. Arsivleme Mekanizmasi

### Kurallar

- Aktif `CHANGELOG.md` dosyasinda **maksimum 11 kayit** tutulur
- 11 kayit dolunca:
  1. Ilk 10 kayit `temp/changelog{START}-{END}.md` dosyasina arsivlenir
  2. Yeni `CHANGELOG.md` son kaydin (11.) kopyasiyla baslar (baglam referansi)
  3. Yeni kayit eklenir (toplamda 2 kayit ile yeni dosya baslar)

### Neden 11?

- 10 kayit arsiv birimi
- 11. kayit = arsivleme tetikleyicisi + yeni dosyanin baglam referansi
- Bu sayede AI yeni bir session'da son durumu gorebilir

### Arsiv Dosya Isimlendirme

```
temp/changelog001-010.md   ← Rev 001-010
temp/changelog011-020.md   ← Rev 011-020
temp/changelog021-030.md   ← Rev 021-030
...
```

### CHANGELOG.md Baslik Guncellemesi

Her arsivleme sonrasi baslik guncellenir:

```markdown
# Proje Adi - Changelog

> Max 11 kayit tutulur. 11 kayit dolunca eski 1-10 arsivlenir (`temp/changelog{NNN}-{NNN}.md`),
> yeni dosya eski dosyanin son kaydiyla baslar (baglam referansi olarak).
> Arsiv: temp/changelog001-010.md, temp/changelog011-020.md, temp/changelog021-030.md
```

---

## 4. Versiyon Numaralandirma

### Format: `MAJOR.MINOR.RevID`

| Segment | Aciklama | Ornek |
|---------|----------|-------|
| **MAJOR** | Ana surum (buyuk mimari degisiklikler) | `1`, `2` |
| **MINOR** | Kucuk surum (yeni ozellik/modul eklemeleri) | `0`, `1` |
| **RevID** | CHANGELOG'daki son Rev. ID (3 haneli, zero-padded) | `042` |

**Ornek:** `1.0.042` = Major 1, Minor 0, 42. degisiklik

### Versiyon Dosyasi

Proje icinde tek bir versiyon dosyasi tutulur:

**Frontend (TypeScript/JavaScript):**
```typescript
// frontend/src/version.ts
export const APP_VERSION = '1.0.042';
```

**Python:**
```python
# src/version.py
APP_VERSION = '1.0.042'
```

**Go:**
```go
// internal/version/version.go
const AppVersion = "1.0.042"
```

### Versiyon Gosterimi

Uygulamanin header/footer'inda veya about sayfasinda gosterilir.

---

## 5. Her Prompt Sonrasi Is Akisi

AI (veya gelistirici) her degisiklik sonrasi bu adimlari takip eder:

```
1. Gelistirmeyi yap
2. CHANGELOG.md'ye yeni kayit ekle (yeni Rev. ID al)
3. Versiyon dosyasini guncelle: APP_VERSION = 'MAJOR.MINOR.{RevID}'
4. (Opsiyonel) Deploy et
5. 11 kayit doluysa arsivle
```

### Arsivleme Akisi (11 kayit oldugunda)

```
1. CHANGELOG.md'den kayit 1-10'u temp/changelog{START}-{END}.md'ye kopyala
2. CHANGELOG.md'yi yeniden yaz:
   - Baslik + arsiv referanslari (guncellenmis)
   - Kayit 11'in kopyasi (baglam referansi)
3. Yeni kayidi ekle (toplam 2 kayit)
```

---

## 6. CLAUDE.md / Proje Talimatlarina Ekleme

Projenin `CLAUDE.md` (veya benzeri AI talimat dosyasina) su bolumleri ekleyin:

```markdown
## Changelog & Versiyon Kurallari

- Her yapilan degisiklik `CHANGELOG.md`'ye kaydedilir
- Max 11 kayit tutulur aktif dosyada
- 11 kayit dolunca: eski 1-10 arsive (`temp/changelog{NNN}-{NNN}.md`),
  yeni dosya son kaydin kopyasiyla baslar
- Format: Rev. ID (counter), Rev. Date (DD.MM.YYYY), Rev. Time (HH:MM:SS),
  Rev. Prompt, Rev. Report

### Versiyon Sistemi

- **Format:** `MAJOR.MINOR.RevID` (orn. `1.0.014`)
- **Versiyon dosyasi:** `<path>/version.ts` → `APP_VERSION` sabiti

### Her Prompt Sonrasi Is Akisi

1. Gelistirmeleri yap
2. `CHANGELOG.md`'ye yeni kayit ekle (yeni Rev. ID al)
3. Versiyon dosyasini guncelle
4. (Opsiyonel) Deploy et
```

---

## 7. AI Memory Dosyasina Ekleme

AI'in oturum arasi hafizasina (orn. `.claude/memory/MEMORY.md`) su bilgiler eklenir:

```markdown
## Changelog & Version System
- Active file: `CHANGELOG.md` at project root (max 11 entries)
- When 11 entries full: archive 1-10 to `temp/changelog{NNN}-{NNN}.md`,
  new file starts with copy of last entry
- Format: Rev. ID (counter), Date (DD.MM.YYYY), Time (HH:MM:SS),
  Prompt (user's request), Report (what was done)
- Current counter: 053 (Rev. 051-053 in active file)
- Archives: 001-010, 011-020, 021-030, 031-040, 041-050

### Version Format: `1.0.{RevID}`
- File: `frontend/src/version.ts` → `APP_VERSION`

### Post-Prompt Workflow (MUST follow every time)
1. Do the development work
2. Add CHANGELOG.md entry → get new Rev. ID
3. Update version file → `APP_VERSION = '1.0.{RevID}'`
4. Deploy if needed
```

---

## 8. Yeni Projeye Uygulama Kontrol Listesi

- [ ] `CHANGELOG.md` dosyasini olustur (baslik + ilk kayit)
- [ ] `temp/` klasorunu olustur (arsivler icin)
- [ ] Versiyon dosyasini olustur (`version.ts`, `version.py`, vb.)
- [ ] Versiyonu UI'da goster (header/footer/about)
- [ ] `CLAUDE.md`'ye changelog kurallarini ekle
- [ ] AI memory dosyasina counter bilgisini ekle
- [ ] `.gitignore`'a `temp/` ekleme (arsivler git'te olmali)

---

## 9. Avantajlar

| Avantaj | Aciklama |
|---------|----------|
| **Context tasarrufu** | Aktif dosyada max 11 kayit, AI context window'u doldurmaz |
| **Tam iz** | Her prompt ve sonucu kayitli, hicbir sey kaybolmaz |
| **Baglam surekliligi** | Son kayit referans olarak yeni dosyada, AI baglami kaybetmez |
| **Otomatik versiyon** | Rev. ID = versiyon, ayri versiyon yonetimi gereksiz |
| **Kolay arama** | Arsiv dosyalari grep ile aranabilir |
| **Proje bagimsiz** | Herhangi bir dil/framework'e uyarlanabilir |

---

## 10. SSS

**S: Neden CHANGELOG.md'de max 11 kayit?**
A: AI context window'unu verimli kullanmak icin. 11 kayit ~3-4K token, daha fazlasi gereksiz context tuketir.

**S: Arsiv dosyalari ne zaman lazim olur?**
A: Nadiren. Genellikle eski bir degisikligi arastirirken veya regression debug ederken.

**S: MAJOR/MINOR ne zaman arttirilir?**
A: MAJOR = buyuk mimari degisiklik (orn. monolith→microservice). MINOR = onemli yeni modul/ozellik. Genellikle gelistirici karar verir.

**S: Rev. ID 999'u gecerse?**
A: 4 haneli formata gecilir (0001, 0002...). Pratikte 999 prompt = cok olgun proje.

**S: Birden fazla gelistirici varsa?**
A: Her gelistirici ayni CHANGELOG'u kullanir, Rev. ID artan sayac olarak devam eder. Conflict durumunda buyuk ID kalir.