import { Injectable, Logger } from '@nestjs/common';
import ZKLib from 'zkteco-js';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ZUDP = require('zkteco-js/src/zudp');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { COMMANDS } = require('zkteco-js/src/helper/command');

@Injectable()
export class ZktecoClientService {
  private readonly logger = new Logger(ZktecoClientService.name);
  private nextInPort = 5200;

  private getNextInPort(): number {
    const port = this.nextInPort;
    this.nextInPort = this.nextInPort >= 5300 ? 5200 : this.nextInPort + 1;
    return port;
  }

  /**
   * Build the comm key buffer for CMD_AUTH.
   * ZKTeco protocol expects the comm key as a uint32 LE.
   */
  private buildCommKeyBuffer(commKey: string): Buffer {
    const keyNum = parseInt(commKey, 10);
    const buf = Buffer.alloc(4);
    buf.writeUInt32LE(isNaN(keyNum) ? 0 : keyNum, 0);
    return buf;
  }

  async connect(ip: string, port: number, commKey?: string): Promise<any> {
    const inPort = this.getNextInPort();

    // First try the standard ZKLib (TCP with UDP fallback)
    const zk = new ZKLib(ip, port, 10000, inPort);

    try {
      await zk.createSocket();

      // If commKey is set, authenticate after TCP connect
      if (commKey) {
        this.logger.log(`Authenticating with commKey on ${ip}:${port} (TCP)...`);
        const authBuf = this.buildCommKeyBuffer(commKey);
        await zk.executeCmd(COMMANDS.CMD_AUTH, authBuf);
      }

      await zk.getInfo();
      this.logger.log(`Connected to device at ${ip}:${port} via TCP`);
      return zk;
    } catch {
      this.logger.warn(`TCP failed for ${ip}:${port}, trying UDP directly...`);
    }

    // Fallback: connect via UDP directly (workaround for library bug in TCP→UDP fallback)
    const udpInPort = this.getNextInPort();
    const zudp = new ZUDP(ip, port, 10000, udpInPort);

    try {
      await zudp.createSocket(null, null);
      await zudp.connect();

      // If commKey is set, send CMD_AUTH after CMD_CONNECT
      if (commKey) {
        this.logger.log(`Authenticating with commKey on ${ip}:${port} (UDP)...`);
        const authBuf = this.buildCommKeyBuffer(commKey);
        const authReply = await zudp.executeCmd(COMMANDS.CMD_AUTH, authBuf);
        if (authReply) {
          const replyCmd = authReply.readUInt16LE(0);
          if (replyCmd === COMMANDS.CMD_ACK_OK) {
            this.logger.log(`CommKey auth successful for ${ip}:${port}`);
          } else {
            this.logger.warn(`CommKey auth returned code ${replyCmd} for ${ip}:${port}`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to connect to device at ${ip}:${port}`, error);
      throw error;
    }

    // getInfo is optional - some device models return shorter buffers
    try {
      const info = await zudp.getInfo();
      this.logger.log(
        `Connected to device at ${ip}:${port} via UDP on inport ${udpInPort} (users: ${info?.userCounts}, logs: ${info?.logCounts})`,
      );
    } catch {
      this.logger.log(
        `Connected to device at ${ip}:${port} via UDP on inport ${udpInPort} (getInfo not supported)`,
      );
    }

    return zudp;
  }

  async disconnect(zk: ZKLib): Promise<void> {
    try {
      await zk.disconnect();
    } catch (error) {
      this.logger.warn('Error during device disconnect', error);
    }
  }

  async getInfo(zk: ZKLib): Promise<any> {
    try {
      return await zk.getInfo();
    } catch (error) {
      this.logger.warn('Failed to get device info (may not be supported by this model)', error?.message);
      return null;
    }
  }

  async getTime(zk: ZKLib): Promise<string> {
    try {
      return await zk.getTime();
    } catch (error) {
      this.logger.error('Failed to get device time', error);
      throw error;
    }
  }

  async getAttendances(zk: ZKLib): Promise<any> {
    try {
      return await zk.getAttendances();
    } catch (error) {
      this.logger.error('Failed to get attendances', error);
      throw error;
    }
  }

  async getUsers(zk: ZKLib): Promise<any> {
    try {
      return await zk.getUsers();
    } catch (error) {
      this.logger.error('Failed to get users from device', error);
      throw error;
    }
  }

  async clearAttendanceLog(zk: ZKLib): Promise<void> {
    try {
      await zk.clearAttendanceLog();
      this.logger.log('Attendance log cleared on device');
    } catch (error) {
      this.logger.error('Failed to clear attendance log', error);
      throw error;
    }
  }

  async openDoor(zk: ZKLib, delay = 5): Promise<void> {
    try {
      await zk.executeCmd(5, String(delay));
      this.logger.log(`Door opened with ${delay}s delay`);
    } catch (error) {
      this.logger.error('Failed to open door', error);
      throw error;
    }
  }
}
