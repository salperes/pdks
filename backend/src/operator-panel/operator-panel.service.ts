import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Interval } from '@nestjs/schedule';
import { TempCardAssignment, Personnel, Device, User } from '../entities';
import { ZktecoClientService } from '../device-comm/zkteco-client.service';
import { IssueTempCardDto } from './dto/issue-temp-card.dto';

const TEMP_UID_MIN = 2901;
const TEMP_UID_MAX = 3000;

@Injectable()
export class OperatorPanelService {
  private readonly logger = new Logger(OperatorPanelService.name);

  constructor(
    @InjectRepository(TempCardAssignment)
    private readonly tempCardRepo: Repository<TempCardAssignment>,
    @InjectRepository(Personnel)
    private readonly personnelRepo: Repository<Personnel>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly zktecoClient: ZktecoClientService,
  ) {}

  async issueTempCard(dto: IssueTempCardDto, userId: string) {
    // Resolve personnel
    let personnel: Personnel;

    if (dto.personnelId) {
      const p = await this.personnelRepo.findOne({ where: { id: dto.personnelId } });
      if (!p) throw new NotFoundException('Personel bulunamadı');
      personnel = p;
    } else if (dto.guestFirstName && dto.guestLastName) {
      // Create guest personnel
      const guest = this.personnelRepo.create({
        firstName: dto.guestFirstName,
        lastName: dto.guestLastName,
        cardNumber: `GUEST-${dto.tempCardNumber}`,
        department: 'Misafir',
        phone: dto.guestPhone || undefined,
        isActive: false,
      });
      personnel = await this.personnelRepo.save(guest);
    } else {
      throw new BadRequestException(
        'personnelId veya guestFirstName+guestLastName zorunludur',
      );
    }

    // Validate devices
    const devices: Device[] = [];
    for (const did of dto.deviceIds) {
      const d = await this.deviceRepo.findOne({ where: { id: did, isActive: true } });
      if (!d) throw new BadRequestException(`Cihaz bulunamadı: ${did}`);
      devices.push(d);
    }

    if (devices.length === 0) {
      throw new BadRequestException('En az bir cihaz seçilmelidir');
    }

    // Get next available temp UID
    const tempUid = await this.getNextTempUid();

    // Write temp card to each device
    const name = this.zktecoClient.transliterateTurkish(
      `TEMP-${personnel.firstName} ${personnel.lastName}`.substring(0, 24),
    );
    const cardno = parseInt(dto.tempCardNumber, 10) || 0;
    const deviceResults: { deviceId: string; deviceName: string; success: boolean; error?: string }[] = [];

    for (const device of devices) {
      let zk: any;
      try {
        zk = await this.zktecoClient.connect(device.ipAddress, device.port, device.commKey);
        await this.zktecoClient.getUsers(zk);
        await this.zktecoClient.setUser(zk, tempUid, name, cardno, String(tempUid));
        deviceResults.push({ deviceId: device.id, deviceName: device.name, success: true });
        this.logger.log(`Temp card (uid=${tempUid}) enrolled on "${device.name}"`);
      } catch (error) {
        const errMsg = error?.message || 'Bilinmeyen hata';
        deviceResults.push({ deviceId: device.id, deviceName: device.name, success: false, error: errMsg });
        this.logger.error(`Failed to enroll temp card on "${device.name}": ${errMsg}`);
      } finally {
        if (zk) {
          try { await this.zktecoClient.disconnect(zk); } catch { /* ignore */ }
        }
      }
    }

    // Save assignment record
    const successDeviceIds = deviceResults.filter((r) => r.success).map((r) => r.deviceId);
    if (successDeviceIds.length === 0) {
      throw new BadRequestException('Hiçbir cihaza yazılamadı');
    }

    const assignment = this.tempCardRepo.create({
      personnelId: personnel.id,
      tempCardNumber: dto.tempCardNumber,
      tempUid,
      reason: dto.reason,
      note: dto.note || null,
      documentType: dto.documentType || null,
      shelfNo: dto.shelfNo || null,
      visitedPersonnelId: dto.visitedPersonnelId || null,
      visitReason: dto.visitReason || null,
      deviceIds: successDeviceIds,
      expiresAt: new Date(dto.expiresAt),
      status: 'active',
      issuedBy: userId,
    });
    const saved = await this.tempCardRepo.save(assignment);

    return {
      assignment: saved,
      personnel: { id: personnel.id, firstName: personnel.firstName, lastName: personnel.lastName },
      deviceResults,
    };
  }

