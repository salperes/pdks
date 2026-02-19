import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Personnel, Device, AccessLog } from '../entities';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Personnel)
    private readonly personnelRepo: Repository<Personnel>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(AccessLog)
    private readonly accessLogRepo: Repository<AccessLog>,
    private readonly settingsService: SettingsService,
  ) {}

  /** Local midnight → UTC Date */
  private todayStartUtc(offsetHours: number): Date {
    const now = new Date();
    const localMs = now.getTime() + offsetHours * 3600000;
    const localDate = new Date(localMs);
    const yyyy = localDate.getUTCFullYear();
    const mm = String(localDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(localDate.getUTCDate()).padStart(2, '0');
    return new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
  }

  async getSummary() {
    const settings = await this.settingsService.getSettings();
    const offset = settings.timezoneOffset;
    const todayUtc = this.todayStartUtc(offset);
    // tomorrow UTC = todayUtc + 24h  (fence for queries)
    const tomorrowUtc = new Date(todayUtc.getTime() + 86400000);

    const [totalPersonnel, devicesTotal, devicesOnline, todayArrived, currentlyInside] =
      await Promise.all([
        this.personnelRepo.count({ where: { isActive: true } }),
        this.deviceRepo.count({ where: { isActive: true } }),
        this.deviceRepo.count({ where: { isActive: true, isOnline: true } }),

        // Bugün giriş yapan benzersiz personel
        this.accessLogRepo
          .createQueryBuilder('log')
          .select('COUNT(DISTINCT log.personnelId)')
          .where('log.eventTime >= :start', { start: todayUtc })
          .andWhere('log.eventTime < :end', { end: tomorrowUtc })
          .andWhere('log.direction = :dir', { dir: 'in' })
          .andWhere('log.personnelId IS NOT NULL')
          .getRawOne()
          .then((r) => parseInt(r?.count || '0', 10)),

        // İçeride olan: son kaydı "in" olan personel sayısı
        this.accessLogRepo
          .createQueryBuilder('log')
          .select('COUNT(*)')
          .from((qb) => {
            return qb
              .select('DISTINCT ON (sub.personnelId) sub.direction', 'dir')
              .from(AccessLog, 'sub')
              .where('sub.eventTime >= :start', { start: todayUtc })
              .andWhere('sub.eventTime < :end', { end: tomorrowUtc })
              .andWhere('sub.personnelId IS NOT NULL')
              .orderBy('sub.personnelId')
              .addOrderBy('sub.eventTime', 'DESC');
          }, 'latest')
          .where('latest.dir = :dir', { dir: 'in' })
          .getRawOne()
          .then((r) => parseInt(r?.count || '0', 10)),
      ]);

    return {
      totalPersonnel,
      todayArrived,
      currentlyInside,
      devicesOnline,
      devicesTotal,
    };
  }

  async getHourlyStats() {
    const settings = await this.settingsService.getSettings();
    const offset = settings.timezoneOffset;
    const todayUtc = this.todayStartUtc(offset);
    const tomorrowUtc = new Date(todayUtc.getTime() + 86400000);

    const sign = offset >= 0 ? '+' : '-';
    const absH = Math.abs(offset);
    const intervalStr = `${sign}${absH} hours`;

    const rows: { hour: string; direction: string; cnt: string }[] =
      await this.accessLogRepo.query(
        `SELECT
           EXTRACT(HOUR FROM event_time + INTERVAL '${intervalStr}')::int AS hour,
           direction,
           COUNT(*)::int AS cnt
         FROM access_logs
         WHERE event_time >= $1
           AND event_time < $2
           AND direction IS NOT NULL
         GROUP BY 1, 2
         ORDER BY 1`,
        [todayUtc, tomorrowUtc],
      );

    // 0-23 saat dizisi
    const hours: { hour: number; in: number; out: number }[] = [];
    for (let h = 0; h < 24; h++) {
      hours.push({ hour: h, in: 0, out: 0 });
    }
    for (const r of rows) {
      const h = parseInt(r.hour, 10);
      if (h >= 0 && h < 24) {
        if (r.direction === 'in') hours[h].in = parseInt(r.cnt, 10);
        else if (r.direction === 'out') hours[h].out = parseInt(r.cnt, 10);
      }
    }

    return hours;
  }
}
