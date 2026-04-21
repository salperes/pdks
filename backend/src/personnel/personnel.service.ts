import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Personnel, AccessLog } from '../entities';
import { SettingsService } from '../settings/settings.service';
import { CreatePersonnelDto } from './dto/create-personnel.dto';
import { UpdatePersonnelDto } from './dto/update-personnel.dto';

interface FindAllOptions {
  search?: string;
  department?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
  noCard?: boolean;
  duplicateCards?: boolean;
  activeOnly?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class PersonnelService {
  constructor(
    @InjectRepository(Personnel)
    private readonly personnelRepository: Repository<Personnel>,
    @InjectRepository(AccessLog)
    private readonly accessLogRepository: Repository<AccessLog>,
    private readonly settingsService: SettingsService,
  ) {}

  async findAll(options: FindAllOptions = {}): Promise<PaginatedResult<any>> {
    const { search, department, page = 1, limit = 20, sortBy, sortDir = 'DESC', noCard, duplicateCards, activeOnly } = options;

    const qb = this.personnelRepository.createQueryBuilder('p');

    if (search) {
      qb.andWhere(
        '(LOWER(p.firstName) LIKE LOWER(:search) OR LOWER(p.lastName) LIKE LOWER(:search) OR LOWER(p.cardNumber) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    if (department) {
      qb.andWhere('LOWER(p.department) LIKE LOWER(:department)', {
        department: `%${department}%`,
      });
    }

    if (activeOnly) {
      qb.andWhere('p.isActive = :active', { active: true });
    }

    if (noCard) {
      qb.andWhere('(p.cardNumber IS NULL OR p.cardNumber = :empty)', { empty: '' });
    }

    if (duplicateCards) {
      qb.andWhere(
        `p.cardNumber IN (
          SELECT card_number FROM personnel
          WHERE card_number IS NOT NULL AND card_number != ''
          GROUP BY card_number HAVING COUNT(*) > 1
        )`,
      );
    }

    const allowedSort: Record<string, string> = {
      firstName: 'p.firstName',
      lastName: 'p.lastName',
      cardNumber: 'p.cardNumber',
      department: 'p.department',
      isActive: 'p.isActive',
      createdAt: 'p.createdAt',
      username: 'p.username',
    };
    const orderDir = sortDir === 'ASC' ? 'ASC' : 'DESC';

    if (sortBy === 'lastAccessTime') {
      qb.orderBy(
        `(SELECT MAX(event_time) FROM access_logs WHERE personnel_id = p.id)`,
        orderDir,
      );
    } else {
      const orderField = allowedSort[sortBy ?? ''] ?? 'p.createdAt';
      qb.orderBy(orderField, orderDir);
    }

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    // Son giriş bilgisi ekle
    if (data.length > 0) {
      const ids = data.map((p) => p.id);
      const lastAccesses: {
        personnelId: string;
        lastAccessTime: string;
        lastDirection: string;
      }[] = await this.accessLogRepository.query(
        `WITH last_log AS (
           SELECT DISTINCT ON (personnel_id)
             personnel_id, event_time
           FROM access_logs
           WHERE personnel_id = ANY($1)
           ORDER BY personnel_id, event_time DESC
         ),
         last_day AS (
           SELECT ll.personnel_id, ll.event_time,
                  MIN(sub.event_time) AS min_t,
                  MAX(sub.event_time) AS max_t,
                  COUNT(*) AS cnt
           FROM last_log ll
           JOIN access_logs sub ON sub.personnel_id = ll.personnel_id
             AND date_trunc('day', sub.event_time AT TIME ZONE 'Europe/Istanbul')
               = date_trunc('day', ll.event_time AT TIME ZONE 'Europe/Istanbul')
           GROUP BY ll.personnel_id, ll.event_time
         )
         SELECT personnel_id AS "personnelId",
                event_time AS "lastAccessTime",
                CASE
                  WHEN cnt = 1 THEN 'in'
                  WHEN event_time = min_t THEN 'in'
                  WHEN event_time = max_t THEN 'out'
                  ELSE 'transit'
                END AS "lastDirection"
         FROM last_day`,
        [ids],
      );

      const accessMap = new Map(
        lastAccesses.map((r) => [r.personnelId, r]),
      );

      for (const p of data) {
        const access = accessMap.get(p.id);
        (p as any).lastAccessTime = access?.lastAccessTime || null;
        (p as any).lastDirection = access?.lastDirection || null;
      }
    }

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<Personnel> {
    const personnel = await this.personnelRepository.findOneBy({ id });
    if (!personnel) {
      throw new NotFoundException(`Personnel with id "${id}" not found`);
    }
    return personnel;
  }

  async findByCardNumber(cardNumber: string): Promise<Personnel | null> {
    return this.personnelRepository.findOneBy({ cardNumber });
  }

  async nextEmployeeId(): Promise<string> {
    const result = await this.personnelRepository.query(
      `SELECT COALESCE(MAX(CAST(employee_id AS INTEGER)), 0) AS max_id
       FROM personnel
       WHERE employee_id ~ '^[0-9]+$'
         AND CAST(employee_id AS INTEGER) BETWEEN 1 AND 99999`,
    );
    const next = (parseInt(result[0]?.max_id ?? '0') || 0) + 1;
    if (next > 99999) throw new ConflictException('employeeId havuzu doldu (max 99999)');
    return String(next);
  }

  async create(dto: CreatePersonnelDto): Promise<Personnel> {
    if (dto.cardNumber) {
      const existing = await this.personnelRepository.findOneBy({
        cardNumber: dto.cardNumber,
      });
      if (existing) {
        throw new ConflictException(
          `"${dto.cardNumber}" kart numarası zaten kayıtlı`,
        );
      }
    }

    const personnel = this.personnelRepository.create(dto);
    if (!personnel.employeeId) {
      personnel.employeeId = await this.nextEmployeeId();
    }
    return this.personnelRepository.save(personnel);
  }

  async update(id: string, dto: UpdatePersonnelDto): Promise<Personnel> {
    const personnel = await this.findById(id);
    Object.assign(personnel, dto);
    try {
      return await this.personnelRepository.save(personnel);
    } catch (err: any) {
      if (err?.code === '23505' && err?.detail?.includes('card_number')) {
        throw new ConflictException('Bu kart numarası başka bir personele atanmış.');
      }
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    const personnel = await this.findById(id);
    await this.personnelRepository.remove(personnel);
  }

  async updatePhoto(id: string, photoUrl: string | null): Promise<Personnel> {
    const personnel = await this.findById(id);
    personnel.photoUrl = photoUrl;
    return this.personnelRepository.save(personnel);
  }

  async deleteBulk(ids: string[]): Promise<{ deleted: number }> {
    if (!ids || ids.length === 0) return { deleted: 0 };
    const result = await this.personnelRepository
      .createQueryBuilder()
      .delete()
      .whereInIds(ids)
      .execute();
    return { deleted: result.affected || 0 };
  }

  async toggleActive(id: string): Promise<Personnel> {
    const personnel = await this.findById(id);
    personnel.isActive = !personnel.isActive;
    return this.personnelRepository.save(personnel);
  }

  async getStats(id: string) {
    const personnel = await this.findById(id);
    const settings = await this.settingsService.getSettings();
    const offset = settings.timezoneOffset;

    // Yerel zaman hesaplama
    const now = new Date();
    const localMs = now.getTime() + offset * 3600000;
    const localDate = new Date(localMs);
    const year = localDate.getUTCFullYear();
    const month = localDate.getUTCMonth(); // 0-indexed

    // Bu ayın UTC aralığı
    const sign = offset >= 0 ? '+' : '-';
    const absH = String(Math.abs(offset)).padStart(2, '0');
    const tz = `${sign}${absH}:00`;
    const monthStart = new Date(
      `${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00${tz}`,
    );
    const nextMonth =
      month === 11
        ? new Date(`${year + 1}-01-01T00:00:00${tz}`)
        : new Date(
            `${year}-${String(month + 2).padStart(2, '0')}-01T00:00:00${tz}`,
          );

    // Son 10 geçiş (direction = türev)
    const recentLogs: Array<{
      id: string;
      eventTime: Date;
      direction: string | null;
      device: { name: string } | null;
      location: { name: string } | null;
    }> = (
      await this.accessLogRepository.query(
        `SELECT al.id, al.event_time AS "eventTime",
                CASE
                  WHEN al.event_time = (
                    SELECT MIN(sub.event_time) FROM access_logs sub
                    WHERE sub.personnel_id = al.personnel_id
                      AND date_trunc('day', sub.event_time AT TIME ZONE 'Europe/Istanbul')
                        = date_trunc('day', al.event_time AT TIME ZONE 'Europe/Istanbul')
                  ) THEN 'in'
                  WHEN al.event_time = (
                    SELECT MAX(sub.event_time) FROM access_logs sub
                    WHERE sub.personnel_id = al.personnel_id
                      AND date_trunc('day', sub.event_time AT TIME ZONE 'Europe/Istanbul')
                        = date_trunc('day', al.event_time AT TIME ZONE 'Europe/Istanbul')
                  ) THEN 'out'
                  ELSE 'transit'
                END AS direction,
                d.name AS "deviceName",
                l.name AS "locationName"
         FROM access_logs al
         LEFT JOIN devices d ON d.id = al.device_id
         LEFT JOIN locations l ON l.id = al.location_id
         WHERE al.personnel_id = $1
         ORDER BY al.event_time DESC
         LIMIT 10`,
        [id],
      )
    ).map((r: any) => ({
      id: r.id,
      eventTime: r.eventTime,
      direction: r.direction,
      device: r.deviceName ? { name: r.deviceName } : null,
      location: r.locationName ? { name: r.locationName } : null,
    }));

    // Bu ay kaç gün geldi
    const daysPresent: { day: string }[] =
      await this.accessLogRepository.query(
        `SELECT DISTINCT DATE(event_time + INTERVAL '${offset} hours') AS day
         FROM access_logs
         WHERE personnel_id = $1
           AND event_time >= $2
           AND event_time < $3`,
        [id, monthStart, nextMonth],
      );

    // Toplam geçiş sayısı
    const totalEntries = await this.accessLogRepository.count({
      where: { personnelId: id },
    });

    return {
      personnel: {
        id: personnel.id,
        firstName: personnel.firstName,
        lastName: personnel.lastName,
        cardNumber: personnel.cardNumber,
        department: personnel.department,
        title: personnel.title,
        employeeId: personnel.employeeId,
        isActive: personnel.isActive,
      },
      recentLogs: recentLogs.map((l) => ({
        id: l.id,
        eventTime: l.eventTime,
        direction: l.direction,
        deviceName: l.device?.name,
        locationName: l.location?.name,
      })),
      monthlyStats: {
        year,
        month: month + 1,
        daysPresent: daysPresent.length,
        totalEntries,
      },
    };
  }

  async exportCsv(): Promise<string> {
    const all = await this.personnelRepository.find({
      select: ['firstName', 'lastName', 'cardNumber', 'username', 'department', 'isActive'],
      order: { firstName: 'ASC', lastName: 'ASC' },
    });

    const esc = (v: string | null | undefined) => {
      if (v == null) return '';
      const s = String(v);
      return s.includes(';') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const header = 'Ad;Soyad;KartNo;KullaniciAdi;Departman;Aktif';
    const rows = all.map((p) =>
      [esc(p.firstName), esc(p.lastName), esc(p.cardNumber), esc(p.username), esc(p.department), p.isActive ? 'Aktif' : 'Pasif'].join(';'),
    );
    return [header, ...rows].join('\r\n');
  }

  async importBulk(
    records: CreatePersonnelDto[],
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      if (!rec.firstName || !rec.lastName || !rec.cardNumber) {
        errors.push(`Satır ${i + 1}: Ad, Soyad ve Kart No zorunludur`);
        continue;
      }

      try {
        const existing = await this.personnelRepository.findOneBy({
          cardNumber: rec.cardNumber,
        });
        if (existing) {
          skipped++;
          continue;
        }

        const personnel = this.personnelRepository.create(rec);
        if (!personnel.employeeId) {
          personnel.employeeId = await this.nextEmployeeId();
        }
        await this.personnelRepository.save(personnel);
        created++;
      } catch (err: any) {
        errors.push(`Satır ${i + 1}: ${err.message}`);
      }
    }

    return { created, skipped, errors };
  }
}
