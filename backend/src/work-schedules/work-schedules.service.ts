import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkSchedule } from '../entities/work-schedule.entity';
import { Location } from '../entities/location.entity';
import { CreateWorkScheduleDto, UpdateWorkScheduleDto } from './dto/create-work-schedule.dto';

@Injectable()
export class WorkSchedulesService {
  constructor(
    @InjectRepository(WorkSchedule)
    private readonly repo: Repository<WorkSchedule>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
  ) {}

  async findAll(): Promise<(WorkSchedule & { locationCount: number })[]> {
    const schedules = await this.repo.find({ order: { name: 'ASC' } });
    const counts = await this.locationRepo
      .createQueryBuilder('loc')
      .select('loc.work_schedule_id', 'wsId')
      .addSelect('COUNT(*)', 'cnt')
      .where('loc.work_schedule_id IS NOT NULL')
      .groupBy('loc.work_schedule_id')
      .getRawMany();

    const countMap = new Map<string, number>();
    for (const row of counts) {
      countMap.set(row.wsId, Number(row.cnt));
    }

    return schedules.map((s) => ({
      ...s,
      locationCount: countMap.get(s.id) || 0,
    }));
  }

  async findOne(id: string): Promise<WorkSchedule | null> {
    return this.repo.findOneBy({ id });
  }

  async create(dto: CreateWorkScheduleDto): Promise<WorkSchedule> {
    const existing = await this.repo.findOneBy({ name: dto.name });
    if (existing) {
      throw new ConflictException(`"${dto.name}" adında bir mesai programı zaten var`);
    }
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateWorkScheduleDto): Promise<WorkSchedule> {
    const entity = await this.repo.findOneBy({ id });
    if (!entity) {
      throw new BadRequestException('Mesai programı bulunamadı');
    }
    if (dto.name && dto.name !== entity.name) {
      const dup = await this.repo.findOneBy({ name: dto.name });
      if (dup) {
        throw new ConflictException(`"${dto.name}" adında bir mesai programı zaten var`);
      }
    }
    Object.assign(entity, dto);
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    const count = await this.locationRepo.count({ where: { workScheduleId: id } });
    if (count > 0) {
      throw new BadRequestException(
        `Bu mesai programı ${count} lokasyona atanmış. Önce lokasyonlardan kaldırın.`,
      );
    }
    await this.repo.delete(id);
  }
}
