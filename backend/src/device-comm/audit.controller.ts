import { Controller, Get, Post, Param, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { Device } from '../entities';
import { ReconcileService } from './reconcile.service';

@Controller('device-comm/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditController {
  constructor(
    private readonly reconcileService: ReconcileService,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
  ) {}

  /** Cihazdaki user listesini PDKS DB ile karşılaştır, 5 kategori dön. */
  @Get(':deviceId')
  async audit(@Param('deviceId') deviceId: string) {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Cihaz bulunamadı');
    return this.reconcileService.auditDevice(device);
  }

  /** Seçili uid'leri cihazdan sil. Audit modal'ından gelir. */
  @Post(':deviceId/delete-uids')
  async deleteUids(
    @Param('deviceId') deviceId: string,
    @Body() body: { uids: number[] },
  ) {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Cihaz bulunamadı');
    return this.reconcileService.deleteDeviceUids(device, body?.uids ?? []);
  }
}
