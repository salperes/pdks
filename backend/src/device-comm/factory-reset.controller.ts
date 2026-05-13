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
 *   - POST /factory-reset/:deviceId       → sıfırla + PDKS'ten re-push
 *   - POST /factory-reset/:deviceId/wipe  → yalnız sıfırla (cihazı boş bırak)
 * Sadece admin kullanıcı erişebilir.
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

  /** Sıfırla + PDKS'ten re-push */
  @Post(':deviceId')
  async factoryResetAndReload(@Param('deviceId') deviceId: string) {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Cihaz bulunamadı');
    return this.reconcileService.factoryReset(device, { reload: true });
  }

  /** Yalnız sıfırla — kullanıcı/log silinir, push yapılmaz */
  @Post(':deviceId/wipe')
  async wipeOnly(@Param('deviceId') deviceId: string) {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Cihaz bulunamadı');
    return this.reconcileService.factoryReset(device, { reload: false });
  }
}
