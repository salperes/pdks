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
  source?: string;
  deviceUserId?: number;
  rawData?: Record<string, any>;
}

interface LocationOccupancy {
  locationId: string;
  locationName: string;
  count: number;
}

type DerivedDirection = 'in' | 'out' | 'transit' | null;

// Postgres Europe/Istanbul günü (vardiya yok; gelecekte lokasyon bazlı TZ'ye geçilebilir)
const DAY_TZ = 'Europe/Istanbul';

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

  // SQL WHERE parçası: derive edilmiş yöne göre filtre
  private derivedDirectionCase(): string {
    // Öncelik: cihaz yön damgalamış (in/out) → onu kullan.
    // Aksi halde personel + gün bazında ilk/son türev kuralı.
    return `(CASE
      WHEN log.direction IN ('in', 'out') THEN log.direction
      WHEN log.personnel_id IS NULL THEN NULL
      WHEN log.event_time = (
        SELECT MIN(sub.event_time) FROM access_logs sub
        WHERE sub.personnel_id = log.personnel_id
          AND date_trunc('day', sub.event_time AT TIME ZONE '${DAY_TZ}')
            = date_trunc('day', log.event_time AT TIME ZONE '${DAY_TZ}')
      ) THEN 'in'
      WHEN log.event_time = (
        SELECT MAX(sub.event_time) FROM access_logs sub
        WHERE sub.personnel_id = log.personnel_id
          AND date_trunc('day', sub.event_time AT TIME ZONE '${DAY_TZ}')
            = date_trunc('day', log.event_time AT TIME ZONE '${DAY_TZ}')
      ) THEN 'out'
      ELSE 'transit'
    END)`;
  }

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
      qb.andWhere('log.eventTime <= :endDate', { endDate: endDate + ' 23:59:59' });
    }
    if (direction) {
      qb.andWhere(`${this.derivedDirectionCase()} = :direction`, { direction });
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

  /**
   * Sayfalanmış log listesi için her satıra `derivedDirection` ekler.
   * (personnelId, gün) gruplarının min/max zamanını tek SQL ile çeker; sayfada
   * olmayan erken/geç kayıtlar da doğru etiketlenir.
   */
  private async attachDerivedDirections(logs: AccessLog[]): Promise<void> {
    if (logs.length === 0) return;

    // Benzersiz personnelId ve (yerel) gün kümelerini topla
    const personnelIds = new Set<string>();
    for (const log of logs) {
      if (log.personnelId) personnelIds.add(log.personnelId);
    }
    if (personnelIds.size === 0) {
      for (const log of logs) (log as any).derivedDirection = null;
      return;
    }

    // İlgili personellerin access loglarından (event_time, personnel_id, gün) bazında min/max
    // Yalnızca sayfadaki logların tarih aralığını içeren sorgu — sayfadaki hangi günlerin
    // gerektiğini tam bilmeden güvenli yol: sayfada geçen her personel için, sayfada
    // görünen günlerin min/max'ı.
    const dayKeys = new Set<string>(); // 'YYYY-MM-DD' (Europe/Istanbul yerel)
    const logDay = new Map<string, string>(); // log.id → dayKey
    for (const log of logs) {
      if (!log.personnelId) continue;
      const d = new Date(log.eventTime);
      // Europe/Istanbul için UTC+3 (DST yok)
      const local = new Date(d.getTime() + 3 * 3600 * 1000);
      const dayKey = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
      dayKeys.add(dayKey);
      logDay.set(log.id, dayKey);
    }

    const personnelArr = Array.from(personnelIds);
    const dayArr = Array.from(dayKeys);

    const rows: { personnel_id: string; day: string; min_t: Date; max_t: Date }[] =
      await this.accessLogsRepository.query(
        `SELECT personnel_id,
                to_char(date_trunc('day', event_time AT TIME ZONE $3), 'YYYY-MM-DD') AS day,
                MIN(event_time) AS min_t,
                MAX(event_time) AS max_t
         FROM access_logs
         WHERE personnel_id = ANY($1::uuid[])
           AND date_trunc('day', event_time AT TIME ZONE $3) = ANY($2::timestamp[])
         GROUP BY personnel_id, day`,
        [personnelArr, dayArr.map((d) => `${d} 00:00:00`), DAY_TZ],
      );

    const stats = new Map<string, { min: number; max: number }>(); // key: personnelId|day
    for (const r of rows) {
      stats.set(`${r.personnel_id}|${r.day}`, {
        min: new Date(r.min_t).getTime(),
        max: new Date(r.max_t).getTime(),
      });
    }

    for (const log of logs) {
      // Cihaz yön damgası varsa öncelik onda (yön belirtilmiş cihazdan gelen kayıt)
      if (log.direction === 'in' || log.direction === 'out') {
        (log as any).derivedDirection = log.direction;
        continue;
      }
      if (!log.personnelId) {
        (log as any).derivedDirection = null;
        continue;
      }
      const dayKey = logDay.get(log.id)!;
      const s = stats.get(`${log.personnelId}|${dayKey}`);
      if (!s) {
        (log as any).derivedDirection = null;
        continue;
      }
      const t = new Date(log.eventTime).getTime();
      if (t === s.min) (log as any).derivedDirection = 'in';
      else if (t === s.max) (log as any).derivedDirection = 'out';
      else (log as any).derivedDirection = 'transit';
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
    await this.attachDerivedDirections(data);

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

    const data = await qb.getMany();
    await this.attachDerivedDirections(data);
    return data;
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
    // Tanımsız kartların personnelId null — derivedDirection de null kalır
    for (const log of data) (log as any).derivedDirection = null;

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
      calculationMode: string;
    }[] = [];

    for (const [pid, pLogs] of grouped) {
      const p = pLogs[0].personnel;
      const name = p ? `${p.firstName} ${p.lastName}` : `ID: ${pid}`;
      const dept = p?.department || '';

      // Öncelik: yön damgalı cihaz kayıtları varsa onlar baz alınır
      // (direction='in' → ilk 'in' = giriş; direction='out' → son 'out' = çıkış).
      // Yoksa fallback: ilk/son türev kuralı.
      const inLogs = pLogs.filter((l) => l.direction === 'in');
      const outLogs = pLogs.filter((l) => l.direction === 'out');
      const firstIn =
        inLogs.length > 0 ? inLogs[0].eventTime : pLogs[0].eventTime;
      const lastOut =
        outLogs.length > 0
          ? outLogs[outLogs.length - 1].eventTime
          : pLogs.length > 1
            ? pLogs[pLogs.length - 1].eventTime
            : null;

      let durationMinutes: number | null = null;
      if (firstIn && lastOut && new Date(lastOut) > new Date(firstIn)) {
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
        calculationMode: inLogs.length + outLogs.length > 0 ? 'directed' : 'derived',
      });
    }

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
    const eventMs = new Date(data.eventTime).getTime();
    const localMs = eventMs + locCfg.tzOffsetMs;
    const localDate = new Date(localMs);
    const localHour = localDate.getUTCHours();
    const localMinute = localDate.getUTCMinutes();
    const localTimeStr = `${String(localHour).padStart(2, '0')}:${String(localMinute).padStart(2, '0')}`;

    const workStart = locCfg.workStartLabel;
    const workEnd = locCfg.workEndLabel;

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

    // Geç kalma kontrolü: izin/görev modülü ile birlikte yeniden ele alınacak.
    // Türev yön modelinde "ilk giriş" kavramı sorgulama anında hesaplandığı için
    // anlık bildirim burada devre dışı bırakıldı (Rev 051).
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

  /**
   * Her lokasyondaki bugünkü en son kart geçişine göre personel sayısı.
   * Türev modelde "kişi son olarak hangi lokasyonda okutmuşsa orada sayılır";
   * bu dashboard / anlık doluluk görünümü için yeterli yaklaşım.
   */
  async getPersonnelCountByLocation(): Promise<LocationOccupancy[]> {
    const rows: { locationId: string; locationName: string; count: string }[] =
      await this.accessLogsRepository.query(
        `SELECT log.location_id AS "locationId",
                location.name AS "locationName",
                COUNT(DISTINCT log.personnel_id)::int AS count
         FROM access_logs log
         INNER JOIN locations location ON location.id = log.location_id
         WHERE log.personnel_id IS NOT NULL
           AND date_trunc('day', log.event_time AT TIME ZONE $1)
             = date_trunc('day', NOW() AT TIME ZONE $1)
           AND log.event_time = (
             SELECT MAX(sub.event_time) FROM access_logs sub
             WHERE sub.personnel_id = log.personnel_id
               AND date_trunc('day', sub.event_time AT TIME ZONE $1)
                 = date_trunc('day', NOW() AT TIME ZONE $1)
           )
         GROUP BY log.location_id, location.name`,
        [DAY_TZ],
      );

    return rows.map((row) => ({
      locationId: row.locationId,
      locationName: row.locationName,
      count: typeof row.count === 'number' ? row.count : parseInt(row.count, 10),
    }));
  }
}
