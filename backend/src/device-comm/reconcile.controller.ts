import { Controller, Post, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { Device } from '../entities';
import { ReconcileService } from './reconcile.service';

@Controller('device-comm/reconcile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ReconcileController {
  constructor(
    private readonly reconcileService: ReconcileService,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
  ) {}

  /** Tüm aktif cihazları reconcile et. */
  @Post()
  async reconcileAll() {
    return this.reconcileService.reconcileAll();
  }

  /** Tek cihazı reconcile et. */
  @Post(':deviceId')
  async reconcileOne(@Param('deviceId') deviceId: string) {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Cihaz bulunamadı');
    return this.reconcileService.reconcileDevice(device);
  }
}
