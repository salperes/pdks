import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Personnel, AccessLog, Device } from '../entities';
import { SettingsModule } from '../settings/settings.module';
import { PersonnelService } from './personnel.service';
import { PersonnelController } from './personnel.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Personnel, AccessLog, Device]),
    SettingsModule,
  ],
  controllers: [PersonnelController],
  providers: [PersonnelService],
  exports: [PersonnelService],
})
export class PersonnelModule {}