  async revokeTempCard(assignmentId: string, userId: string) {
    const assignment = await this.tempCardRepo.findOne({
      where: { id: assignmentId },
      relations: ['personnel'],
    });
    if (!assignment) throw new NotFoundException('Geçici kart ataması bulunamadı');
    if (assignment.status !== 'active') {
      throw new BadRequestException('Bu kart zaten aktif değil');
    }

    await this.removeTempCardFromDevices(assignment);

    assignment.status = 'revoked';
    assignment.revokedAt = new Date();
    await this.tempCardRepo.save(assignment);

    this.logger.log(`Temp card ${assignment.tempUid} revoked by user ${userId}`);
    return { success: true, message: 'Geçici kart iptal edildi' };
  }

  async getActiveAssignments(locationId?: string) {
    const qb = this.tempCardRepo
      .createQueryBuilder('tc')
      .leftJoinAndSelect('tc.personnel', 'personnel')
      .leftJoinAndSelect('tc.issuer', 'issuer')
      .leftJoinAndSelect('tc.visitedPersonnel', 'visitedPersonnel')
      .where('tc.status = :status', { status: 'active' })
      .orderBy('tc.createdAt', 'DESC');

    const assignments = await qb.getMany();

    if (locationId) {
      // Filter by location: get devices in that location
      const devicesInLocation = await this.deviceRepo.find({
        where: { locationId, isActive: true },
        select: ['id'],
      });
      const deviceIdSet = new Set(devicesInLocation.map((d) => d.id));
      return assignments.filter((a) =>
        a.deviceIds.some((did) => deviceIdSet.has(did)),
      );
    }

    return assignments;
  }

  async getHistory(page: number, limit: number) {
    const [data, total] = await this.tempCardRepo.findAndCount({
      relations: ['personnel', 'issuer', 'visitedPersonnel'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async getOperatorLocation(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['defaultLocation'],
    });
    if (!user?.defaultLocationId) {
      return { location: null, devices: [] };
    }

    const devices = await this.deviceRepo.find({
      where: { locationId: user.defaultLocationId, isActive: true },
      relations: ['location'],
      order: { name: 'ASC' },
    });

    return {
      location: user.defaultLocation,
      devices: devices.map((d) => ({
        id: d.id,
        name: d.name,
        ipAddress: d.ipAddress,
        direction: d.direction,
        locationId: d.locationId,
        locationName: d.location?.name ?? null,
      })),
    };
  }

  @Interval(60_000)
  async cleanupExpired() {
    const graceMs = 60 * 60 * 1000; // 1 hour grace period
    const cutoff = new Date(Date.now() - graceMs);
    const expired = await this.tempCardRepo.find({
      where: { status: 'active', expiresAt: LessThan(cutoff) },
    });

    if (expired.length === 0) return;

    this.logger.log(`Cleaning up ${expired.length} expired temp card(s)...`);

    for (const assignment of expired) {
      try {
        await this.removeTempCardFromDevices(assignment);
        assignment.status = 'expired';
        await this.tempCardRepo.save(assignment);
        this.logger.log(`Temp card uid=${assignment.tempUid} expired and removed from devices`);
      } catch (error) {
        this.logger.error(`Failed to cleanup temp card ${assignment.id}: ${error?.message}`);
      }
    }
  }

  private async removeTempCardFromDevices(assignment: TempCardAssignment) {
    for (const deviceId of assignment.deviceIds) {
      const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
      if (!device) continue;

      let zk: any;
      try {
        zk = await this.zktecoClient.connect(device.ipAddress, device.port, device.commKey);
        await this.zktecoClient.deleteUser(zk, assignment.tempUid);
        this.logger.log(`Removed temp uid=${assignment.tempUid} from "${device.name}"`);
      } catch (error) {
        this.logger.error(`Failed to remove temp uid=${assignment.tempUid} from "${device.name}": ${error?.message}`);
      } finally {
        if (zk) {
          try { await this.zktecoClient.disconnect(zk); } catch { /* ignore */ }
        }
      }
    }
  }

  private async getNextTempUid(): Promise<number> {
    const active = await this.tempCardRepo.find({
      where: { status: 'active' },
      select: ['tempUid'],
    });
    const usedUids = new Set(active.map((a) => a.tempUid));
    for (let uid = TEMP_UID_MIN; uid <= TEMP_UID_MAX; uid++) {
      if (!usedUids.has(uid)) return uid;
    }
    throw new BadRequestException('Geçici kart havuzu dolu (max 100 aktif kart)');
  }
}
