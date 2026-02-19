import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonnelDevice, Personnel, Device, Location } from '../entities';
import { ZktecoClientService } from '../device-comm/zkteco-client.service';
import { AuditLogService } from '../audit-log/audit-log.service';

export interface AssignmentResult {
  deviceId: string;
  deviceName: string;
  success: boolean;
  error?: string;
}

export interface BulkAssignmentResult {
  personnelId: string;
  personnelName: string;
  results: AssignmentResult[];
}

@Injectable()
export class SupervisorService {
  private readonly logger = new Logger(SupervisorService.name);

  constructor(
    @InjectRepository(PersonnelDevice)
    private readonly personnelDeviceRepo: Repository<PersonnelDevice>,
    @InjectRepository(Personnel)
    private readonly personnelRepo: Repository<Personnel>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    private readonly zktecoClient: ZktecoClientService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Get personnel-device assignments, optionally filtered by personnelId.
   */
  async getAssignments(personnelId?: string) {
    const qb = this.personnelDeviceRepo
      .createQueryBuilder('pd')
      .leftJoinAndSelect('pd.personnel', 'personnel')
      .leftJoinAndSelect('pd.device', 'device')
      .leftJoinAndSelect('device.location', 'location')
      .orderBy('personnel.firstName', 'ASC')
      .addOrderBy('device.name', 'ASC');

    if (personnelId) {
      qb.where('pd.personnelId = :personnelId', { personnelId });
    }

    const assignments = await qb.getMany();

    return assignments.map((pd) => ({
      id: pd.id,
      personnelId: pd.personnelId,
      personnelName: pd.personnel
        ? `${pd.personnel.firstName} ${pd.personnel.lastName}`
        : null,
      employeeId: pd.personnel?.employeeId ?? null,
      deviceId: pd.deviceId,
      deviceName: pd.device?.name ?? null,
      locationName: pd.device?.location?.name ?? null,
      status: pd.status,
      errorMessage: pd.errorMessage,
      enrolledAt: pd.enrolledAt,
    }));
  }

  /**
   * Build a matrix of all active personnel vs all active devices with current assignments.
   */
  async getMatrix() {
    const [personnel, devices, assignments] = await Promise.all([
      this.personnelRepo.find({
        where: { isActive: true },
        order: { firstName: 'ASC', lastName: 'ASC' },
        take: 200,
      }),
      this.deviceRepo.find({
        where: { isActive: true },
        relations: ['location'],
        order: { name: 'ASC' },
      }),
      this.personnelDeviceRepo.find(),
    ]);

    return {
      personnel: personnel.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        employeeId: p.employeeId,
        department: p.department,
      })),
      devices: devices.map((d) => ({
        id: d.id,
        name: d.name,
        locationId: d.locationId,
        locationName: d.location?.name ?? null,
      })),
      assignments: assignments.map((a) => ({
        id: a.id,
        personnelId: a.personnelId,
        deviceId: a.deviceId,
        status: a.status,
        errorMessage: a.errorMessage,
        enrolledAt: a.enrolledAt,
      })),
    };
  }

  /**
   * Assign (enroll) a personnel to one or more devices.
   */
  async assign(
    personnelId: string,
    deviceIds: string[],
    userId?: string,
    username?: string,
  ): Promise<AssignmentResult[]> {
    const personnel = await this.personnelRepo.findOne({ where: { id: personnelId } });
    if (!personnel) {
      throw new NotFoundException('Personel bulunamadi');
    }

    const uid = this.resolveUid(personnel);
    const name = `${personnel.firstName} ${personnel.lastName}`.substring(0, 24);
    const cardno = parseInt(personnel.cardNumber, 10) || 0;
    const userIdOnDevice = personnel.employeeId ? String(personnel.employeeId) : String(uid);

    const results: AssignmentResult[] = [];

    for (const deviceId of deviceIds) {
      const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
      if (!device) {
        results.push({ deviceId, deviceName: 'Bilinmiyor', success: false, error: 'Cihaz bulunamadi' });
        continue;
      }

      // Find or create PersonnelDevice record
      let pd = await this.personnelDeviceRepo.findOne({
        where: { personnelId, deviceId },
      });

      if (!pd) {
        pd = this.personnelDeviceRepo.create({
          personnelId,
          deviceId,
          status: 'pending',
          enrolledBy: userId || null,
        });
        await this.personnelDeviceRepo.save(pd);
      } else {
        pd.status = 'pending';
        pd.errorMessage = null;
        pd.enrolledBy = userId || null;
        await this.personnelDeviceRepo.save(pd);
      }

      let zk: any;
      try {
        zk = await this.zktecoClient.connect(device.ipAddress, device.port, device.commKey);
        await this.zktecoClient.getUsers(zk); // prime packet format detection
        await this.zktecoClient.setUser(zk, uid, name, cardno, userIdOnDevice);

        pd.status = 'enrolled';
        pd.errorMessage = null;
        await this.personnelDeviceRepo.save(pd);

        results.push({ deviceId, deviceName: device.name, success: true });

        this.logger.log(
          `Enrolled personnel "${name}" (uid=${uid}) on device "${device.name}" (${device.ipAddress})`,
        );
      } catch (error) {
        const errMsg = error?.message || JSON.stringify(error);
        pd.status = 'failed';
        pd.errorMessage = errMsg.substring(0, 500);
        await this.personnelDeviceRepo.save(pd);

        results.push({ deviceId, deviceName: device.name, success: false, error: errMsg });

        this.logger.error(
          `Failed to enroll personnel "${name}" (uid=${uid}) on device "${device.name}": ${errMsg}`,
        );
      } finally {
        if (zk) {
          await this.zktecoClient.disconnect(zk);
        }
      }
    }

    // Audit log
    const successCount = results.filter((r) => r.success).length;
    this.auditLogService.log({
      action: 'SUPERVISOR_ASSIGN',
      userId,
      username,
      targetEntity: 'PersonnelDevice',
      targetId: personnelId,
      details: {
        personnelName: `${personnel.firstName} ${personnel.lastName}`,
        deviceIds,
        successCount,
        totalCount: deviceIds.length,
        results,
      },
    });

    return results;
  }

  /**
   * Assign a personnel to all active devices at a given location.
   */
  async assignLocation(
    personnelId: string,
    locationId: string,
    userId?: string,
    username?: string,
  ): Promise<AssignmentResult[]> {
    const location = await this.locationRepo.findOne({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException('Lokasyon bulunamadi');
    }

    const devices = await this.deviceRepo.find({
      where: { locationId, isActive: true },
    });

    if (devices.length === 0) {
      throw new BadRequestException('Bu lokasyonda aktif cihaz bulunamadi');
    }

    const deviceIds = devices.map((d) => d.id);
    return this.assign(personnelId, deviceIds, userId, username);
  }

  /**
   * Unassign (unenroll) a personnel from one or more devices.
   */
  async unassign(
    personnelId: string,
    deviceIds: string[],
    userId?: string,
    username?: string,
  ): Promise<AssignmentResult[]> {
    const personnel = await this.personnelRepo.findOne({ where: { id: personnelId } });
    if (!personnel) {
      throw new NotFoundException('Personel bulunamadi');
    }

    const uid = this.resolveUid(personnel);
    const results: AssignmentResult[] = [];

    for (const deviceId of deviceIds) {
      const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
      if (!device) {
        results.push({ deviceId, deviceName: 'Bilinmiyor', success: false, error: 'Cihaz bulunamadi' });
        continue;
      }

      const pd = await this.personnelDeviceRepo.findOne({
        where: { personnelId, deviceId },
      });

      let zk: any;
      try {
        zk = await this.zktecoClient.connect(device.ipAddress, device.port, device.commKey);
        await this.zktecoClient.deleteUser(zk, uid);

        // Remove the assignment record
        if (pd) {
          await this.personnelDeviceRepo.remove(pd);
        }

        results.push({ deviceId, deviceName: device.name, success: true });

        this.logger.log(
          `Unenrolled personnel "${personnel.firstName} ${personnel.lastName}" (uid=${uid}) from device "${device.name}" (${device.ipAddress})`,
        );
      } catch (error) {
        const errMsg = error?.message || JSON.stringify(error);
        results.push({ deviceId, deviceName: device.name, success: false, error: errMsg });

        this.logger.error(
          `Failed to unenroll personnel (uid=${uid}) from device "${device.name}": ${errMsg}`,
        );
      } finally {
        if (zk) {
          await this.zktecoClient.disconnect(zk);
        }
      }
    }

    // Audit log
    const successCount = results.filter((r) => r.success).length;
    this.auditLogService.log({
      action: 'SUPERVISOR_UNASSIGN',
      userId,
      username,
      targetEntity: 'PersonnelDevice',
      targetId: personnelId,
      details: {
        personnelName: `${personnel.firstName} ${personnel.lastName}`,
        deviceIds,
        successCount,
        totalCount: deviceIds.length,
        results,
      },
    });

    return results;
  }

  /**
   * Bulk assign multiple personnel to devices.
   * Optimized: connects to each device once, enrolls all personnel, then disconnects.
   */
  async bulkAssign(
    personnelIds: string[],
    deviceIds: string[],
    userId?: string,
    username?: string,
  ): Promise<BulkAssignmentResult[]> {
    // Load all personnel upfront
    const personnelList = await this.personnelRepo.findByIds(personnelIds);
    const personnelMap = new Map(personnelList.map((p) => [p.id, p]));

    // Prepare result map: personnelId → { deviceId → AssignmentResult }
    const resultMap = new Map<string, Map<string, AssignmentResult>>();
    for (const pid of personnelIds) {
      resultMap.set(pid, new Map());
    }

    // Resolve UIDs and filter out invalid personnel
    const validPersonnel: { id: string; uid: number; name: string; cardno: number; userId: string }[] = [];
    for (const pid of personnelIds) {
      const p = personnelMap.get(pid);
      if (!p) {
        // Mark all devices as failed for missing personnel
        for (const did of deviceIds) {
          resultMap.get(pid)!.set(did, { deviceId: did, deviceName: 'Bilinmiyor', success: false, error: 'Personel bulunamadı' });
        }
        continue;
      }
      try {
        const uid = this.resolveUid(p);
        validPersonnel.push({
          id: p.id,
          uid,
          name: `${p.firstName} ${p.lastName}`.substring(0, 24),
          cardno: parseInt(p.cardNumber, 10) || 0,
          userId: p.employeeId ? String(p.employeeId) : String(uid),
        });
      } catch (error) {
        for (const did of deviceIds) {
          resultMap.get(pid)!.set(did, { deviceId: did, deviceName: 'Bilinmiyor', success: false, error: error?.message ?? 'UID hatası' });
        }
      }
    }

    // Process device by device: single connection per device
    for (const deviceId of deviceIds) {
      const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
      if (!device) {
        for (const vp of validPersonnel) {
          resultMap.get(vp.id)!.set(deviceId, { deviceId, deviceName: 'Bilinmiyor', success: false, error: 'Cihaz bulunamadı' });
        }
        continue;
      }

      let zk: any;
      let connected = false;
      try {
        zk = await this.zktecoClient.connect(device.ipAddress, device.port, device.commKey);
        await this.zktecoClient.getUsers(zk); // prime packet format detection
        connected = true;
      } catch (error) {
        const errMsg = error?.message || 'Bağlantı hatası';
        this.logger.error(`Bulk assign: failed to connect to device "${device.name}" (${device.ipAddress}): ${errMsg}`);
        for (const vp of validPersonnel) {
          resultMap.get(vp.id)!.set(deviceId, { deviceId, deviceName: device.name, success: false, error: errMsg });
          // Save failed PersonnelDevice record
          await this.upsertPersonnelDevice(vp.id, deviceId, 'failed', userId, errMsg);
        }
        continue;
      }

      // Enroll each personnel on this open connection
      for (const vp of validPersonnel) {
        try {
          await this.zktecoClient.setUser(zk, vp.uid, vp.name, vp.cardno, vp.userId);
          await this.upsertPersonnelDevice(vp.id, deviceId, 'enrolled', userId, null);
          resultMap.get(vp.id)!.set(deviceId, { deviceId, deviceName: device.name, success: true });
          this.logger.log(`Enrolled "${vp.name}" (uid=${vp.uid}) on "${device.name}"`);
        } catch (error) {
          const errMsg = (error?.message || 'setUser hatası').substring(0, 500);
          await this.upsertPersonnelDevice(vp.id, deviceId, 'failed', userId, errMsg);
          resultMap.get(vp.id)!.set(deviceId, { deviceId, deviceName: device.name, success: false, error: errMsg });
          this.logger.error(`Failed to enroll "${vp.name}" (uid=${vp.uid}) on "${device.name}": ${errMsg}`);
        }
      }

      // Disconnect once after all personnel enrolled on this device
      if (connected && zk) {
        try {
          await this.zktecoClient.disconnect(zk);
        } catch {
          /* ignore disconnect error */
        }
      }

      this.logger.log(`Bulk assign: finished device "${device.name}" — ${validPersonnel.length} personnel processed`);
    }

    // Build response grouped by personnel
    const bulkResults: BulkAssignmentResult[] = personnelIds.map((pid) => {
      const p = personnelMap.get(pid);
      return {
        personnelId: pid,
        personnelName: p ? `${p.firstName} ${p.lastName}` : pid,
        results: deviceIds.map((did) => resultMap.get(pid)!.get(did) ?? { deviceId: did, deviceName: 'Bilinmiyor', success: false, error: 'İşlenmedi' }),
      };
    });

    const totalSuccess = bulkResults.reduce((s, b) => s + b.results.filter((r) => r.success).length, 0);
    const totalFail = bulkResults.reduce((s, b) => s + b.results.filter((r) => !r.success).length, 0);

    this.auditLogService.log({
      action: 'SUPERVISOR_BULK_ASSIGN',
      userId,
      username,
      targetEntity: 'PersonnelDevice',
      details: {
        personnelCount: personnelIds.length,
        deviceCount: deviceIds.length,
        totalSuccess,
        totalFail,
      },
    });

    return bulkResults;
  }

  /**
   * Upsert a PersonnelDevice record.
   */
  private async upsertPersonnelDevice(
    personnelId: string,
    deviceId: string,
    status: string,
    enrolledBy?: string,
    errorMessage?: string | null,
  ) {
    let pd = await this.personnelDeviceRepo.findOne({ where: { personnelId, deviceId } });
    if (!pd) {
      pd = this.personnelDeviceRepo.create({
        personnelId,
        deviceId,
        status,
        enrolledBy: enrolledBy || null,
        errorMessage: errorMessage || null,
      });
    } else {
      pd.status = status;
      pd.errorMessage = errorMessage || null;
      pd.enrolledBy = enrolledBy || null;
    }
    await this.personnelDeviceRepo.save(pd);
  }

  /**
   * Bulk assign multiple personnel to all devices at a location.
   */
  async bulkAssignLocation(
    personnelIds: string[],
    locationId: string,
    userId?: string,
    username?: string,
  ): Promise<BulkAssignmentResult[]> {
    const location = await this.locationRepo.findOne({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException('Lokasyon bulunamadı');
    }

    const devices = await this.deviceRepo.find({
      where: { locationId, isActive: true },
    });

    if (devices.length === 0) {
      throw new BadRequestException('Bu lokasyonda aktif cihaz bulunamadı');
    }

    const deviceIds = devices.map((d) => d.id);
    return this.bulkAssign(personnelIds, deviceIds, userId, username);
  }

  /**
   * Resolve UID from personnel employeeId. Must be 1-3000.
   */
  private resolveUid(personnel: Personnel): number {
    if (personnel.employeeId) {
      const parsed = parseInt(personnel.employeeId, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 3000) {
        return parsed;
      }
    }
    throw new BadRequestException(
      `"${personnel.firstName} ${personnel.lastName}" icin gecerli employeeId yok (1-3000 arasi olmali)`,
    );
  }
}
