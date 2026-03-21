import { Controller, Get, Post, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '../entities';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PortalSyncService } from './portal-sync.service';

@ApiTags('Portal Sync')
@Controller('portal-sync')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class PortalSyncController {
  constructor(private readonly portalSyncService: PortalSyncService) {}

  @Get('status')
  async getStatus() {
    return this.portalSyncService.getStatus();
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async testConnection() {
    return this.portalSyncService.testConnection();
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async syncNow() {
    return this.portalSyncService.syncNow();
  }
}
