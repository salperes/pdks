import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../entities';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { DevicesService } from './devices.service';
import { DeviceManagerService } from '../device-comm/device-manager.service';
import { ZktecoClientService } from '../device-comm/zkteco-client.service';
import { SyncService } from '../device-comm/sync.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Controller('devices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly deviceManager: DeviceManagerService,
    private readonly zktecoClient: ZktecoClientService,
    private readonly syncService: SyncService,
  ) {}

  @Get()
  findAll() {
    return this.devicesService.findAll();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateDeviceDto) {
    return this.devicesService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.devicesService.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateDeviceDto) {
    return this.devicesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.devicesService.remove(id);
  }

  @Post(':id/test')
  @Roles(UserRole.ADMIN)
  async testConnection(@Param('id') id: string) {
    const device = await this.devicesService.findById(id);

    try {
      const zk = await this.zktecoClient.connect(device.ipAddress, device.port, device.commKey);
      const info = await this.zktecoClient.getInfo(zk);
      await this.zktecoClient.disconnect(zk);

      return { success: true, message: 'Baglanti basarili', info };
    } catch (error) {
      const errMsg = error?.message || error?.err?.err?.code || JSON.stringify(error);
      return {
        success: false,
        message: `Baglanti basarisiz: ${errMsg}`,
      };
    }
  }

  @Post(':id/connect')
  @Roles(UserRole.ADMIN)
  async connectDevice(@Param('id') id: string) {
    const device = await this.devicesService.findById(id);
    const result = await this.deviceManager.connectDevice(device);

    return {
      success: result,
      message: result ? 'Cihaz baglandi' : 'Cihaz baglantisi basarisiz',
    };
  }

  @Post(':id/disconnect')
  @Roles(UserRole.ADMIN)
  async disconnectDevice(@Param('id') id: string) {
    await this.deviceManager.disconnectDevice(id);
    return { success: true, message: 'Cihaz baglantisi kesildi' };
  }

  @Post(':id/sync')
  @Roles(UserRole.ADMIN)
  async syncDevice(@Param('id') id: string) {
    const result = await this.syncService.syncDevice(id);
    return { success: true, recordsSynced: result.recordsSynced };
  }

  @Post('sync-all')
  @Roles(UserRole.ADMIN)
  async syncAll() {
    await this.syncService.syncAllDevices();
    return { success: true, message: 'Sync tamamlandi' };
  }
}
