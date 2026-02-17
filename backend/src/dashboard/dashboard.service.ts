import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Personnel, Device, AccessLog } from '../entities';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Personnel)
    private readonly personnelRepo: Repository<Personnel>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(AccessLog)
    private readonly accessLogRepo: Repository<AccessLog>,
  ) {}

  async getSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalPersonnel, devicesTotal, devicesOnline, todayArrived] =
      await Promise.all([
        this.personnelRepo.count({ where: { isActive: true } }),
        this.deviceRepo.count({ where: { isActive: true } }),
        this.deviceRepo.count({ where: { isActive: true, isOnline: true } }),
        this.accessLogRepo
          .createQueryBuilder('log')
          .select('COUNT(DISTINCT log.personnelId)')
          .where('log.eventTime >= :today', { today })
          .andWhere('log.direction = :dir', { dir: 'in' })
          .andWhere('log.personnelId IS NOT NULL')
          .getRawOne()
          .then((r) => parseInt(r?.count || '0', 10)),
      ]);

    return {
      totalPersonnel,
      todayArrived,
      currentlyInside: 0,
      devicesOnline,
      devicesTotal,
    };
  }
}
