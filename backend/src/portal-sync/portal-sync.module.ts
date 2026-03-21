import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Personnel, SystemSettings } from '../entities';
import { PortalSyncService } from './portal-sync.service';
import { PortalSyncController } from './portal-sync.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Personnel, SystemSettings])],
  controllers: [PortalSyncController],
  providers: [PortalSyncService],
  exports: [PortalSyncService],
})
export class PortalSyncModule {}
