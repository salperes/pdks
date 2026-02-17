import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { AccessLog } from '../entities';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/',
})
export class EventsGateway {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  emitAccessLog(log: AccessLog): void {
    this.server.emit('access-log', log);
    this.logger.debug(`Emitted access-log event for personnel ${log.personnelId}`);
  }

  emitDeviceStatus(deviceId: string, isOnline: boolean): void {
    this.server.emit('device-status', { deviceId, isOnline });
    this.logger.debug(`Emitted device-status: ${deviceId} -> ${isOnline}`);
  }
}
