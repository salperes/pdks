import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Personnel, Device, AccessLog } from '../entities';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([Personnel, Device, AccessLog])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
