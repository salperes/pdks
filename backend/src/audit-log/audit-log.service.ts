import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities';

interface LogParams {
  action: string;
  userId?: string;
  username?: string;
  targetEntity: string;
  targetId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(params: LogParams): Promise<void> {
    const entry = new AuditLog();
    entry.action = params.action;
    entry.userId = params.userId || null;
    entry.username = params.username || '';
    entry.targetEntity = params.targetEntity;
    entry.targetId = params.targetId || null;
    entry.details = params.details || null;
    entry.ipAddress = params.ipAddress || null;
    await this.auditLogRepository.save(entry);
  }

  async findAll(query: { page?: number; limit?: number; action?: string; userId?: string }) {
    const { page = 1, limit = 50, action, userId } = query;

    const qb = this.auditLogRepository
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC');

    if (action) {
      qb.andWhere('log.action = :action', { action });
    }
    if (userId) {
      qb.andWhere('log.userId = :userId', { userId });
    }

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

  async findForExport(query: { action?: string; userId?: string }) {
    const { action, userId } = query;

    const qb = this.auditLogRepository
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC');

    if (action) {
      qb.andWhere('log.action = :action', { action });
    }
    if (userId) {
      qb.andWhere('log.userId = :userId', { userId });
    }

    qb.take(10000);
    return qb.getMany();
  }
}
