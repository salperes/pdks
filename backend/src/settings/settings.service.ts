import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SystemSettings,
  Holiday,
  Personnel,
  Device,
  Location,
  AccessLog,
} from '../entities';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SystemSettings)
    private readonly settingsRepo: Repository<SystemSettings>,
    @InjectRepository(Holiday)
    private readonly holidayRepo: Repository<Holiday>,
    @InjectRepository(Personnel)
    private readonly personnelRepo: Repository<Personnel>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    @InjectRepository(AccessLog)
    private readonly accessLogRepo: Repository<AccessLog>,
  ) {}

  /* ── Settings ────────────────────────────── */

  async getSettings(): Promise<SystemSettings> {
    let row = await this.settingsRepo.findOneBy({ id: 'default' });
    if (!row) {
      row = this.settingsRepo.create({
        id: 'default',
        workStartTime: '08:00',
        workEndTime: '17:00',
        timezoneOffset: 3,
        syncInterval: 120,
      });
      await this.settingsRepo.save(row);
    }
    return row;
  }

  async updateSettings(
    data: Partial<
      Pick<
        SystemSettings,
        'workStartTime' | 'workEndTime' | 'timezoneOffset' | 'syncInterval' | 'backupEnabled' | 'backupRetentionDays'
      >
    >,
  ): Promise<SystemSettings> {
    const row = await this.getSettings();
    Object.assign(row, data);
    return this.settingsRepo.save(row);
  }

  /* ── Work Config ────────────────────────── */

  buildWorkConfig(
    startTime: string,
    endTime: string,
    timezoneOffset: number,
    isFlexible = false,
    flexGraceMinutes: number | null = null,
  ) {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const sign = timezoneOffset >= 0 ? '+' : '-';
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const tzStr = `${sign}${pad2(Math.abs(timezoneOffset))}:00`;

    return {
      startHour: sh,
      startMin: sm,
      endHour: eh,
      endMin: em,
      tzOffsetMs: timezoneOffset * 3600000,
      tzStr,
      workStartLabel: startTime,
      workEndLabel: endTime,
      isFlexible,
      flexGraceMinutes: flexGraceMinutes ?? null,
      shiftDurationMinutes: (eh * 60 + em) - (sh * 60 + sm),
    };
  }

  async getGlobalWorkConfig() {
    const s = await this.getSettings();
    return this.buildWorkConfig(s.workStartTime, s.workEndTime, s.timezoneOffset);
  }

  async getWorkConfigForLocation(locationId: string | null) {
    const globalSettings = await this.getSettings();

    if (locationId) {
      const location = await this.locationRepo.findOneBy({ id: locationId });
      if (location?.workStartTime && location?.workEndTime) {
        return this.buildWorkConfig(
          location.workStartTime,
          location.workEndTime,
          globalSettings.timezoneOffset,
          location.isFlexible,
          location.flexGraceMinutes,
        );
      }
    }

    return this.buildWorkConfig(
      globalSettings.workStartTime,
      globalSettings.workEndTime,
      globalSettings.timezoneOffset,
    );
  }

  async getAllLocationConfigs() {
    const globalSettings = await this.getSettings();
    const locations = await this.locationRepo.find();
    const globalCfg = this.buildWorkConfig(
      globalSettings.workStartTime,
      globalSettings.workEndTime,
      globalSettings.timezoneOffset,
    );

    const map = new Map<string, ReturnType<SettingsService['buildWorkConfig']>>();
    for (const loc of locations) {
      if (loc.workStartTime && loc.workEndTime) {
        map.set(loc.id, this.buildWorkConfig(
          loc.workStartTime,
          loc.workEndTime,
          globalSettings.timezoneOffset,
          loc.isFlexible,
          loc.flexGraceMinutes,
        ));
      }
    }

    return { globalCfg, locationConfigs: map };
  }

  /* ── Holidays ────────────────────────────── */

  async getHolidays(): Promise<Holiday[]> {
    return this.holidayRepo.find({ order: { date: 'ASC' } });
  }

  async addHoliday(date: string, name: string): Promise<Holiday> {
    const holiday = this.holidayRepo.create({ date, name });
    return this.holidayRepo.save(holiday);
  }

  async deleteHoliday(id: string): Promise<void> {
    await this.holidayRepo.delete(id);
  }

  /* ── System Info ─────────────────────────── */

  async getSystemInfo() {
    const [personnelCount, deviceCount, locationCount, accessLogCount] =
      await Promise.all([
        this.personnelRepo.count({ where: { isActive: true } }),
        this.deviceRepo.count({ where: { isActive: true } }),
        this.locationRepo.count({ where: { isActive: true } }),
        this.accessLogRepo.count(),
      ]);

    return {
      personnelCount,
      deviceCount,
      locationCount,
      accessLogCount,
      dbStatus: 'connected',
    };
  }

  /* ── Backup (settings + holidays JSON) ───── */

  async getBackupData() {
    const [settings, holidays] = await Promise.all([
      this.getSettings(),
      this.getHolidays(),
    ]);

    return {
      exportDate: new Date().toISOString(),
      settings,
      holidays,
    };
  }
}
