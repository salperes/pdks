import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '../entities';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators';
import { AuditLogService } from '../audit-log/audit-log.service';
import { SettingsService } from './settings.service';
import type { AuthUser } from '../auth/interfaces';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /* ── Settings ─────────────────────── */

  @Get()
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  @Roles(UserRole.ADMIN)
  async updateSettings(
    @CurrentUser() me: AuthUser,
    @Body()
    data: {
      workStartTime?: string;
      workEndTime?: string;
      timezoneOffset?: number;
      syncInterval?: number;
      backupEnabled?: boolean;
      backupRetentionDays?: number;
      smtpHost?: string;
      smtpPort?: number;
      smtpSecurity?: string;
      smtpUsername?: string;
      smtpPassword?: string;
      smtpFromAddress?: string;
      smtpFromName?: string;
      emailEnabled?: boolean;
      notifyAbsenceEnabled?: boolean;
      notifyAbsenceRecipients?: string[];
      notifyAbsenceTime?: string;
      notifyAbsenceEmailEnabled?: boolean;
      notifyAbsenceWaEnabled?: boolean;
      notifyAbsenceWaRecipients?: string[];
      notifyHrEnabled?: boolean;
      notifyHrRecipients?: string[];
      notifyHrTime?: string;
      notifyHrEmailEnabled?: boolean;
      notifyHrWaEnabled?: boolean;
      notifyHrWaRecipients?: string[];
      notifySystemErrorEnabled?: boolean;
      notifySystemErrorRecipients?: string[];
      notifySystemErrorEmailEnabled?: boolean;
      notifySystemErrorWaEnabled?: boolean;
      notifySystemErrorWaRecipients?: string[];
      msgServiceUrl?: string;
      msgServiceApiKey?: string;
      msgServiceEnabled?: boolean;
    },
  ) {
    const result = await this.settingsService.updateSettings(data);
    this.auditLogService.log({
      action: 'SETTINGS_UPDATE',
      userId: me.id,
      username: me.username,
      targetEntity: 'Settings',
      details: { changes: Object.keys(data) },
    });
    return result;
  }

  /* ── Holidays ─────────────────────── */

  @Get('holidays')
  getHolidays() {
    return this.settingsService.getHolidays();
  }

  @Post('holidays')
  @Roles(UserRole.ADMIN)
  async addHoliday(@CurrentUser() me: AuthUser, @Body() data: { date: string; name: string }) {
    const holiday = await this.settingsService.addHoliday(data.date, data.name);
    this.auditLogService.log({
      action: 'CREATE',
      userId: me.id,
      username: me.username,
      targetEntity: 'Holiday',
      targetId: holiday.id,
      details: { date: data.date, name: data.name },
    });
    return holiday;
  }

  @Delete('holidays/:id')
  @Roles(UserRole.ADMIN)
  async deleteHoliday(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    await this.settingsService.deleteHoliday(id);
    this.auditLogService.log({
      action: 'DELETE',
      userId: me.id,
      username: me.username,
      targetEntity: 'Holiday',
      targetId: id,
    });
  }

  /* ── System Info & Backup ─────────── */

  @Get('system-info')
  getSystemInfo() {
    return this.settingsService.getSystemInfo();
  }

  @Get('backup')
  @Roles(UserRole.ADMIN)
  getBackup() {
    return this.settingsService.getBackupData();
  }
}
