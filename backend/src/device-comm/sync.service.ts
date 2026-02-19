import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interval } from '@nestjs/schedule';
import { Device, AccessLog, Personnel, SyncHistory } from '../entities';
import { ZktecoClientService } from './zkteco-client.service';
import { EmailService } from '../email/email.service';

// Time drift threshold in seconds — correct device clock if off by more than this
const TIME_SYNC_THRESHOLD_SECONDS = 60;
// Turkey timezone offset (UTC+3) in milliseconds
const TURKEY_OFFSET_MS = 3 * 60 * 60 * 1000;

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private isSyncing = false;

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(AccessLog)
    private readonly accessLogRepository: Repository<AccessLog>,
    @InjectRepository(Personnel)
    private readonly personnelRepository: Repository<Personnel>,
    @InjectRepository(SyncHistory)
    private readonly syncHistoryRepository: Repository<SyncHistory>,
    private readonly zktecoClient: ZktecoClientService,
    private readonly emailService: EmailService,
  ) {}

  @Interval(120_000)
  async syncAllDevices(): Promise<void> {
    if (this.isSyncing) {
      this.logger.debug('Sync already in progress, skipping');
      return;
    }

    this.isSyncing = true;

    try {
      const devices = await this.deviceRepository.find({
        where: { isActive: true },
      });

      const reachable = devices.filter(
        (d) => d.ipAddress && d.ipAddress !== '0.0.0.0',
      );

      if (reachable.length === 0) {
        return;
      }

      this.logger.log(`Starting sync for ${reachable.length} device(s)`);

      for (const device of reachable) {
        try {
          const result = await this.syncDevice(device);
          if (result.recordsSynced > 0) {
            this.logger.log(
              `${device.name}: synced ${result.recordsSynced} new record(s)`,
            );
          }
        } catch (error) {
          this.logger.warn(`Failed to sync ${device.name} (${device.ipAddress}): ${error?.message}`);
          this.emailService.sendSystemErrorNotification({
            deviceName: device.name,
            deviceId: device.id,
            errorType: 'Cihaz Senkronizasyon Hatası',
            message: error?.message ?? 'Bilinmeyen hata',
          }).catch(() => {});
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  async syncDevice(device: Device): Promise<{ recordsSynced: number }> {
    const syncRecord = this.syncHistoryRepository.create({
      deviceId: device.id,
      syncType: 'attendance',
      status: 'in_progress',
      startedAt: new Date(),
    });
    await this.syncHistoryRepository.save(syncRecord);

    let zk: any = null;

    try {
      // Fresh connection for each sync (avoids stale connection issues)
      zk = await this.zktecoClient.connect(
        device.ipAddress,
        device.port,
        device.commKey || undefined,
      );

      // Time sync: check device clock and correct if drifted
      await this.checkAndSyncTime(zk, device);

      const attendanceData = await this.zktecoClient.getAttendances(zk);
      const logs: any[] = attendanceData?.data ?? [];
      this.logger.debug(`${device.name}: getAttendances returned ${logs.length} record(s)`);
      let recordsSynced = 0;

      for (const log of logs) {
        const synced = await this.processAttendanceLog(log, device);
        if (synced) {
          recordsSynced++;
        }
      }

      await this.deviceRepository.update(device.id, {
        isOnline: true,
        lastOnlineAt: new Date(),
        lastSyncAt: new Date(),
      });

      syncRecord.status = 'completed';
      syncRecord.recordsSynced = recordsSynced;
      syncRecord.completedAt = new Date();
      await this.syncHistoryRepository.save(syncRecord);

      return { recordsSynced };
    } catch (error) {
      syncRecord.status = 'failed';
      syncRecord.errorMessage = error.message;
      syncRecord.completedAt = new Date();
      await this.syncHistoryRepository.save(syncRecord);

      throw error;
    } finally {
      if (zk) {
        await this.zktecoClient.disconnect(zk);
      }
    }
  }

  private async checkAndSyncTime(zk: any, device: Device): Promise<void> {
    try {
      const deviceTime = await this.zktecoClient.getTime(zk);
      if (!deviceTime) {
        this.logger.debug(`${device.name}: getTime returned null, skipping time sync`);
        return;
      }

      // deviceTime is device's local clock (Turkey UTC+3), parsed as UTC by the library.
      // Convert to real UTC by subtracting the offset, then compare with server UTC.
      const deviceUtcMs = deviceTime.getTime() - TURKEY_OFFSET_MS;
      const serverUtcMs = Date.now();
      const driftSeconds = Math.round((deviceUtcMs - serverUtcMs) / 1000);

      if (Math.abs(driftSeconds) > TIME_SYNC_THRESHOLD_SECONDS) {
        // Device clock is off — correct it.
        // setTime expects a Date in the library's convention (local time as UTC).
        const serverLocalDate = new Date(serverUtcMs + TURKEY_OFFSET_MS);
        this.logger.warn(
          `${device.name}: clock drift detected: ${driftSeconds > 0 ? '+' : ''}${driftSeconds}s — correcting to server time`,
        );
        await this.zktecoClient.setTime(zk, serverLocalDate);
        this.logger.log(`${device.name}: device clock corrected successfully`);
      } else {
        this.logger.debug(`${device.name}: clock OK (drift: ${driftSeconds}s)`);
      }
    } catch (error) {
      // Time sync failure should not block attendance sync
      this.logger.warn(`${device.name}: time sync check failed: ${error?.message}`);
    }
  }

  private async processAttendanceLog(log: any, device: Device): Promise<boolean> {
    // Extract user ID (zkteco-js returns user_id for UDP, uid for TCP)
    const rawUserId = log.user_id ?? log.deviceUserId ?? log.uid;
    const deviceUserId = rawUserId != null ? Number(rawUserId) : null;

    // Extract event time (zkteco-js returns Date objects in device-local time)
    // ZKTeco devices store local time (Turkey = UTC+3), not UTC.
    const rawTime = log.record_time ?? log.recordTime;
    let eventTime: Date;
    if (rawTime instanceof Date) {
      // Device returns a Date parsed as UTC, but it's actually local time.
      // Subtract the timezone offset to convert to real UTC.
      eventTime = new Date(rawTime.getTime() - 3 * 60 * 60 * 1000);
    } else if (rawTime) {
      const parsed = new Date(rawTime);
      eventTime = new Date(parsed.getTime() - 3 * 60 * 60 * 1000);
    } else {
      eventTime = new Date();
    }

    // Skip records with clearly invalid dates (before 2000 or far future)
    const year = eventTime.getFullYear();
    if (year < 2000 || year > new Date().getFullYear() + 1) {
      return false;
    }

    // Dedup check
    const whereClause: any = {
      deviceId: device.id,
      eventTime,
    };
    if (deviceUserId != null) {
      whereClause.deviceUserId = deviceUserId;
    }

    const existingLog = await this.accessLogRepository.findOne({
      where: whereClause,
    });

    if (existingLog) {
      return false;
    }

    const personnel = deviceUserId != null
      ? await this.findPersonnelByDeviceUser(deviceUserId)
      : null;

    const accessLog = new AccessLog();
    accessLog.deviceId = device.id;
    accessLog.locationId = device.locationId;
    accessLog.eventTime = eventTime;
    accessLog.source = 'sync';
    accessLog.deviceUserId = deviceUserId as any;
    accessLog.rawData = log;
    if (personnel) {
      accessLog.personnelId = personnel.id;
    }
    if (device.direction !== 'both') {
      accessLog.direction = device.direction;
    }

    await this.accessLogRepository.save(accessLog);
    return true;
  }

  private async findPersonnelByDeviceUser(deviceUserId: number): Promise<Personnel | null> {
    if (deviceUserId == null) {
      return null;
    }

    // ZKTeco device user_id corresponds to Personnel ID (employeeId), not card number
    const personnel = await this.personnelRepository.findOne({
      where: { employeeId: String(deviceUserId) },
    });

    return personnel ?? null;
  }
}
