import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device, AccessLog, Personnel, SyncHistory } from '../entities';
import { ZktecoClientService } from './zkteco-client.service';
import { DeviceManagerService } from './device-manager.service';
import { SyncService } from './sync.service';
import { EmailModule } from '../email/email.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Device, AccessLog, Personnel, SyncHistory]),
    EmailModule,
  ],
  providers: [ZktecoClientService, DeviceManagerService, SyncService],
  exports: [ZktecoClientService, DeviceManagerService, SyncService],
})
export class DeviceCommModule {}
