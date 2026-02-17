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
import { GatewayModule } from './gateway/gateway.module';
import { AdmsModule } from './adms/adms.module';
import { User, Personnel, Location, Device, AccessLog, SyncHistory } from './entities';

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
        entities: [User, Personnel, Location, Device, AccessLog, SyncHistory],
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
    DeviceCommModule,
    GatewayModule,
    AdmsModule,
  ],
})
export class AppModule {}
