import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Personnel } from '../entities';
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
  ) {}

  async findAll(options: FindAllOptions = {}): Promise<PaginatedResult<Personnel>> {
    const { search, department, page = 1, limit = 20 } = options;

    const qb = this.personnelRepository.createQueryBuilder('p');

    if (search) {
      qb.andWhere(
        '(LOWER(p.firstName) LIKE LOWER(:search) OR LOWER(p.lastName) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    if (department) {
      qb.andWhere('p.department = :department', { department });
    }

    qb.orderBy('p.createdAt', 'DESC');
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
        `Personnel with card number "${dto.cardNumber}" already exists`,
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
}
