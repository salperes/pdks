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
    const { search, department, page = 1, limit = 20 } = options;

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

    qb.orderBy('p.createdAt', 'DESC');
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
        `SELECT DISTINCT ON (personnel_id)
           personnel_id AS "personnelId",
           event_time AS "lastAccessTime",
           direction AS "lastDirection"
         FROM access_logs
         WHERE personnel_id = ANY($1)
         ORDER BY personnel_id, event_time DESC`,
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

  async create(dto: CreatePersonnelDto): Promise<Personnel> {
    const existing = await this.personnelRepository.findOneBy({
      cardNumber: dto.cardNumber,
    });
    if (existing) {
      throw new ConflictException(
        `"${dto.cardNumber}" kart numarası zaten kayıtlı`,
      );
    }

    const personnel = this.personnelRepository.create(dto);
    return this.personnelRepository.save(personnel);
  }

  async update(id: string, dto: UpdatePersonnelDto): Promise<Personnel> {
    const personnel = await this.findById(id);
    Object.assign(personnel, dto);
    return this.personnelRepository.save(personnel);
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

    // Son 10 geçiş
    const recentLogs = await this.accessLogRepository.find({
      where: { personnelId: id },
      order: { eventTime: 'DESC' },
      take: 10,
      relations: ['device', 'location'],
    });

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
        await this.personnelRepository.save(personnel);
        created++;
      } catch (err: any) {
        errors.push(`Satır ${i + 1}: ${err.message}`);
      }
    }

    return { created, skipped, errors };
  }
}
