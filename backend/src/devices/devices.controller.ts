import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole, Personnel } from '../entities';
import { PersonnelService } from '../personnel/personnel.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators';
import { AuditLogService } from '../audit-log/audit-log.service';
import { DevicesService } from './devices.service';
import { DeviceManagerService } from '../device-comm/device-manager.service';
import { ZktecoClientService } from '../device-comm/zkteco-client.service';
import { SyncService } from '../device-comm/sync.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import type { AuthUser } from '../auth/interfaces';

@ApiTags('Devices')
@Controller('devices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly deviceManager: DeviceManagerService,
    private readonly zktecoClient: ZktecoClientService,
    private readonly syncService: SyncService,
    private readonly personnelService: PersonnelService,
    private readonly auditLogService: AuditLogService,
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
  async syncDevice(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    const device = await this.devicesService.findById(id);
    const result = await this.syncService.syncDevice(device);
    this.auditLogService.log({
      action: 'SYNC',
      userId: me.id,
      username: me.username,
      targetEntity: 'Device',
      targetId: id,
      details: { deviceName: device.name, recordsSynced: result.recordsSynced },
    });
    return { success: true, recordsSynced: result.recordsSynced };
  }

  @Post('sync-all')
  @Roles(UserRole.ADMIN)
  async syncAll(@CurrentUser() me: AuthUser) {
    await this.syncService.syncAllDevices();
    this.auditLogService.log({
      action: 'SYNC',
      userId: me.id,
      username: me.username,
      targetEntity: 'Device',
      details: { scope: 'all' },
    });
    return { success: true, message: 'Sync tamamlandi' };
  }

  @Post(':id/pull')
  @Roles(UserRole.ADMIN)
  async pullDeviceData(
    @Param('id') id: string,
    @Query('usersLimit') usersLimitRaw?: string,
    @Query('logsLimit') logsLimitRaw?: string,
  ) {
    const device = await this.devicesService.findById(id);
    const usersLimit = this.normalizeLimit(usersLimitRaw, 10, 1000);
    const logsLimit = this.normalizeLimit(logsLimitRaw, 50, 5000);

    let zk: any;
    try {
      zk = await this.zktecoClient.connect(device.ipAddress, device.port, device.commKey);
      const info = await this.zktecoClient.getInfo(zk);
      const usersPayload = await this.zktecoClient.getUsers(zk);
      const attendancePayload = await this.zktecoClient.getAttendances(zk);

      const users = this.unwrapDataArray(usersPayload);
      const attendances = this.unwrapDataArray(attendancePayload);

      return {
        success: true,
        device: {
          id: device.id,
          name: device.name,
          ipAddress: device.ipAddress,
          port: device.port,
        },
        info,
        counts: {
          users: users.length,
          attendances: attendances.length,
        },
        samples: {
          users: users.slice(0, usersLimit),
          attendances: attendances.slice(0, logsLimit),
        },
      };
    } catch (error) {
      const errMsg = error?.message || error?.err?.err?.code || JSON.stringify(error);
      return {
        success: false,
        message: `Veri cekimi basarisiz: ${errMsg}`,
      };
    } finally {
      if (zk) {
        await this.zktecoClient.disconnect(zk);
      }
    }
  }

  @Post(':id/users')
  @Roles(UserRole.ADMIN)
  async getDeviceUsers(@Param('id') id: string) {
    const device = await this.devicesService.findById(id);

    let zk: any;
    try {
      zk = await this.zktecoClient.connect(device.ipAddress, device.port, device.commKey);
      const usersPayload = await this.zktecoClient.getUsers(zk);
      const users = this.unwrapDataArray(usersPayload);

      return {
        success: true,
        device: {
          id: device.id,
          name: device.name,
        },
        count: users.length,
        users,
      };
    } catch (error) {
      const errMsg = error?.message || error?.err?.err?.code || JSON.stringify(error);
      return {
        success: false,
        message: `Kullanici listesi alinamadi: ${errMsg}`,
      };
    } finally {
      if (zk) {
        await this.zktecoClient.disconnect(zk);
      }
    }
  }

  @Post(':id/enroll/:personnelId')
  @Roles(UserRole.ADMIN)
  async enrollPersonnel(
    @Param('id') id: string,
    @Param('personnelId') personnelId: string,
  ) {
    const device = await this.devicesService.findById(id);
    const personnel = await this.personnelService.findById(personnelId);

    let uid: number;
    try {
      uid = this.resolveUid(personnel);
    } catch {
      return { success: false, message: `"${personnel.firstName} ${personnel.lastName}" icin gecerli UID olusturulamadi (employeeId veya cardNumber gerekli)` };
    }

    const name = `${personnel.firstName} ${personnel.lastName}`.substring(0, 24);
    const cardno = parseInt(personnel.cardNumber, 10) || 0;
    const userId = personnel.employeeId ? String(personnel.employeeId) : String(uid);

    let zk: any;
    try {
      zk = await this.zktecoClient.connect(device.ipAddress, device.port, device.commKey);
      await this.zktecoClient.getUsers(zk); // prime packet format detection
      await this.zktecoClient.setUser(zk, uid, name, cardno, userId);
      return {
        success: true,
        message: 'Personel cihaza tanimlandi',
        data: { uid, name, cardno },
      };
    } catch (error) {
      const errMsg = error?.message || JSON.stringify(error);
      return { success: false, message: `Personel tanimlama basarisiz: ${errMsg}` };
    } finally {
      if (zk) {
        await this.zktecoClient.disconnect(zk);
      }
    }
  }

  @Delete(':id/enroll/:personnelId')
  @Roles(UserRole.ADMIN)
  async unenrollPersonnel(
    @Param('id') id: string,
    @Param('personnelId') personnelId: string,
  ) {
    const device = await this.devicesService.findById(id);
    const personnel = await this.personnelService.findById(personnelId);

    let uid: number;
    try {
      uid = this.resolveUid(personnel);
    } catch {
      return { success: false, message: `"${personnel.firstName} ${personnel.lastName}" icin gecerli UID olusturulamadi` };
    }

    let zk: any;
    try {
      zk = await this.zktecoClient.connect(device.ipAddress, device.port, device.commKey);
      await this.zktecoClient.deleteUser(zk, uid);
      return { success: true, message: 'Personel cihazdan silindi', data: { uid } };
    } catch (error) {
      const errMsg = error?.message || JSON.stringify(error);
      return { success: false, message: `Personel silme basarisiz: ${errMsg}` };
    } finally {
      if (zk) {
        await this.zktecoClient.disconnect(zk);
      }
    }
  }

  @Post(':id/enroll-all')
  @Roles(UserRole.ADMIN)
  async enrollAll(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    const device = await this.devicesService.findById(id);
    const allPersonnel = await this.personnelService.findAll({ limit: 10000 });
    const activeList = allPersonnel.data.filter((p) => p.isActive);

    let zk: any;
    const results: { personnelId: string; uid: number; success: boolean; error?: string }[] = [];

    try {
      zk = await this.zktecoClient.connect(device.ipAddress, device.port, device.commKey);
      await this.zktecoClient.getUsers(zk); // prime packet format detection

      for (const personnel of activeList) {
        try {
          const uid = this.resolveUid(personnel);
          const name = `${personnel.firstName} ${personnel.lastName}`.substring(0, 24);
          const cardno = parseInt(personnel.cardNumber, 10) || 0;
          const userId = personnel.employeeId ? String(personnel.employeeId) : String(uid);
          await this.zktecoClient.setUser(zk, uid, name, cardno, userId);
          results.push({ personnelId: personnel.id, uid, success: true });
        } catch (error) {
          results.push({
            personnelId: personnel.id,
            uid: 0,
            success: false,
            error: error?.message,
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      this.auditLogService.log({
        action: 'ENROLL_ALL',
        userId: me.id,
        username: me.username,
        targetEntity: 'Device',
        targetId: id,
        details: { deviceName: device.name, success: successCount, total: activeList.length },
      });
      return {
        success: true,
        message: `${successCount}/${activeList.length} personel tanimlandi`,
        results,
      };
    } catch (error) {
      const errMsg = error?.message || JSON.stringify(error);
      return { success: false, message: `Toplu tanimlama basarisiz: ${errMsg}` };
    } finally {
      if (zk) {
        await this.zktecoClient.disconnect(zk);
      }
    }
  }

  private resolveUid(personnel: Personnel, fallbackIndex?: number): number {
    if (personnel.employeeId) {
      const parsed = parseInt(personnel.employeeId, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 3000) {
        return parsed;
      }
    }
    // employeeId yoksa veya geçersizse, cardNumber'dan hash türet (1-3000 arası)
    if (personnel.cardNumber) {
      let hash = 0;
      for (let i = 0; i < personnel.cardNumber.length; i++) {
        hash = ((hash << 5) - hash + personnel.cardNumber.charCodeAt(i)) | 0;
      }
      const uid = (Math.abs(hash) % 2999) + 1;
      return uid;
    }
    // Son çare: fallbackIndex kullan
    if (fallbackIndex !== undefined && fallbackIndex > 0 && fallbackIndex <= 3000) {
      return fallbackIndex;
    }
    throw new Error(
      `"${personnel.firstName} ${personnel.lastName}" icin gecerli employeeId veya cardNumber yok`,
    );
  }

  private unwrapDataArray(payload: any): any[] {
    if (Array.isArray(payload?.data)) {
      return payload.data;
    }
    if (Array.isArray(payload)) {
      return payload;
    }
    return [];
  }

  private normalizeLimit(value: string | undefined, fallback: number, max: number): number {
    const parsed = Number.parseInt(value ?? '', 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.min(parsed, max);
  }
}
