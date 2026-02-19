import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../entities';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private readonly locationsRepository: Repository<Location>,
  ) {}

  async findAll(): Promise<(Location & { deviceCount: number })[]> {
    const locations = await this.locationsRepository
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.workSchedule', 'ws')
      .loadRelationCountAndMap('l.deviceCount', 'l.devices')
      .orderBy('l.name', 'ASC')
      .getMany();

    return locations as (Location & { deviceCount: number })[];
  }

  async findById(id: string): Promise<Location> {
    const location = await this.locationsRepository.findOne({
      where: { id },
      relations: ['devices'],
    });
    if (!location) {
      throw new NotFoundException(`Location with id "${id}" not found`);
    }
    return location;
  }

  async create(dto: CreateLocationDto): Promise<Location> {
    const location = this.locationsRepository.create(dto);
    return this.locationsRepository.save(location);
  }

  async update(id: string, dto: UpdateLocationDto): Promise<Location> {
    const location = await this.findById(id);
    Object.assign(location, dto);
    return this.locationsRepository.save(location);
  }

  async remove(id: string): Promise<void> {
    const location = await this.findById(id);
    await this.locationsRepository.remove(location);
  }
}
