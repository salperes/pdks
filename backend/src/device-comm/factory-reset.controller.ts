import { Controller, Post, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { Device } from '../entities';
import { ReconcileService } from './reconcile.service';

/**
 * Cihaz sıfırlama uç noktası — destructive operasyon.
 * Cihazdaki tüm user kayıtları + geçiş logları silinir, PDKS'teki atamalar
 * tek seferde push edilir. Sadece admin kullanıcı erişebilir.
 */
@Controller('device-comm/factory-reset')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class FactoryResetController {
  constructor(
    private readonly reconcileService: ReconcileService,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
  ) {}

  @Post(':deviceId')
  async factoryReset(@Param('deviceId') deviceId: string) {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Cihaz bulunamadı');
    return this.reconcileService.factoryResetAndReload(device);
  }
}
