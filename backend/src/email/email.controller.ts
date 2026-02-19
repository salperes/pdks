import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../entities';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { EmailService } from './email.service';

@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('test-connection')
  @Roles(UserRole.ADMIN)
  testConnection() {
    return this.emailService.testConnection();
  }

  @Post('send-test')
  @Roles(UserRole.ADMIN)
  sendTestEmail(@Body() body: { email: string }) {
    return this.emailService.sendTestEmail(body.email);
  }

  @Get('logs')
  @Roles(UserRole.ADMIN)
  getEmailLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.emailService.getEmailLogs(
      Number(page) || 1,
      Number(limit) || 20,
    );
  }
}
