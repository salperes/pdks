import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device, AccessLog, Personnel } from '../entities';

/**
 * ADMS (Automatic Data Master Server) push protocol service.
 *
 * ZKTeco devices with comm_type=3 (ADMS) connect TO the server
 * via HTTP to push attendance logs and receive commands.
 *
 * Protocol flow:
 *   1. Device GET  /iclock/cdata?SN=xxx         → server returns config
 *   2. Device POST /iclock/cdata?SN=xxx&table=ATTLOG → device pushes logs
 *   3. Device GET  /iclock/getrequest?SN=xxx     → server returns pending commands
 *   4. Device POST /iclock/devicecmd?SN=xxx      → device reports command result
 */
@Injectable()
export class AdmsService {
  private readonly logger = new Logger(AdmsService.name);

  /** Pending commands per device serial number */
  private readonly pendingCommands: Map<string, string[]> = new Map();

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(AccessLog)
    private readonly accessLogRepository: Repository<AccessLog>,
    @InjectRepository(Personnel)
    private readonly personnelRepository: Repository<Personnel>,
  ) {}

  /**
   * Handle initial device handshake.
   * Device sends: GET /iclock/cdata?SN=<serial>&options=all&pushver=2.4.1&language=xx
   * We return configuration telling the device how often to push, etc.
   */
  async handleHandshake(sn: string): Promise<string> {
    this.logger.log(`ADMS handshake from device SN=${sn}`);

    // Find or auto-register device by serial number
    const device = await this.findOrRegisterDevice(sn);

    // Mark device as online
    await this.deviceRepository.update(device.id, {
      isOnline: true,
      lastOnlineAt: new Date(),
    });

    // Return ADMS configuration
    // TransInterval: push interval in seconds
    // TransFlag: what data to push (AttLog=1, OpLog=2, AttPhoto=4, EnrollUser=8, EnrollFP=16, FaceEnroll=32)
    // Realtime: 1 = push logs immediately as they happen
    // Encrypt: 0 = no encryption
    const config = [
      'GET OPTION FROM: ' + sn,
      'Stamp=9999',
      'OpStamp=9999',
      'PhotoStamp=9999',
      'ErrorDelay=60',
      'Delay=5',
      'TransTimes=00:00;14:05',
      'TransInterval=1',
      'TransFlag=TransData AttLog\tOpLog\tEnrollUser\tEnrollFP',
      'Realtime=1',
      'Encrypt=0',
    ];

    return config.join('\n');
  }

  /**
   * Handle attendance log push from device.
   * Device sends: POST /iclock/cdata?SN=<serial>&table=ATTLOG&Stamp=<stamp>
   * Body contains tab-separated attendance records, one per line.
   * Format: <pin>\t<time>\t<status>\t<verify>\t<work_code>\t<reserved1>\t<reserved2>
   */
  async handleAttendancePush(sn: string, body: string): Promise<{ processed: number }> {
    this.logger.log(`ADMS attendance push from SN=${sn}, body length=${body?.length ?? 0}`);

    const device = await this.findDeviceBySn(sn);
    if (!device) {
      this.logger.warn(`Unknown device SN=${sn}, ignoring attendance push`);
      return { processed: 0 };
    }

    // Update device online status
    await this.deviceRepository.update(device.id, {
      isOnline: true,
      lastOnlineAt: new Date(),
      lastSyncAt: new Date(),
    });

    if (!body || body.trim().length === 0) {
      return { processed: 0 };
    }

    const lines = body.trim().split('\n');
    let processed = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const saved = await this.processAttendanceLine(trimmed, device);
        if (saved) processed++;
      } catch (error) {
        this.logger.warn(`Failed to process ADMS line: ${trimmed}`, error?.message);
      }
    }

    this.logger.log(`ADMS SN=${sn}: processed ${processed}/${lines.length} records`);
    return { processed };
  }

  /**
   * Return pending commands for the device.
   * Device sends: GET /iclock/getrequest?SN=<serial>
   * We return one command at a time, or OK if no commands.
   */
  getPendingCommand(sn: string): string {
    const commands = this.pendingCommands.get(sn);
    if (commands && commands.length > 0) {
      const cmd = commands.shift();
      this.logger.log(`ADMS sending command to SN=${sn}: ${cmd}`);
      if (commands.length === 0) {
        this.pendingCommands.delete(sn);
      }
      return `C:${Date.now()}:${cmd}`;
    }
    return 'OK';
  }

  /**
   * Handle command result from device.
   * Device sends: POST /iclock/devicecmd?SN=<serial>
   */
  handleCommandResult(sn: string, body: string): void {
    this.logger.log(`ADMS command result from SN=${sn}: ${body?.substring(0, 200)}`);
  }

  /**
   * Queue a command to be sent to a device on next getrequest poll.
   */
  queueCommand(sn: string, command: string): void {
    if (!this.pendingCommands.has(sn)) {
      this.pendingCommands.set(sn, []);
    }
    this.pendingCommands.get(sn)!.push(command);
    this.logger.log(`Queued command for SN=${sn}: ${command}`);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async processAttendanceLine(line: string, device: Device): Promise<boolean> {
    // ADMS ATTLOG format: pin\ttime\tstatus\tverify\tworkcode\treserved1\treserved2
    const parts = line.split('\t');
    if (parts.length < 2) {
      this.logger.warn(`Invalid ADMS ATTLOG line (too few fields): ${line}`);
      return false;
    }

    const pin = parts[0]?.trim();
    const timeStr = parts[1]?.trim();
    const status = parts[2]?.trim();
    const verify = parts[3]?.trim();

    if (!pin || !timeStr) return false;

    const deviceUserId = parseInt(pin, 10);
    if (isNaN(deviceUserId)) return false;

    // Parse time: "2024-01-15 08:30:00" format
    const eventTime = new Date(timeStr);
    if (isNaN(eventTime.getTime()) || eventTime.getFullYear() < 2000) {
      return false;
    }

    // Dedup check
    const existing = await this.accessLogRepository.findOne({
      where: {
        deviceId: device.id,
        deviceUserId,
        eventTime,
      },
    });

    if (existing) return false;

    // Find personnel by employeeId
    const personnel = await this.personnelRepository.findOne({
      where: { employeeId: String(deviceUserId) },
    });

    const accessLog = new AccessLog();
    accessLog.deviceId = device.id;
    accessLog.locationId = device.locationId;
    accessLog.eventTime = eventTime;
    accessLog.source = 'adms';
    accessLog.deviceUserId = deviceUserId;
    accessLog.rawData = { pin, time: timeStr, status, verify, line };
    if (personnel) {
      accessLog.personnelId = personnel.id;
    }
    if (device.direction !== 'both') {
      accessLog.direction = device.direction;
    }

    await this.accessLogRepository.save(accessLog);
    return true;
  }

  private async findDeviceBySn(sn: string): Promise<Device | null> {
    return this.deviceRepository.findOne({
      where: { serialNumber: sn },
    });
  }

  private async findOrRegisterDevice(sn: string): Promise<Device> {
    let device = await this.findDeviceBySn(sn);

    if (!device) {
      this.logger.log(`Auto-registering new ADMS device SN=${sn}`);
      device = this.deviceRepository.create({
        name: `ADMS-${sn}`,
        serialNumber: sn,
        ipAddress: '0.0.0.0',
        port: 4370,
        isActive: true,
      });
      device = await this.deviceRepository.save(device);
    }

    return device;
  }
}
