import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../entities';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PersonnelService } from './personnel.service';
import { CreatePersonnelDto } from './dto/create-personnel.dto';
import { UpdatePersonnelDto } from './dto/update-personnel.dto';
import type { AuthUser } from '../auth/interfaces';

@Controller('personnel')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PersonnelController {
  constructor(
    private readonly personnelService: PersonnelService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('department') department?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.personnelService.findAll({
      search,
      department,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  async create(@CurrentUser() me: AuthUser, @Body() dto: CreatePersonnelDto) {
    const personnel = await this.personnelService.create(dto);
    this.auditLogService.log({
      action: 'CREATE',
      userId: me.id,
      username: me.username,
      targetEntity: 'Personnel',
      targetId: personnel.id,
      details: { firstName: dto.firstName, lastName: dto.lastName, cardNumber: dto.cardNumber },
    });
    return personnel;
  }

  @Post('import')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  async importBulk(@CurrentUser() me: AuthUser, @Body() body: { records: CreatePersonnelDto[] }) {
    const result = await this.personnelService.importBulk(body.records || []);
    this.auditLogService.log({
      action: 'IMPORT',
      userId: me.id,
      username: me.username,
      targetEntity: 'Personnel',
      details: { created: result.created, skipped: result.skipped },
    });
    return result;
  }

  @Delete('bulk')
  @Roles(UserRole.ADMIN)
  async deleteBulk(@CurrentUser() me: AuthUser, @Body() body: { ids: string[] }) {
    const ids = body.ids || [];
    const result = await this.personnelService.deleteBulk(ids);
    this.auditLogService.log({
      action: 'BULK_DELETE',
      userId: me.id,
      username: me.username,
      targetEntity: 'Personnel',
      details: { count: result.deleted, ids },
    });
    return result;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.personnelService.findById(id);
  }

  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.personnelService.getStats(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  async update(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: UpdatePersonnelDto) {
    const personnel = await this.personnelService.update(id, dto);
    this.auditLogService.log({
      action: 'UPDATE',
      userId: me.id,
      username: me.username,
      targetEntity: 'Personnel',
      targetId: id,
      details: { changes: Object.keys(dto) },
    });
    return personnel;
  }

  @Patch(':id/toggle-active')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  async toggleActive(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    const personnel = await this.personnelService.toggleActive(id);
    this.auditLogService.log({
      action: 'TOGGLE_ACTIVE',
      userId: me.id,
      username: me.username,
      targetEntity: 'Personnel',
      targetId: id,
      details: { isActive: personnel.isActive },
    });
    return personnel;
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  async remove(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    await this.personnelService.remove(id);
    this.auditLogService.log({
      action: 'DELETE',
      userId: me.id,
      username: me.username,
      targetEntity: 'Personnel',
      targetId: id,
    });
  }
}
