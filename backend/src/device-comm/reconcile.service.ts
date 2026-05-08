import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Device, Personnel, PersonnelDevice } from '../entities';
import { ZktecoClientService } from './zkteco-client.service';
import { SyncService } from './sync.service';

export interface DeviceReconcileResult {
  deviceId: string;
  deviceName: string;
  reachable: boolean;
  pushed: number;
  deleted: number;
  failed: number;
  errors: string[];
  durationMs: number;
}

export interface ReconcileSummary {
  startedAt: string;
  finishedAt: string;
  totalDevices: number;
  results: DeviceReconcileResult[];
}

@Injectable()
export class ReconcileService {
  private readonly logger = new Logger(ReconcileService.name);
  private running = false;

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(Personnel)
    private readonly personnelRepo: Repository<Personnel>,
    @InjectRepository(PersonnelDevice)
    private readonly personnelDeviceRepo: Repository<PersonnelDevice>,
    private readonly zktecoClient: ZktecoClientService,
    @Inject(forwardRef(() => SyncService))
    private readonly syncService: SyncService,
  ) {}

  /**
   * Her gece 03:00'te çalışır. Sahanın trafiği düşükken DB ↔ cihaz tutarlılığını
   * sağlar. Veri kaybını önlemek için yalnızca **bilinen orphan**'lar silinir
   * (PDKS'in tanıdığı ama bu cihaza atanmamış kullanıcılar). Bilinmeyen uid'ler
   * dokunulmadan bırakılır (admin, fabrika varsayılanı, vb.).
   */
  @Cron('0 3 * * *')
  async scheduledReconcile(): Promise<void> {
    if (this.running) {
      this.logger.warn('Önceki reconcile hâlâ devam ediyor, atlanıyor');
      return;
    }
    try {
      this.running = true;
      this.logger.log('Zamanlanmış reconcile başlatılıyor');
      const summary = await this.reconcileAll();
      this.logger.log(
        `Reconcile tamamlandı: ${summary.totalDevices} cihaz, ` +
          `${summary.results.reduce((s, r) => s + r.pushed, 0)} push, ` +
          `${summary.results.reduce((s, r) => s + r.deleted, 0)} delete, ` +
          `${summary.results.reduce((s, r) => s + r.failed, 0)} hata`,
      );
    } catch (err: any) {
      this.logger.error(`Zamanlanmış reconcile başarısız: ${err?.message ?? err}`);
    } finally {
      this.running = false;
    }
  }

  async reconcileAll(): Promise<ReconcileSummary> {
    const startedAt = new Date().toISOString();
    const devices = await this.deviceRepo.find({ where: { isActive: true } });
    const results: DeviceReconcileResult[] = [];
    for (const device of devices) {
      try {
        results.push(await this.reconcileDevice(device));
      } catch (err: any) {
        results.push({
          deviceId: device.id,
          deviceName: device.name,
          reachable: false,
          pushed: 0,
          deleted: 0,
          failed: 0,
          errors: [err?.message ?? String(err)],
          durationMs: 0,
        });
      }
    }
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      totalDevices: devices.length,
      results,
    };
  }

  /**
   * Tek cihaz için reconcile akışı:
   *   1) Cihaza bağlan, getUsers ile mevcut listeyi al
   *   2) PDKS'te bu cihaz için beklenen kullanıcıları hesapla (personnel_devices
   *      kayıtları + personel aktifse + employeeId tanımlıysa)
   *   3) Cihazda olmayanları push et (re-enroll)
   *   4) Cihazdaki **bilinen orphan**'ları sil:
   *      - uid PDKS'te bir personele eşleşiyor
   *      - VE (personel pasif VEYA bu cihaza atanmamış)
   *      Bilinmeyen uid'lere dokunma (güvenlik).
   */
  async reconcileDevice(device: Device): Promise<DeviceReconcileResult> {
    const t0 = Date.now();
    const result: DeviceReconcileResult = {
      deviceId: device.id,
      deviceName: device.name,
      reachable: false,
      pushed: 0,
      deleted: 0,
      failed: 0,
      errors: [],
      durationMs: 0,
    };

    let zk: any;
    try {
      zk = await this.zktecoClient.connect(device.ipAddress, device.port, device.commKey);
      result.reachable = true;
    } catch (err: any) {
      result.errors.push(`Cihaza bağlanılamadı: ${err?.message ?? err}`);
      result.durationMs = Date.now() - t0;
      this.logger.warn(`[${device.name}] reconcile bağlantı hatası: ${err?.message ?? err}`);
      return result;
    }

    try {
      // 1. Cihazdaki kullanıcı listesini al
      let deviceUsers: Array<{ uid: number; cardno: number; name?: string }> = [];
      try {
        const got: any = await this.zktecoClient.getUsers(zk);
        const arr = Array.isArray(got) ? got : got?.data ?? [];
        deviceUsers = arr.filter((u: any) => u && typeof u.uid === 'number');
      } catch (err: any) {
        result.errors.push(`getUsers başarısız: ${err?.message ?? err}`);
        this.logger.warn(`[${device.name}] getUsers hatası: ${err?.message ?? err}`);
        return result;
      }
      const deviceUidSet = new Set(deviceUsers.map((u) => u.uid));

      // 2. PDKS'in bu cihaz için beklediği kullanıcılar
      const assignments = await this.personnelDeviceRepo.find({
        where: { deviceId: device.id },
      });
      const personnelIds = assignments.map((a) => a.personnelId);
      const personnelList =
        personnelIds.length > 0 ? await this.personnelRepo.findByIds(personnelIds) : [];
      const personnelById = new Map(personnelList.map((p) => [p.id, p]));

      type Expected = {
        assignment: PersonnelDevice;
        personnel: Personnel;
        uid: number;
      };
      const expected: Expected[] = [];
      const expectedUidSet = new Set<number>();
      for (const a of assignments) {
        const p = personnelById.get(a.personnelId);
        if (!p || !p.isActive) continue;
        const uid = parseInt(p.employeeId ?? '', 10);
        if (isNaN(uid) || uid < 1 || uid > 99999) continue;
        expected.push({ assignment: a, personnel: p, uid });
        expectedUidSet.add(uid);
      }

      // 3. Cihazda olmayan beklenenler → push (öncesinde duplicate cardno temizliği)
      for (const exp of expected) {
        if (deviceUidSet.has(exp.uid)) continue;
        const name = `${exp.personnel.firstName} ${exp.personnel.lastName}`.substring(0, 24);
        const cardno = parseInt(exp.personnel.cardNumber ?? '0', 10) || 0;
        const userIdOnDevice = exp.personnel.employeeId ?? String(exp.uid);

        // Aynı cardno cihazda farklı uid'de kayıtlıysa (eski ZKAccess kalıntısı vb.)
        // önce o duplicate'leri sil. Aksi halde cihaz kart okurken küçük uid'i
        // match'leyip "Tanımsız" loglar.
        if (cardno > 0) {
          const duplicates = deviceUsers.filter(
            (u) => u.cardno === cardno && u.uid !== exp.uid,
          );
          for (const dup of duplicates) {
            try {
              await this.zktecoClient.deleteUser(zk, dup.uid);
              deviceUidSet.delete(dup.uid);
              result.deleted++;
              this.logger.log(
                `[${device.name}] DELETE duplicate uid=${dup.uid} (cardno=${cardno} also assigned to uid=${exp.uid})`,
              );
            } catch (err: any) {
              result.failed++;
              result.errors.push(`dup-delete ${dup.uid}: ${err?.message ?? err}`);
            }
          }
        }

        try {
          await this.zktecoClient.setUser(zk, exp.uid, name, cardno, userIdOnDevice);
          exp.assignment.status = 'enrolled';
          exp.assignment.errorMessage = null;
          await this.personnelDeviceRepo.save(exp.assignment);
          result.pushed++;
          this.logger.log(`[${device.name}] PUSH uid=${exp.uid} ${name}`);
        } catch (err: any) {
          exp.assignment.status = 'failed';
          exp.assignment.errorMessage = (err?.message ?? 'reconcile push').substring(0, 500);
          await this.personnelDeviceRepo.save(exp.assignment);
          result.failed++;
          result.errors.push(`push ${exp.uid}: ${err?.message ?? err}`);
        }
      }

      // 4. Cihazdaki bilinen orphan'ları sil
      // PDKS'in tanıdığı ama bu cihaza atanmamış uid'ler — diğerlerine dokunma
      // (admin/fabrika kullanıcıları korunur)
      const allPersonnel = await this.personnelRepo.find();
      const personnelByUid = new Map<number, Personnel>();
      for (const p of allPersonnel) {
        const uid = parseInt(p.employeeId ?? '', 10);
        if (!isNaN(uid) && uid >= 1 && uid <= 99999) {
          personnelByUid.set(uid, p);
        }
      }
      for (const u of deviceUsers) {
        const pdksPersonnel = personnelByUid.get(u.uid);
        if (!pdksPersonnel) continue; // PDKS bilmiyor — dokunma
        const isExpected = expectedUidSet.has(u.uid);
        if (isExpected) continue; // legitimate
        // Orphan: PDKS bilir ama bu cihaza atanmamış / personel pasif
        try {
          await this.zktecoClient.deleteUser(zk, u.uid);
          // Eğer personnel_devices'ta bu cihaz için kayıt varsa (ör. status='failed' ama personel pasif), temizle
          const stale = assignments.find(
            (a) => a.deviceId === device.id && a.personnelId === pdksPersonnel.id,
          );
          if (stale) await this.personnelDeviceRepo.remove(stale);
          result.deleted++;
          this.logger.log(
            `[${device.name}] DELETE uid=${u.uid} ${pdksPersonnel.firstName} ${pdksPersonnel.lastName} (orphan)`,
          );
        } catch (err: any) {
          result.failed++;
          result.errors.push(`delete ${u.uid}: ${err?.message ?? err}`);
        }
      }
    } finally {
      if (zk) {
        try {
          await this.zktecoClient.disconnect(zk);
        } catch {
          /* ignore */
        }
      }
      result.durationMs = Date.now() - t0;
    }

    return result;
  }

  /**
   * Cihazı sıfırlayıp PDKS'ten temiz başlatma:
   *   1) Önce kalan logları SyncService ile PDKS'e çek (veri kaybı önlemek için)
   *   2) Cihazdaki tüm user'ları getUsers ile bul, her uid için deleteUser
   *   3) clearAttendanceLog ile geçiş loglarını temizle
   *   4) PDKS'in beklediği tüm enrollments'ı tek tek setUser
   * "Sıfırdan yeniden başlat" senaryosu için: yeni kurulum, ZKAccess kalıntı
   * temizliği, vb. — destructive ama atamaların restore eder.
   */
  async factoryResetAndReload(device: Device): Promise<{
    deviceId: string;
    deviceName: string;
    reachable: boolean;
    syncedLogs: number;
    cleared: number;
    attendanceCleared: boolean;
    pushed: number;
    failed: number;
    errors: string[];
    durationMs: number;
  }> {
    const t0 = Date.now();
    const result = {
      deviceId: device.id,
      deviceName: device.name,
      reachable: false,
      syncedLogs: 0,
      cleared: 0,
      attendanceCleared: false,
      pushed: 0,
      failed: 0,
      errors: [] as string[],
      durationMs: 0,
    };

    // 1. Veri kaybını önlemek için silmeden önce logları çek
    try {
      const syncResult = await this.syncService.syncDevice(device);
      result.syncedLogs = syncResult.recordsSynced ?? 0;
      this.logger.log(
        `[${device.name}] factory-reset: pre-sync ${result.syncedLogs} log çekildi`,
      );
    } catch (err: any) {
      // Log gelmezse de devam — kullanıcı bilinçli sıfırlıyor
      this.logger.warn(
        `[${device.name}] factory-reset pre-sync hatası: ${err?.message ?? err}`,
      );
      result.errors.push(`pre-sync: ${err?.message ?? err}`);
    }

    let zk: any;
    try {
      zk = await this.zktecoClient.connect(device.ipAddress, device.port, device.commKey);
      result.reachable = true;
    } catch (err: any) {
      result.errors.push(`Cihaza bağlanılamadı: ${err?.message ?? err}`);
      result.durationMs = Date.now() - t0;
      this.logger.error(`[${device.name}] factory-reset bağlantı hatası: ${err?.message ?? err}`);
      return result;
    }

    try {
      // 2. Cihazdaki tüm user'ları sil
      let deviceUsers: Array<{ uid: number }> = [];
      try {
        const got: any = await this.zktecoClient.getUsers(zk);
        const arr = Array.isArray(got) ? got : got?.data ?? [];
        deviceUsers = arr.filter((u: any) => u && typeof u.uid === 'number');
      } catch (err: any) {
        result.errors.push(`getUsers başarısız: ${err?.message ?? err}`);
      }
      for (const u of deviceUsers) {
        try {
          await this.zktecoClient.deleteUser(zk, u.uid);
          result.cleared++;
        } catch (err: any) {
          result.failed++;
          result.errors.push(`delete uid=${u.uid}: ${err?.message ?? err}`);
        }
      }
      this.logger.log(`[${device.name}] factory-reset: ${result.cleared} user silindi`);

      // 3. Geçiş loglarını temizle
      try {
        await this.zktecoClient.clearAttendanceLog(zk);
        result.attendanceCleared = true;
        this.logger.log(`[${device.name}] factory-reset: attendance log temizlendi`);
      } catch (err: any) {
        result.errors.push(`clearAttendanceLog: ${err?.message ?? err}`);
      }

      // 4. PDKS'in beklediği user listesini push et
      const assignments = await this.personnelDeviceRepo.find({
        where: { deviceId: device.id },
      });
      const personnelIds = assignments.map((a) => a.personnelId);
      const personnelList =
        personnelIds.length > 0 ? await this.personnelRepo.findByIds(personnelIds) : [];
      const personnelById = new Map(personnelList.map((p) => [p.id, p]));

      for (const a of assignments) {
        const p = personnelById.get(a.personnelId);
        if (!p || !p.isActive) continue;
        const uid = parseInt(p.employeeId ?? '', 10);
        if (isNaN(uid) || uid < 1 || uid > 99999) continue;

        const name = `${p.firstName} ${p.lastName}`.substring(0, 24);
        const cardno = parseInt(p.cardNumber ?? '0', 10) || 0;
        const userIdOnDevice = p.employeeId ?? String(uid);

        try {
          await this.zktecoClient.setUser(zk, uid, name, cardno, userIdOnDevice);
          a.status = 'enrolled';
          a.errorMessage = null;
          await this.personnelDeviceRepo.save(a);
          result.pushed++;
        } catch (err: any) {
          a.status = 'failed';
          a.errorMessage = (err?.message ?? 'factory-reset push').substring(0, 500);
          await this.personnelDeviceRepo.save(a);
          result.failed++;
          result.errors.push(`push uid=${uid}: ${err?.message ?? err}`);
        }
      }
      this.logger.log(`[${device.name}] factory-reset: ${result.pushed} user push edildi`);
    } finally {
      if (zk) {
        try {
          await this.zktecoClient.disconnect(zk);
        } catch {
          /* ignore */
        }
      }
      result.durationMs = Date.now() - t0;
    }

    return result;
  }
}
