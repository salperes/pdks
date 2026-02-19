import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonnelDevice, Personnel, Device, Location } from '../entities';
import { SupervisorService } from './supervisor.service';
import { SupervisorController } from './supervisor.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PersonnelDevice, Personnel, Device, Location])],
  controllers: [SupervisorController],
  providers: [SupervisorService],
  exports: [SupervisorService],
})
export class SupervisorModule {}
