import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Personnel, AccessLog } from '../entities';

@Injectable()
export class QueryService {
  constructor(
    @InjectRepository(Personnel)
    private readonly personnelRepo: Repository<Personnel>,
    @InjectRepository(AccessLog)
    private readonly accessLogRepo: Repository<AccessLog>,
  ) {}

  /**
   * GET /query/person?q=TEXT
   * Kişi adı / kullanıcı adı / kart numarası ile arama.
   * Her eşleşme için lastAccessTime, lastDevice, totalLogs, recentLogs (son 5) döner.
   */
  async searchByPerson(q: string) {
    if (!q || q.trim().length < 2) {
      throw new BadRequestException('Arama terimi en az 2 karakter olmalıdır');
    }

    const term = `%${q.trim()}%`;

    const persons = await this.personnelRepo
      .createQueryBuilder('p')
      .where(
        `(p.firstName ILIKE :term OR p.lastName ILIKE :term OR
          p.username ILIKE :term OR p.cardNumber ILIKE :term OR
          (p.firstName || ' ' || p.lastName) ILIKE :term)`,
        { term },
      )
      .orderBy('p.lastName', 'ASC')
      .addOrderBy('p.firstName', 'ASC')
      .take(50)
      .getMany();

    if (persons.length === 0) return [];

    const ids = persons.map((p) => p.id);

    // Tek sorguda tüm ID'ler için stats
    const stats: Array<{
      personnelId: string;
      totalLogs: string;
      lastAccessTime: Date | null;
      lastDirection: string | null;
      lastDeviceName: string | null;
    }> = await this.accessLogRepo.query(
      `SELECT
         al.personnel_id AS "personnelId",
         COUNT(*) AS "totalLogs",
         MAX(al.event_time) AS "lastAccessTime",
         (SELECT a2.direction FROM access_logs a2
          WHERE a2.personnel_id = al.personnel_id
          ORDER BY a2.event_time DESC LIMIT 1) AS "lastDirection",
         (SELECT d.name FROM access_logs a3
          JOIN devices d ON d.id = a3.device_id
          WHERE a3.personnel_id = al.personnel_id
          ORDER BY a3.event_time DESC LIMIT 1) AS "lastDeviceName"
       FROM access_logs al
       WHERE al.personnel_id = ANY($1)
       GROUP BY al.personnel_id`,
      [ids],
    );

    const statsMap = new Map(stats.map((s) => [s.personnelId, s]));

    // Son 5 log — window function ile tek sorguda
    const recentRows: Array<{
      personnelId: string;
      id: string;
      eventTime: Date;
      direction: string | null;
      deviceName: string | null;
      locationName: string | null;
    }> = await this.accessLogRepo.query(
      `SELECT
         rl.personnel_id AS "personnelId",
         rl.id,
         rl.event_time AS "eventTime",
         rl.direction,
         d.name AS "deviceName",
         l.name AS "locationName"
       FROM (
         SELECT al.*,
                ROW_NUMBER() OVER (PARTITION BY al.personnel_id ORDER BY al.event_time DESC) AS rn
         FROM access_logs al
         WHERE al.personnel_id = ANY($1)
       ) rl
       LEFT JOIN devices d ON d.id = rl.device_id
       LEFT JOIN locations l ON l.id = rl.location_id
       WHERE rl.rn <= 5
       ORDER BY rl.personnel_id, rl.event_time DESC`,
      [ids],
    );

    const recentMap = new Map<string, typeof recentRows>();
    for (const row of recentRows) {
      if (!recentMap.has(row.personnelId)) recentMap.set(row.personnelId, []);
      recentMap.get(row.personnelId)!.push(row);
    }

    return persons.map((p) => {
      const s = statsMap.get(p.id);
      return {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        username: p.username,
        cardNumber: p.cardNumber,
        department: p.department,
        title: p.title,
        employeeId: p.employeeId,
        isActive: p.isActive,
        email: p.email,
        phone: p.phone,
        photoUrl: p.photoUrl,
        lastAccessTime: s?.lastAccessTime ?? null,
        lastDirection: s?.lastDirection ?? null,
        lastDeviceName: s?.lastDeviceName ?? null,
        totalLogs: s ? parseInt(s.totalLogs, 10) : 0,
        recentLogs: (recentMap.get(p.id) ?? []).map((r) => ({
          id: r.id,
          eventTime: r.eventTime,
          direction: r.direction,
          deviceName: r.deviceName,
          locationName: r.locationName,
        })),
      };
    });
  }

  /**
   * GET /query/card?number=CARD_NUM
   * Kart numarasına göre personel + son 20 geçiş.
   * Eşleşme yoksa rawData JSONB üzerinden orphan log arar.
   */
  async searchByCard(number: string) {
    if (!number || number.trim().length === 0) {
      throw new BadRequestException('Kart numarası boş olamaz');
    }

    const cardNum = number.trim();

    const persons = await this.personnelRepo
      .createQueryBuilder('p')
      .where('p.cardNumber ILIKE :card', { card: cardNum })
      .getMany();

    if (persons.length === 0) {
      // Fallback: rawData->>'cardNo' veya rawData->>'CardNo'
      const orphanLogs: Array<{
        id: string;
        eventTime: Date;
        direction: string | null;
        deviceUserId: number | null;
        rawCardNo: string | null;
        deviceName: string | null;
        locationName: string | null;
      }> = await this.accessLogRepo.query(
        `SELECT
           al.id,
           al.event_time AS "eventTime",
           al.direction,
           al.device_user_id AS "deviceUserId",
           COALESCE(al.raw_data->>'cardNo', al.raw_data->>'CardNo') AS "rawCardNo",
           d.name AS "deviceName",
           l.name AS "locationName"
         FROM access_logs al
         LEFT JOIN devices d ON d.id = al.device_id
         LEFT JOIN locations l ON l.id = al.location_id
         WHERE COALESCE(al.raw_data->>'cardNo', al.raw_data->>'CardNo') ILIKE $1
         ORDER BY al.event_time DESC
         LIMIT 20`,
        [cardNum],
      );

      return {
        personnel: [],
        orphanLogs,
        message:
          orphanLogs.length > 0
            ? `Kart personele atanmamış — ${orphanLogs.length} geçiş kaydı bulundu`
            : 'Bu kart numarasına ait kayıt bulunamadı',
      };
    }

    const results: Array<{ personnel: object; logs: object[] }> = [];

    for (const p of persons) {
      const logs: Array<{
        id: string;
        eventTime: Date;
        direction: string | null;
        deviceUserId: number | null;
        deviceName: string | null;
        locationName: string | null;
      }> = await this.accessLogRepo.query(
        `SELECT
           al.id,
           al.event_time AS "eventTime",
           al.direction,
           al.device_user_id AS "deviceUserId",
           d.name AS "deviceName",
           l.name AS "locationName"
         FROM access_logs al
         LEFT JOIN devices d ON d.id = al.device_id
         LEFT JOIN locations l ON l.id = al.location_id
         WHERE al.personnel_id = $1
         ORDER BY al.event_time DESC
         LIMIT 20`,
        [p.id],
      );

      results.push({
        personnel: {
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          username: p.username,
          cardNumber: p.cardNumber,
          department: p.department,
          title: p.title,
          employeeId: p.employeeId,
          isActive: p.isActive,
          email: p.email,
          phone: p.phone,
          photoUrl: p.photoUrl,
        },
        logs,
      });
    }

    return { personnel: results, orphanLogs: [], message: null };
  }
}
