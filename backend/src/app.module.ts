import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PersonnelModule } from './personnel/personnel.module';
import { LocationsModule } from './locations/locations.module';
import { DevicesModule } from './devices/devices.module';
import { AccessLogsModule } from './access-logs/access-logs.module';
import { DeviceCommModule } from './device-comm/device-comm.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { GatewayModule } from './gateway/gateway.module';
import { AdmsModule } from './adms/adms.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BackupModule } from './backup/backup.module';
import { SupervisorModule } from './supervisor/supervisor.module';
import { User, Personnel, Location, Device, AccessLog, SyncHistory, SystemSettings, Holiday, AuditLog, BackupHistory, PersonnelDevice } from './entities';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'pdks'),
        password: config.get('DB_PASSWORD', 'pdks123'),
        database: config.get('DB_DATABASE', 'pdks'),
        entities: [User, Personnel, Location, Device, AccessLog, SyncHistory, SystemSettings, Holiday, AuditLog, BackupHistory, PersonnelDevice],
        synchronize: true, // DEV only
      }),
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    PersonnelModule,
    LocationsModule,
    DevicesModule,
    AccessLogsModule,
    DashboardModule,
    ReportsModule,
    SettingsModule,
    DeviceCommModule,
    GatewayModule,
    AdmsModule,
    AuditLogModule,
    NotificationsModule,
    BackupModule,
    SupervisorModule,
  ],
})
export class AppModule {}
