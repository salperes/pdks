import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessLog, Personnel } from '../entities';
import { SettingsModule } from '../settings/settings.module';
import { AccessLogsService } from './access-logs.service';
import { AccessLogsController } from './access-logs.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccessLog, Personnel]),
    SettingsModule,
  ],
  controllers: [AccessLogsController],
  providers: [AccessLogsService],
  exports: [AccessLogsService],
})
export class AccessLogsModule {}
