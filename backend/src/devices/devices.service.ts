import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../entities';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly devicesRepository: Repository<Device>,
  ) {}

  async findAll(): Promise<Device[]> {
    return this.devicesRepository.find({
      relations: ['location'],
      order: { name: 'ASC' },
    });
  }

  async findAllActive(): Promise<Device[]> {
    return this.devicesRepository.find({
      where: { isActive: true },
      relations: ['location'],
      order: { name: 'ASC' },
    });
  }

  async findById(id: string): Promise<Device> {
    const device = await this.devicesRepository.findOne({
      where: { id },
      relations: ['location'],
    });
    if (!device) {
      throw new NotFoundException(`Device with id "${id}" not found`);
    }
    return device;
  }

  async create(dto: CreateDeviceDto): Promise<Device> {
    const device = this.devicesRepository.create(dto);
    return this.devicesRepository.save(device);
  }

  async update(id: string, dto: UpdateDeviceDto): Promise<Device> {
    const device = await this.findById(id);
    Object.assign(device, dto);
    return this.devicesRepository.save(device);
  }

  async updateOnlineStatus(id: string, isOnline: boolean): Promise<void> {
    const updateData: Partial<Device> = { isOnline };
    if (isOnline) {
      updateData.lastOnlineAt = new Date();
    }
    await this.devicesRepository.update(id, updateData);
  }

  async remove(id: string): Promise<void> {
    const device = await this.findById(id);
    await this.devicesRepository.remove(device);
  }
}
