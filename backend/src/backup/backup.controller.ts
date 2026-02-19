import {
  Controller,
  Get,
  Post,
  Param,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '../entities';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators';
import { AuditLogService } from '../audit-log/audit-log.service';
import { BackupService } from './backup.service';
import type { AuthUser } from '../auth/interfaces';

@Controller('backup')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  async trigger(@CurrentUser() me: AuthUser) {
    const result = await this.backupService.performBackup();
    this.auditLogService.log({
      action: 'BACKUP',
      userId: me.id,
      username: me.username,
      targetEntity: 'System',
      details: { filename: result.filename, status: result.status },
    });
    return result;
  }

  @Get('history')
  async getHistory() {
    return this.backupService.getHistory();
  }

  @Get('download/:filename')
  async download(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const filepath = this.backupService.getBackupPath(filename);
    if (!filepath) {
      throw new NotFoundException('Yedek dosyası bulunamadı');
    }
    res.download(filepath, filename);
  }
}
