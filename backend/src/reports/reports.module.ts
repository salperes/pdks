import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessLog, Personnel } from '../entities';
import { SettingsModule } from '../settings/settings.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AccessLog, Personnel]), SettingsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
