import {
  Controller,
  Get,
  Delete,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../entities';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AccessLogsService } from './access-logs.service';
import { QueryAccessLogsDto } from './dto/query-access-logs.dto';
import type { AuthUser } from '../auth/interfaces';

@Controller('access-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccessLogsController {
  constructor(
    private readonly accessLogsService: AccessLogsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  findAll(@Query() query: QueryAccessLogsDto) {
    return this.accessLogsService.findAll(query);
  }

  @Get('export')
  findForExport(@Query() query: QueryAccessLogsDto) {
    return this.accessLogsService.findForExport(query);
  }

  @Get('paired')
  findPaired(@Query('date') date: string) {
    const d = date || new Date().toISOString().split('T')[0];
    return this.accessLogsService.findPaired(d);
  }

  @Get('unknown')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  findUnknown(@Query() query: QueryAccessLogsDto) {
    return this.accessLogsService.findUnknown(query);
  }

  @Delete('bulk')
  @Roles(UserRole.ADMIN)
  async deleteBulk(@CurrentUser() me: AuthUser, @Body() body: { ids: string[] }) {
    const ids = body.ids || [];
    const result = await this.accessLogsService.deleteBulk(ids);
    this.auditLogService.log({
      action: 'BULK_DELETE',
      userId: me.id,
      username: me.username,
      targetEntity: 'AccessLog',
      details: { count: result.deleted },
    });
    return result;
  }
}
