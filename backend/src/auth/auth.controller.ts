import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards';
import { AuthService } from './auth.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { LoginDto, RefreshTokenDto, ChangePasswordDto } from './dto';
import type { AuthResponse, AuthUser } from './interfaces';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<AuthResponse> {
    const result = await this.authService.login(dto.username, dto.password);
    this.auditLogService.log({
      action: 'LOGIN',
      userId: result.user.id,
      username: result.user.username,
      targetEntity: 'User',
      targetId: result.user.id,
    });
    return result;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponse> {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    this.auditLogService.log({
      action: 'CHANGE_PASSWORD',
      userId: user.id,
      username: user.username,
      targetEntity: 'User',
      targetId: user.id,
    });
    return { message: 'Şifre başarıyla değiştirildi' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
