import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device, AccessLog, Personnel, SyncHistory, SystemSettings, PersonnelDevice } from '../entities';
import { ZktecoClientService } from './zkteco-client.service';
import { DeviceManagerService } from './device-manager.service';
import { SyncService } from './sync.service';
import { ReconcileService } from './reconcile.service';
import { ReconcileController } from './reconcile.controller';
import { EmailModule } from '../email/email.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Device, AccessLog, Personnel, SyncHistory, SystemSettings, PersonnelDevice]),
    EmailModule,
  ],
  controllers: [ReconcileController],
  providers: [ZktecoClientService, DeviceManagerService, SyncService, ReconcileService],
  exports: [ZktecoClientService, DeviceManagerService, SyncService, ReconcileService],
})
export class DeviceCommModule {}
