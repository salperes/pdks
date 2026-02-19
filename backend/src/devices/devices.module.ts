import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device, AccessLog } from '../entities';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { PersonnelModule } from '../personnel/personnel.module';

@Module({
  imports: [TypeOrmModule.forFeature([Device, AccessLog]), PersonnelModule],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
