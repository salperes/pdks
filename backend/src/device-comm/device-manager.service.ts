import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../entities';
import { ZktecoClientService } from './zkteco-client.service';

@Injectable()
export class DeviceManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeviceManagerService.name);
  private readonly connections: Map<string, any> = new Map();

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    private readonly zktecoClient: ZktecoClientService,
  ) {}

  async onModuleInit(): Promise<void> {
    const activeDevices = await this.deviceRepository.find({
      where: { isActive: true },
    });

    this.logger.log(
      `Found ${activeDevices.length} active device(s). ` +
      `Connections will be created on-demand (sync handles periodic connectivity).`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting all devices...');

    for (const [deviceId, zk] of this.connections) {
      try {
        await this.zktecoClient.disconnect(zk);
        this.logger.log(`Disconnected device ${deviceId}`);
      } catch (error) {
        this.logger.warn(`Error disconnecting device ${deviceId}`, error);
      }
    }

    this.connections.clear();
  }

  async connectDevice(device: Pick<Device, 'id' | 'ipAddress' | 'port' | 'commKey'>): Promise<boolean> {
    try {
      const zk = await this.zktecoClient.connect(device.ipAddress, device.port, device.commKey);

      this.connections.set(device.id, zk);

      await this.deviceRepository.update(device.id, {
        isOnline: true,
        lastOnlineAt: new Date(),
      });

      this.logger.log(`Device ${device.id} (${device.ipAddress}) connected successfully`);
      return true;
    } catch (error) {
      await this.deviceRepository.update(device.id, { isOnline: false });

      this.logger.warn(
        `Failed to connect device ${device.id} (${device.ipAddress}:${device.port}): ${error.message}`,
      );
      return false;
    }
  }

  async disconnectDevice(deviceId: string): Promise<void> {
    const zk = this.connections.get(deviceId);

    if (!zk) {
      return;
    }

    await this.zktecoClient.disconnect(zk);
    this.connections.delete(deviceId);

    await this.deviceRepository.update(deviceId, { isOnline: false });

    this.logger.log(`Device ${deviceId} disconnected`);
  }

  getConnection(deviceId: string): any | undefined {
    return this.connections.get(deviceId);
  }

  isConnected(deviceId: string): boolean {
    return this.connections.has(deviceId);
  }

  getConnectedDeviceIds(): string[] {
    return Array.from(this.connections.keys());
  }
}
