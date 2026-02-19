import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  SystemSettings,
  Holiday,
  Personnel,
  Device,
  Location,
  AccessLog,
} from '../entities';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemSettings,
      Holiday,
      Personnel,
      Device,
      Location,
      AccessLog,
    ]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
