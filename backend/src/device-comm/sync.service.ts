import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interval } from '@nestjs/schedule';
import { Device, AccessLog, Personnel, SyncHistory } from '../entities';
import { DeviceManagerService } from './device-manager.service';
import { ZktecoClientService } from './zkteco-client.service';

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
    private readonly deviceManager: DeviceManagerService,
    private readonly zktecoClient: ZktecoClientService,
  ) {}

  @Interval(60_000)
  async syncAllDevices(): Promise<void> {
    if (this.isSyncing) {
      this.logger.debug('Sync already in progress, skipping');
      return;
    }

    this.isSyncing = true;

    try {
      const connectedDeviceIds = this.deviceManager.getConnectedDeviceIds();

      if (connectedDeviceIds.length === 0) {
        return;
      }

      this.logger.debug(`Starting sync for ${connectedDeviceIds.length} device(s)`);

      for (const deviceId of connectedDeviceIds) {
        try {
          const result = await this.syncDevice(deviceId);
          if (result.recordsSynced > 0) {
            this.logger.log(
              `Device ${deviceId}: synced ${result.recordsSynced} record(s)`,
            );
          }
        } catch (error) {
          this.logger.error(`Failed to sync device ${deviceId}`, error);
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  async syncDevice(deviceId: string): Promise<{ recordsSynced: number }> {
    const zk = this.deviceManager.getConnection(deviceId);

    if (!zk) {
      throw new Error(`Device ${deviceId} is not connected`);
    }

    const device = await this.deviceRepository.findOne({
      where: { id: deviceId },
    });

    if (!device) {
      throw new Error(`Device ${deviceId} not found in database`);
    }

    const syncRecord = this.syncHistoryRepository.create({
      deviceId,
      syncType: 'attendance',
      status: 'in_progress',
      startedAt: new Date(),
    });
    await this.syncHistoryRepository.save(syncRecord);

    try {
      const attendanceData = await this.zktecoClient.getAttendances(zk);
      const logs: any[] = attendanceData?.data ?? [];
      this.logger.debug(`Device ${deviceId}: getAttendances returned ${logs.length} record(s)`);
      let recordsSynced = 0;

      for (const log of logs) {
        const synced = await this.processAttendanceLog(log, device);
        if (synced) {
          recordsSynced++;
        }
      }

      await this.deviceRepository.update(deviceId, {
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
    }
  }

  private async processAttendanceLog(log: any, device: Device): Promise<boolean> {
    // Extract user ID (zkteco-js returns user_id for UDP, uid for TCP)
    const rawUserId = log.user_id ?? log.deviceUserId ?? log.uid;
    const deviceUserId = rawUserId != null ? Number(rawUserId) : null;

    // Extract event time (zkteco-js returns Date objects, not strings)
    const rawTime = log.record_time ?? log.recordTime;
    const eventTime: Date = rawTime instanceof Date
      ? rawTime
      : rawTime
        ? new Date(rawTime)
        : new Date();

    // Skip records with clearly invalid dates (year 0 or before 2000)
    if (eventTime.getFullYear() < 2000) {
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
