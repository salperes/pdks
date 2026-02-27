import { Injectable, Logger } from '@nestjs/common';
import ZKLib from 'zkteco-js';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ZUDP = require('zkteco-js/src/zudp');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { COMMANDS, MAX_CHUNK, REQUEST_DATA } = require('zkteco-js/src/helper/command');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  createUDPHeader,
  decodeUDPHeader,
  exportErrorMessage,
  decodeUserData72,
  decodeRecordData16,
  decodeRecordData40,
} = require('zkteco-js/src/helper/utils');
@Injectable()
export class ZktecoClientService {
    private readonly logger = new Logger(ZktecoClientService.name);
    private nextInPort = 5200;
    private readonly udpUserPacketFormat = new Map<string, 28 | 72>();
    getNextInPort() {
        const port = this.nextInPort;
        this.nextInPort = this.nextInPort >= 5500 ? 5200 : this.nextInPort + 1;
        return port;
    }
    getReplyCommand(reply) {
        if (!reply || !Buffer.isBuffer(reply) || reply.length < 2) {
            return null;
        }
        return reply.readUInt16LE(0);
    }
    reverseBits32(value) {
        let reversed = 0 >>> 0;
        for (let i = 0; i < 32; i += 1) {
            reversed = (reversed << 1) >>> 0;
            if (value & (1 << i)) {
                reversed = (reversed | 1) >>> 0;
            }
        }
        return reversed >>> 0;
    }
    buildCommKeyBuffer(commKey, sessionId, ticks = 50) {
        const keyNum = parseInt(commKey, 10);
        const key = isNaN(keyNum) ? 0 : keyNum >>> 0;
        const sid = Number.isFinite(sessionId) ? sessionId >>> 0 : 0;
        const mixedKey = (this.reverseBits32(key) + sid) >>> 0;
        const mixedBuf = Buffer.alloc(4);
        mixedBuf.writeUInt32LE(mixedKey, 0);
        mixedBuf[0] ^= 0x5a;
        mixedBuf[1] ^= 0x4b;
        mixedBuf[2] ^= 0x53;
        mixedBuf[3] ^= 0x4f;
        const low = mixedBuf.readUInt16LE(0);
        const high = mixedBuf.readUInt16LE(2);
        const swapped = Buffer.alloc(4);
        swapped.writeUInt16LE(high, 0);
        swapped.writeUInt16LE(low, 2);
        const tickByte = ticks & 0xff;
        return Buffer.from([
            swapped[0] ^ tickByte,
            swapped[1] ^ tickByte,
            tickByte,
            swapped[3] ^ tickByte,
        ]);
    }
    getSessionId(client) {
        if (typeof client?.sessionId === 'number') {
            return client.sessionId;
        }
        if (typeof client?.ztcp?.sessionId === 'number') {
            return client.ztcp.sessionId;
        }
        if (typeof client?.zudp?.sessionId === 'number') {
            return client.zudp.sessionId;
        }
        return 0;
    }
    async authenticateWithCommKey(client, commKey, transport) {
        const sessionId = this.getSessionId(client);
        const authBuf = this.buildCommKeyBuffer(commKey, sessionId, 50);
        const authReply = await client.executeCmd(COMMANDS.CMD_AUTH, authBuf);
        const replyCmd = this.getReplyCommand(authReply);
        if (replyCmd !== COMMANDS.CMD_ACK_OK) {
            throw new Error(`CMD_AUTH failed (${replyCmd ?? 'unknown'})`);
        }
        this.logger.log(`CommKey auth successful (${transport})`);
    }
    async connect(ip, port, commKey) {
        const inPort = this.getNextInPort();
        const zk = new ZKLib(ip, port, 10000, inPort);
        try {
            await zk.createSocket();
            if (commKey) {
                this.logger.log(`Authenticating with commKey on ${ip}:${port} (${zk.connectionType?.toUpperCase() ?? 'TCP'})...`);
                await this.authenticateWithCommKey(zk, commKey, 'TCP');
            }
            await zk.getInfo();
            this.logger.log(`Connected to device at ${ip}:${port} via ${zk.connectionType?.toUpperCase() ?? 'TCP'}`);
            return zk;
        }
        catch {
            // Clean up partially opened socket before trying UDP
            try { await zk.disconnect(); } catch {}
            this.logger.warn(`TCP failed for ${ip}:${port}, trying UDP directly...`);
        }
        // Try UDP with retry on EADDRINUSE (port still bound from previous connection)
        const maxRetries = 10;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const udpInPort = this.getNextInPort();
            const zudp = new ZUDP(ip, port, 10000, udpInPort);
            try {
                await zudp.createSocket(null, null);
                await zudp.connect();
                if (commKey) {
                    this.logger.log(`Authenticating with commKey on ${ip}:${port} (UDP)...`);
                    await this.authenticateWithCommKey(zudp, commKey, 'UDP');
                }
                try {
                    const info = await zudp.getInfo();
                    this.logger.log(`Connected to device at ${ip}:${port} via UDP on inport ${udpInPort} (users: ${info?.userCounts}, logs: ${info?.logCounts})`);
                }
                catch {
                    this.logger.log(`Connected to device at ${ip}:${port} via UDP on inport ${udpInPort} (getInfo not supported)`);
                }
                return zudp;
            }
            catch (error) {
                // Clean up failed socket
                try { if (zudp.socket) zudp.socket.close(); } catch {}
                if (error?.code === 'EADDRINUSE' && attempt < maxRetries - 1) {
                    this.logger.warn(`Port ${udpInPort} in use, trying next port (attempt ${attempt + 1}/${maxRetries})`);
                    continue;
                }
                this.logger.error(`Failed to connect to device at ${ip}:${port}`, error);
                throw error;
            }
        }
        throw new Error(`Failed to connect to ${ip}:${port} — all UDP ports busy after ${maxRetries} attempts`);
    }
    getUdpClient(client) {
        if (client &&
            client.socket &&
            typeof client.requestData === 'function' &&
            typeof client.sendChunkRequest === 'function') {
            return client;
        }
        if (client?.connectionType === 'udp' &&
            client?.zudp &&
            client.zudp.socket &&
            typeof client.zudp.requestData === 'function') {
            return client.zudp;
        }
        return null;
    }
    async readPreparedUdpData(udp, reply, onChunk) {
        const recvData = reply.subarray(8);
        const totalSize = recvData.length >= 5 ? recvData.readUIntLE(1, 4) : 0;
        if (!totalSize) {
            return { data: Buffer.alloc(0) };
        }
        return await new Promise((resolve, reject) => {
            let completed = false;
            let timer: NodeJS.Timeout | null = null;
            let ackWaitTimer: NodeJS.Timeout | null = null;
            let dataComplete = false;
            let totalBuffer = Buffer.alloc(0);
            const finish = (err?: Error) => {
                if (completed) {
                    return;
                }
                completed = true;
                if (timer) {
                    clearTimeout(timer);
                }
                if (ackWaitTimer) {
                    clearTimeout(ackWaitTimer);
                }
                udp.socket?.removeListener('message', onMessage);
                if (err) {
                    reject(err);
                    return;
                }
                resolve({ data: totalBuffer.subarray(0, totalSize) });
            };
            const refreshTimeout = () => {
                if (timer) {
                    clearTimeout(timer);
                }
                timer = setTimeout(() => {
                    finish(new Error(`UDP chunk timeout (${totalBuffer.length}/${totalSize})`));
                }, 10_000);
            };
            const onMessage = (packet) => {
                if (!packet || packet.length < 8) {
                    return;
                }
                const header = decodeUDPHeader(packet.subarray(0, 8));
                if (header.commandId === COMMANDS.CMD_REG_EVENT) {
                    return;
                }
                if (header.commandId === COMMANDS.CMD_DATA) {
                    totalBuffer = Buffer.concat([totalBuffer, packet.subarray(8)]);
                    if (onChunk) {
                        onChunk(Math.min(totalBuffer.length, totalSize), totalSize);
                    }
                    if (totalBuffer.length >= totalSize) {
                        dataComplete = true;
                        if (ackWaitTimer) {
                            clearTimeout(ackWaitTimer);
                        }
                        ackWaitTimer = setTimeout(() => {
                            finish();
                        }, 100);
                        return;
                    }
                    refreshTimeout();
                    return;
                }
                if (header.commandId === COMMANDS.CMD_PREPARE_DATA) {
                    refreshTimeout();
                    return;
                }
                if (header.commandId === COMMANDS.CMD_ACK_OK) {
                    if (dataComplete || totalBuffer.length >= totalSize) {
                        finish();
                        return;
                    }
                    refreshTimeout();
                    return;
                }
                finish(new Error(`Unexpected UDP chunk command ${header.commandId} (${exportErrorMessage(header.commandId)})`));
            };
            udp.socket?.on('message', onMessage);
            refreshTimeout();
            const requestChunks = async () => {
                const chunkCount = Math.ceil(totalSize / MAX_CHUNK);
                for (let i = 0; i < chunkCount; i += 1) {
                    const start = i * MAX_CHUNK;
                    const chunkSize = Math.min(MAX_CHUNK, totalSize - start);
                    await udp.sendChunkRequest(start, chunkSize);
                }
            };
            requestChunks().catch((error) => {
                finish(error);
            });
        });
    }
    async readWithBufferUdp(udp, reqData, onChunk = undefined): Promise<any> {
        udp.replyId += 1;
        const buf = createUDPHeader(COMMANDS.CMD_DATA_WRRQ, udp.sessionId, udp.replyId, reqData);
        const reply = await udp.requestData(buf);
        const header = decodeUDPHeader(reply.subarray(0, 8));
        switch (header.commandId) {
            case COMMANDS.CMD_DATA:
                return { data: reply.subarray(8), mode: 8 };
            case COMMANDS.CMD_ACK_OK:
            case COMMANDS.CMD_PREPARE_DATA:
                return this.readPreparedUdpData(udp, reply, onChunk);
            default:
                throw new Error(`ERROR_IN_UNHANDLE_CMD ${exportErrorMessage(header.commandId)}`);
        }
    }
    decodeUserData28Legacy(userData) {
        const uid = userData.readUInt16LE(0);
        const role = userData.readUInt8(2);
        const password = userData.subarray(3, 8).toString('ascii').split('\0').shift() ?? '';
        let name = userData.subarray(8, 16).toString('ascii').split('\0').shift() ?? '';
        if (!name) {
            const passwordTrimmed = password.replace(/\0/g, '').trim();
            if (passwordTrimmed.length > 0 && role >= 32 && role <= 126) {
                name = `${passwordTrimmed}${String.fromCharCode(role)}`.trim();
            }
            else {
                name = passwordTrimmed;
            }
        }
        return {
            uid,
            role,
            password,
            name,
            cardno: userData.readUInt32LE(16),
            groupId: userData.readUInt8(21),
            timezone: userData.readUInt16LE(22),
            userId: userData.readUInt32LE(24),
        };
    }
    decodeUsersByPacketSize(rawUsers, packetSize) {
        const users: any[] = [];
        const decoder = packetSize === 72
            ? decodeUserData72
            : (chunk) => this.decodeUserData28Legacy(chunk);
        let cursor = rawUsers;
        while (cursor.length >= packetSize) {
            users.push(decoder(cursor.subarray(0, packetSize)));
            cursor = cursor.subarray(packetSize);
        }
        return users;
    }
    scoreUsers(users) {
        let s = 0;
        for (const user of users.slice(0, 30)) {
            if (user?.role === 0 || user?.role === 14)
                s += 3;
            if (user?.name && typeof user.name === 'string' && user.name.trim().length > 0)
                s += 3;
            if (typeof user?.uid === 'number' && user.uid > 0 && user.uid <= 65534)
                s += 1;
            if (typeof user?.cardno === 'number' && user.cardno > 0)
                s += 1;
            if (typeof user?.role === 'number' && user.role > 14 && user.role < 128)
                s -= 2;
        }
        return s;
    }
    decodeUsersFromUdpPayload(payload, ip = '') {
        if (!payload || payload.length <= 4) {
            return [];
        }
        const rawUsers = payload.subarray(4);
        this.logger.log(`[UserDecode] Raw data: ${rawUsers.length} bytes | ` +
            `div72=${rawUsers.length % 72 === 0}(${Math.floor(rawUsers.length / 72)}) | ` +
            `div28=${rawUsers.length % 28 === 0}(${Math.floor(rawUsers.length / 28)})`);
        if (rawUsers.length >= 72) {
            this.logger.log(`[UserDecode] First 72 bytes hex: ${rawUsers.subarray(0, 72).toString('hex')}`);
        }
        else if (rawUsers.length >= 28) {
            this.logger.log(`[UserDecode] First 28 bytes hex: ${rawUsers.subarray(0, 28).toString('hex')}`);
        }
        const users72 = this.decodeUsersByPacketSize(rawUsers, 72);
        const users28 = this.decodeUsersByPacketSize(rawUsers, 28);
        const score72 = this.scoreUsers(users72);
        const score28 = this.scoreUsers(users28);
        const both72 = rawUsers.length % 72 === 0 && users72.length > 0;
        const both28 = rawUsers.length % 28 === 0 && users28.length > 0;
        this.logger.log(`[UserDecode] Score72=${score72}(${users72.length} records) | Score28=${score28}(${users28.length} records) | ` +
            `both72=${both72} | both28=${both28}`);
        let selected;
        let format;
        let selectedPacketSize: 28 | 72;
        if (both72 && both28) {
            if (score28 > score72) {
                selected = users28;
                format = '28-byte (score)';
                selectedPacketSize = 28;
            }
            else {
                selected = users72;
                format = '72-byte (score)';
                selectedPacketSize = 72;
            }
        }
        else if (both72) {
            selected = users72;
            format = '72-byte';
            selectedPacketSize = 72;
        }
        else if (both28) {
            selected = users28;
            format = '28-byte';
            selectedPacketSize = 28;
        }
        else {
            if (score72 >= score28) {
                selected = users72;
                format = '72-byte (fallback)';
                selectedPacketSize = 72;
            }
            else {
                selected = users28;
                format = '28-byte (fallback)';
                selectedPacketSize = 28;
            }
        }
        if (ip && selected.length > 0) {
            this.udpUserPacketFormat.set(ip, selectedPacketSize);
        }
        this.logger.log(`[UserDecode] Selected: ${format} | ${selected.length} users | ` +
            `Sample: ${JSON.stringify(selected[0] ?? {})}`);
        return selected;
    }
    decodeAttendancesByPacketSize(rawLogs, packetSize, ip) {
        const records: any[] = [];
        const decoder = packetSize === 40 ? decodeRecordData40 : decodeRecordData16;
        let cursor = rawLogs;
        while (cursor.length >= packetSize) {
            const record = decoder(cursor.subarray(0, packetSize));
            if (record && typeof record === 'object' && record.ip == null) {
                record.ip = ip;
            }
            records.push(record);
            cursor = cursor.subarray(packetSize);
        }
        return records;
    }
    scoreAttendanceRecords(records) {
        return records.slice(0, 50).filter((record) => {
            const value = record?.record_time;
            const date = value instanceof Date
                ? value
                : typeof value === 'string' || typeof value === 'number'
                    ? new Date(value)
                    : null;
            return !!date && !Number.isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= 2100;
        }).length;
    }
    decodeAttendancesFromUdpPayload(payload, ip) {
        if (!payload || payload.length <= 4) {
            return [];
        }
        const rawLogs = payload.subarray(4);
        const records40 = this.decodeAttendancesByPacketSize(rawLogs, 40, ip);
        const records16 = this.decodeAttendancesByPacketSize(rawLogs, 16, ip);
        const both40 = rawLogs.length % 40 === 0 && records40.length > 0;
        const both16 = rawLogs.length % 16 === 0 && records16.length > 0;
        if (both40 && both16) {
            const score40 = this.scoreAttendanceRecords(records40);
            const score16 = this.scoreAttendanceRecords(records16);
            return score16 > score40 ? records16 : records40;
        }
        if (both40) {
            return records40;
        }
        if (both16) {
            return records16;
        }
        return this.scoreAttendanceRecords(records40) >= this.scoreAttendanceRecords(records16)
            ? records40
            : records16;
    }
    async safeFreeData(udp) {
        try {
            await udp.freeData();
        }
        catch {
        }
    }
    async disconnect(zk) {
        try {
            await zk.disconnect();
        }
        catch (error) {
            this.logger.warn('Error during device disconnect', error);
        }
        // Ensure UDP socket is fully closed to release the port
        try {
            const udp = this.getUdpClient(zk);
            if (udp?.socket) {
                udp.socket.removeAllListeners();
                udp.socket.close();
            }
        } catch {}
        try {
            if (zk?.zudp?.socket) {
                zk.zudp.socket.removeAllListeners();
                zk.zudp.socket.close();
            }
        } catch {}
        try {
            if (zk?.ztcp?.socket) {
                zk.ztcp.socket.destroy();
            }
        } catch {}
    }
    async getInfo(zk) {
        try {
            return await zk.getInfo();
        }
        catch (error) {
            this.logger.warn('Failed to get device info (may not be supported by this model)', error?.message);
            return null;
        }
    }
    async getTime(zk) {
        try {
            return await zk.getTime();
        }
        catch (error) {
            this.logger.error('Failed to get device time', error);
            throw error;
        }
    }
    async setTime(zk, date: Date) {
        try {
            return await zk.setTime(date);
        }
        catch (error) {
            this.logger.error('Failed to set device time', error);
            throw error;
        }
    }
    async getAttendances(zk) {
        try {
            const udp = this.getUdpClient(zk);
            if (udp) {
                await this.safeFreeData(udp);
                const data: any = await this.readWithBufferUdp(udp, REQUEST_DATA.GET_ATTENDANCE_LOGS);
                await this.safeFreeData(udp);
                return {
                    data: this.decodeAttendancesFromUdpPayload(data.data, udp.ip ?? ''),
                };
            }
            return await zk.getAttendances();
        }
        catch (error) {
            this.logger.error('Failed to get attendances', error);
            throw error;
        }
    }
    async getUsers(zk) {
        try {
            const udp = this.getUdpClient(zk);
            if (udp) {
                await this.safeFreeData(udp);
                const data: any = await this.readWithBufferUdp(udp, REQUEST_DATA.GET_USERS);
                await this.safeFreeData(udp);
                return {
                    data: this.decodeUsersFromUdpPayload(data.data, udp.ip ?? ''),
                };
            }
            return await zk.getUsers();
        }
        catch (error) {
            this.logger.error('Failed to get users from device', error);
            throw error;
        }
    }
    async clearAttendanceLog(zk) {
        try {
            await zk.clearAttendanceLog();
            this.logger.log('Attendance log cleared on device');
        }
        catch (error) {
            this.logger.error('Failed to clear attendance log', error);
            throw error;
        }
    }
    transliterateTurkish(str) {
        const map = {
            '\u00e7': 'c', '\u00c7': 'C', '\u011f': 'g', '\u011e': 'G',
            '\u0131': 'i', '\u0130': 'I', '\u00f6': 'o', '\u00d6': 'O',
            '\u015f': 's', '\u015e': 'S', '\u00fc': 'u', '\u00dc': 'U',
        };
        return str.replace(/[\u00e7\u00c7\u011f\u011e\u0131\u0130\u00f6\u00d6\u015f\u015e\u00fc\u00dc]/g, (ch) => map[ch] ?? ch);
    }
    buildUserBuffer72(uid, role, password, name, cardno, userid) {
        const buf = Buffer.alloc(72);
        buf.writeUInt16LE(uid, 0);
        buf.writeUInt16LE(role, 2);
        const pwd = password.substring(0, 8);
        if (pwd.length > 0) {
            buf.write(pwd, 3, pwd.length, 'ascii');
        }
        const nm = this.transliterateTurkish(name).substring(0, 24);
        if (nm.length > 0) {
            buf.write(nm, 11, nm.length, 'ascii');
        }
        buf.writeUInt32LE(cardno >>> 0, 35);
        buf.writeUInt32LE(0, 40);
        const uidStr = userid.substring(0, 9);
        if (uidStr.length > 0) {
            buf.write(uidStr, 48, uidStr.length, 'ascii');
        }
        return buf;
    }
    buildUserBuffer28(uid, role, password, name, cardno, userid) {
        const buf = Buffer.alloc(28);
        buf.writeUInt16LE(uid, 0);
        buf.writeUInt8(role & 0xff, 2);
        const pwd = password.substring(0, 5);
        if (pwd.length > 0) {
            buf.write(pwd, 3, pwd.length, 'ascii');
        }
        const nm = this.transliterateTurkish(name).substring(0, 8);
        if (nm.length > 0) {
            buf.write(nm, 8, nm.length, 'ascii');
        }
        buf.writeUInt32LE(cardno >>> 0, 16);
        buf.writeUInt8(1, 21);
        buf.writeUInt16LE(0, 22);
        const userIdNum = Number.parseInt(userid, 10);
        const safeUserId = Number.isNaN(userIdNum) ? uid : Math.max(0, userIdNum);
        buf.writeUInt32LE(safeUserId >>> 0, 24);
        return buf;
    }
    async setUser(zk, uid, name, cardno, userid?: string, password?: string, role?: number) {
        if (uid <= 0 || uid > 3000) {
            throw new Error(`Invalid uid: ${uid}. Must be between 1 and 3000.`);
        }
        const normalizedName = name ?? '';
        const normalizedUserId = userid ?? String(uid);
        const normalizedPassword = password ?? '';
        const normalizedRole = role ?? 0;
        const normalizedCardNo = cardno ?? 0;
        const udp = this.getUdpClient(zk);
        if (udp) {
            const ip = udp.ip ?? '';
            const preferredFormat = this.udpUserPacketFormat.get(ip) ?? 28;
            const tryOrder: Array<28 | 72> = preferredFormat === 28 ? [28, 72] : [72, 28];
            let lastError: Error | null = null;
            for (const packetFormat of tryOrder) {
                const buf = packetFormat === 28
                    ? this.buildUserBuffer28(uid, normalizedRole, normalizedPassword, normalizedName, normalizedCardNo, normalizedUserId)
                    : this.buildUserBuffer72(uid, normalizedRole, normalizedPassword, normalizedName, normalizedCardNo, normalizedUserId);
                const reply = await udp.executeCmd(COMMANDS.CMD_USER_WRQ, buf);
                const replyCmd = this.getReplyCommand(reply);
                if (replyCmd === COMMANDS.CMD_ACK_OK) {
                    if (ip) {
                        this.udpUserPacketFormat.set(ip, packetFormat);
                    }
                    this.logger.log(`User set via UDP(${packetFormat}): uid=${uid}, name="${this.transliterateTurkish(normalizedName)}", cardno=${normalizedCardNo}`);
                    return;
                }
                lastError = new Error(`setUser failed (format=${packetFormat}, reply: ${replyCmd ?? 'null'} - ${exportErrorMessage(replyCmd ?? 0)})`);
            }
            throw lastError ?? new Error('setUser failed');
        }
        await zk.setUser(uid, normalizedUserId, normalizedName, normalizedPassword, normalizedRole, normalizedCardNo);
        this.logger.log(`User set via TCP: uid=${uid}, name="${this.transliterateTurkish(normalizedName)}", cardno=${normalizedCardNo}`);
    }
    async deleteUser(zk, uid) {
        if (uid <= 0 || uid > 3000) {
            throw new Error(`Invalid uid: ${uid}. Must be between 1 and 3000.`);
        }
        const buf = Buffer.alloc(72);
        buf.writeUInt16LE(uid, 0);
        const udp = this.getUdpClient(zk);
        if (udp) {
            const reply = await udp.executeCmd(COMMANDS.CMD_DELETE_USER, buf);
            const replyCmd = this.getReplyCommand(reply);
            if (replyCmd !== COMMANDS.CMD_ACK_OK) {
                throw new Error(`deleteUser failed (reply: ${replyCmd ?? 'null'} - ${exportErrorMessage(replyCmd ?? 0)})`);
            }
            this.logger.log(`User deleted via UDP: uid=${uid}`);
            return;
        }
        await zk.deleteUser(uid);
        this.logger.log(`User deleted via TCP: uid=${uid}`);
    }
    async openDoor(zk, delay = 5) {
        try {
            await zk.executeCmd(5, String(delay));
            this.logger.log(`Door opened with ${delay}s delay`);
        }
        catch (error) {
            this.logger.error('Failed to open door', error);
            throw error;
        }
    }
}
