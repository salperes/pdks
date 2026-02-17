import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessLog } from '../entities';
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
  constructor(
    @InjectRepository(AccessLog)
    private readonly accessLogsRepository: Repository<AccessLog>,
  ) {}

  async findAll(query: QueryAccessLogsDto): Promise<PaginatedResult<AccessLog>> {
    const {
      personnelId,
      deviceId,
      locationId,
      startDate,
      endDate,
      direction,
      page = 1,
      limit = 50,
    } = query;

    const qb = this.accessLogsRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.personnel', 'personnel')
      .leftJoinAndSelect('log.device', 'device')
      .leftJoinAndSelect('log.location', 'location');

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
    return this.accessLogsRepository.save(log);
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
