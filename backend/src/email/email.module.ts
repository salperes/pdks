import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemSettings, EmailLog, Personnel, AccessLog, Holiday } from '../entities';
import { SettingsModule } from '../settings/settings.module';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemSettings, EmailLog, Personnel, AccessLog, Holiday]),
    SettingsModule,
  ],
  controllers: [EmailController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
