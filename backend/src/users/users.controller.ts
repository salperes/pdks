import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '../entities';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { AuthUser } from '../auth/interfaces';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  async create(@CurrentUser() me: AuthUser, @Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    this.auditLogService.log({
      action: 'CREATE',
      userId: me.id,
      username: me.username,
      targetEntity: 'User',
      targetId: user.id,
      details: { username: dto.username, role: dto.role },
    });
    return user;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  async update(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    const user = await this.usersService.update(id, dto);
    this.auditLogService.log({
      action: 'UPDATE',
      userId: me.id,
      username: me.username,
      targetEntity: 'User',
      targetId: id,
      details: { changes: Object.keys(dto) },
    });
    return user;
  }

  @Delete(':id')
  async remove(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    await this.usersService.remove(id);
    this.auditLogService.log({
      action: 'DELETE',
      userId: me.id,
      username: me.username,
      targetEntity: 'User',
      targetId: id,
    });
  }
}
