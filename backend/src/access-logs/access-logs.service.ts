import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessLog, Personnel } from '../entities';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QueryAccessLogsDto } from './dto/query-access-logs.dto';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface CreateLogData {
  personnelId?: string;
  deviceId: string;
  locationId?: string;
  eventTime: Date;
  direction?: string;
  source?: string;
  deviceUserId?: number;
  rawData?: Record<string, any>;
}

interface LocationOccupancy {
  locationId: string;
  locationName: string;
  count: number;
}

@Injectable()
export class AccessLogsService {
  private readonly logger = new Logger(AccessLogsService.name);

  constructor(
    @InjectRepository(AccessLog)
    private readonly accessLogsRepository: Repository<AccessLog>,
    @InjectRepository(Personnel)
    private readonly personnelRepository: Repository<Personnel>,
    private readonly settingsService: SettingsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private applyFilters(
    qb: any,
    query: QueryAccessLogsDto,
  ) {
    const { personnelId, deviceId, locationId, startDate, endDate, direction, search } = query;

    if (personnelId) {
      qb.andWhere('log.personnelId = :personnelId', { personnelId });
    }
    if (deviceId) {
      qb.andWhere('log.deviceId = :deviceId', { deviceId });
    }
    if (locationId) {
      qb.andWhere('log.locationId = :locationId', { locationId });
    }
    if (startDate) {
      qb.andWhere('log.eventTime >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('log.eventTime <= :endDate', { endDate });
    }
    if (direction) {
      qb.andWhere('log.direction = :direction', { direction });
    }
    if (search) {
      qb.andWhere(
        `(LOWER(personnel.firstName) LIKE LOWER(:search)
          OR LOWER(personnel.lastName) LIKE LOWER(:search)
          OR LOWER(personnel.cardNumber) LIKE LOWER(:search)
          OR LOWER(personnel.employeeId) LIKE LOWER(:search))`,
        { search: `%${search}%` },
      );
    }
  }

  async findAll(query: QueryAccessLogsDto): Promise<PaginatedResult<AccessLog>> {
    const { page = 1, limit = 50 } = query;

    const qb = this.accessLogsRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.personnel', 'personnel')
      .leftJoinAndSelect('log.device', 'device')
      .leftJoinAndSelect('log.location', 'location');

    this.applyFilters(qb, query);

    qb.orderBy('log.eventTime', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findForExport(query: QueryAccessLogsDto): Promise<AccessLog[]> {
    const qb = this.accessLogsRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.personnel', 'personnel')
      .leftJoinAndSelect('log.device', 'device')
      .leftJoinAndSelect('log.location', 'location');

    this.applyFilters(qb, query);

    qb.orderBy('log.eventTime', 'DESC');
    qb.take(10000);

    return qb.getMany();
  }

  async findUnknown(query: QueryAccessLogsDto): Promise<PaginatedResult<AccessLog>> {
    const { page = 1, limit = 50 } = query;

    const qb = this.accessLogsRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.device', 'device')
      .leftJoinAndSelect('log.location', 'location')
      .where('log.personnelId IS NULL');

    qb.orderBy('log.eventTime', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findPaired(date: string) {
    const settings = await this.settingsService.getSettings();
    const offset = settings.timezoneOffset;
    const sign = offset >= 0 ? '+' : '-';
    const absH = String(Math.abs(offset)).padStart(2, '0');
    const tz = `${sign}${absH}:00`;

    const dayStart = new Date(`${date}T00:00:00${tz}`);
    const dayEnd = new Date(dayStart.getTime() + 86400000);

    const logs = await this.accessLogsRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.personnel', 'personnel')
      .leftJoinAndSelect('log.device', 'device')
      .leftJoinAndSelect('log.location', 'location')
      .where('log.eventTime >= :start', { start: dayStart })
      .andWhere('log.eventTime < :end', { end: dayEnd })
      .andWhere('log.personnelId IS NOT NULL')
      .orderBy('log.personnelId')
      .addOrderBy('log.eventTime', 'ASC')
      .getMany();

    // Personel bazlı grupla
    const grouped = new Map<string, AccessLog[]>();
    for (const log of logs) {
      const pid = log.personnelId;
      if (!grouped.has(pid)) grouped.set(pid, []);
      grouped.get(pid)!.push(log);
    }

    const pairs: {
      personnelId: string;
      personnelName: string;
      department: string;
      firstIn: string | null;
      lastOut: string | null;
      durationMinutes: number | null;
      totalEvents: number;
    }[] = [];

    for (const [pid, pLogs] of grouped) {
      const p = pLogs[0].personnel;
      const name = p ? `${p.firstName} ${p.lastName}` : `ID: ${pid}`;
      const dept = p?.department || '';

      const inLogs = pLogs.filter((l) => l.direction === 'in');
      const outLogs = pLogs.filter((l) => l.direction === 'out');

      const firstIn = inLogs.length > 0 ? inLogs[0].eventTime : null;
      const lastOut = outLogs.length > 0 ? outLogs[outLogs.length - 1].eventTime : null;

      let durationMinutes: number | null = null;
      if (firstIn && lastOut && lastOut > firstIn) {
        durationMinutes = Math.round(
          (new Date(lastOut).getTime() - new Date(firstIn).getTime()) / 60000,
        );
      }

      pairs.push({
        personnelId: pid,
        personnelName: name,
        department: dept,
        firstIn: firstIn ? new Date(firstIn).toISOString() : null,
        lastOut: lastOut ? new Date(lastOut).toISOString() : null,
        durationMinutes,
        totalEvents: pLogs.length,
      });
    }

    // Sırala: isme göre
    pairs.sort((a, b) => a.personnelName.localeCompare(b.personnelName, 'tr'));

    return { date, pairs };
  }

  async createLog(data: CreateLogData): Promise<AccessLog> {
    const existing = await this.accessLogsRepository.findOneBy({
      deviceId: data.deviceId,
      deviceUserId: data.deviceUserId,
      eventTime: data.eventTime,
    });

    if (existing) {
      Object.assign(existing, data);
      return this.accessLogsRepository.save(existing);
    }

    const log = this.accessLogsRepository.create(data);
    const saved = await this.accessLogsRepository.save(log);

    // Bildirim kontrolleri
    this.checkNotifications(saved, data).catch((err) =>
      this.logger.warn('Bildirim kontrolü başarısız', err),
    );

    return saved;
  }

  private async checkNotifications(
    log: AccessLog,
    data: CreateLogData,
  ): Promise<void> {
    // 1. Tanımsız kart
    if (!data.personnelId) {
      this.notificationsService.add({
        type: 'unknown_card',
        message: `Tanımsız kart geçişi (Kart #${data.deviceUserId || '?'})`,
        deviceName: undefined,
      });
      return;
    }

    // 2. Lokasyon bazlı mesai saatlerini çözümle
    const locCfg = await this.settingsService.getWorkConfigForLocation(data.locationId || null);
    const offset = locCfg.tzOffsetMs / 3600000;
    const eventMs = new Date(data.eventTime).getTime();
    const localMs = eventMs + locCfg.tzOffsetMs;
    const localDate = new Date(localMs);
    const localHour = localDate.getUTCHours();
    const localMinute = localDate.getUTCMinutes();
    const localTimeStr = `${String(localHour).padStart(2, '0')}:${String(localMinute).padStart(2, '0')}`;

    const workStart = locCfg.workStartLabel; // e.g. "08:00"
    const workEnd = locCfg.workEndLabel; // e.g. "17:00"

    // Mesai saatlerinin 1 saat öncesi-sonrası dışındaysa uyarı
    const earlyLimit = this.subtractMinutes(workStart, 60);
    const lateLimit = this.addMinutes(workEnd, locCfg.isFlexible && locCfg.flexGraceMinutes ? locCfg.flexGraceMinutes + 60 : 60);

    if (localTimeStr < earlyLimit || localTimeStr > lateLimit) {
      const personnel = await this.personnelRepository.findOneBy({
        id: data.personnelId,
      });
      const name = personnel
        ? `${personnel.firstName} ${personnel.lastName}`
        : `ID: ${data.personnelId}`;
      this.notificationsService.add({
        type: 'after_hours',
        message: `Mesai dışı geçiş: ${name} (${localTimeStr})`,
        personnelName: name,
      });
      return;
    }

    // 3. Geç kalma kontrolü (sadece direction=in)
    if (data.direction === 'in') {
      // Esnek mesai: workStart + flexGraceMinutes + 15dk tolerans
      // Normal mesai: workStart + 15dk tolerans
      const graceMinutes = locCfg.isFlexible && locCfg.flexGraceMinutes
        ? locCfg.flexGraceMinutes + 15
        : 15;
      const lateThreshold = this.addMinutes(workStart, graceMinutes);
      if (localTimeStr > lateThreshold) {
        const personnel = await this.personnelRepository.findOneBy({
          id: data.personnelId,
        });
        const name = personnel
          ? `${personnel.firstName} ${personnel.lastName}`
          : `ID: ${data.personnelId}`;
        this.notificationsService.add({
          type: 'late_arrival',
          message: `Geç giriş: ${name} (${localTimeStr})`,
          personnelName: name,
        });
      }
    }
  }

  private addMinutes(timeStr: string, minutes: number): string {
    const [h, m] = timeStr.split(':').map(Number);
    const total = h * 60 + m + minutes;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  private subtractMinutes(timeStr: string, minutes: number): string {
    const [h, m] = timeStr.split(':').map(Number);
    let total = h * 60 + m - minutes;
    if (total < 0) total += 1440;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  async deleteBulk(ids: string[]): Promise<{ deleted: number }> {
    if (!ids || ids.length === 0) return { deleted: 0 };
    const result = await this.accessLogsRepository
      .createQueryBuilder()
      .delete()
      .whereInIds(ids)
      .execute();
    return { deleted: result.affected || 0 };
  }

  async getPersonnelCountByLocation(): Promise<LocationOccupancy[]> {
    const result = await this.accessLogsRepository
      .createQueryBuilder('log')
      .select('log.locationId', 'locationId')
      .addSelect('location.name', 'locationName')
      .addSelect('COUNT(DISTINCT log.personnelId)', 'count')
      .innerJoin('log.location', 'location')
      .where('log.personnelId IS NOT NULL')
      .andWhere('log.direction = :direction', { direction: 'in' })
      .andWhere(
        `log.eventTime = (
          SELECT MAX(sub.event_time)
          FROM access_logs sub
          WHERE sub.personnel_id = log.personnel_id
        )`,
      )
      .groupBy('log.locationId')
      .addGroupBy('location.name')
      .getRawMany();

    return result.map((row) => ({
      locationId: row.locationId,
      locationName: row.locationName,
      count: parseInt(row.count, 10),
    }));
  }
}
