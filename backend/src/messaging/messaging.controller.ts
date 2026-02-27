import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '../entities';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { MessagingService } from './messaging.service';

@ApiTags('Messaging')
@Controller('messaging')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post('test-connection')
  @Roles(UserRole.ADMIN)
  async testConnection() {
    return this.messagingService.healthCheck();
  }

  @Post('test-email')
  @Roles(UserRole.ADMIN)
  async testEmail(@Body() data: { email: string }) {
    return this.messagingService.sendEmail({
      to: [data.email],
      subject: 'PDKS — Mesajlaşma Servisi Test',
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#0078d4;">PDKS Mesajlaşma Testi</h2>
        <p>Bu bir test e-postasıdır. msgService bağlantısı başarıyla çalışıyor.</p>
        <p style="color:#666;font-size:12px;">Gönderim: ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</p>
      </div>`,
    });
  }

  @Post('test-whatsapp')
  @Roles(UserRole.ADMIN)
  async testWhatsApp(@Body() data: { phone: string }) {
    return this.messagingService.sendWhatsApp({
      phone: data.phone,
      body: 'PDKS Mesajlaşma Testi — Bu bir test mesajıdır. msgService bağlantısı başarıyla çalışıyor.',
    });
  }
}
