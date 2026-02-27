import {
  Controller,
  Get,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll() {
    return this.notificationsService.getAll();
  }

  @Get('count')
  getCount() {
    return { count: this.notificationsService.getUnreadCount() };
  }

  @Post('mark-read')
  @HttpCode(HttpStatus.OK)
  markRead() {
    this.notificationsService.markAllRead();
    return { ok: true };
  }
}
