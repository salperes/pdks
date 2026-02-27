import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Interval } from '@nestjs/schedule';
import { SystemSettings, EmailLog, Personnel, AccessLog, Holiday } from '../entities';
import { SettingsService } from '../settings/settings.service';
import { MessagingService } from '../messaging/messaging.service';

const SYSTEM_ERROR_THROTTLE_MS = 30 * 60 * 1000; // 30 dakika

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private lastAbsenceDate = '';
  private lastHrDate = '';
  private systemErrorThrottle = new Map<string, number>(); // deviceId -> lastSentAt

  constructor(
    @InjectRepository(SystemSettings)
    private readonly settingsRepo: Repository<SystemSettings>,
    @InjectRepository(EmailLog)
    private readonly emailLogRepo: Repository<EmailLog>,
    @InjectRepository(Personnel)
    private readonly personnelRepo: Repository<Personnel>,
    @InjectRepository(AccessLog)
    private readonly accessLogRepo: Repository<AccessLog>,
    @InjectRepository(Holiday)
    private readonly holidayRepo: Repository<Holiday>,
    private readonly settingsService: SettingsService,
    private readonly messagingService: MessagingService,
  ) {}

  /* ── Core Send (via msgService) ─────────── */

  async sendEmail(params: {
    type: string;
    to: string | string[];
    subject: string;
    html: string;
  }): Promise<void> {
    const recipients = Array.isArray(params.to) ? params.to : [params.to];
    const recipientStr = recipients.join(', ');

    const log = this.emailLogRepo.create({
      type: params.type,
      channel: 'email',
      recipients: recipientStr,
      subject: params.subject,
      status: 'sent',
    });

    try {
      const result = await this.messagingService.sendEmail({
        to: recipients,
        subject: params.subject,
        body: params.html,
        bodyType: 'html',
      });
      if (!result.success) {
        throw new Error(result.error ?? 'msgService send failed');
      }
      this.logger.log(`E-posta gönderildi (msgService): ${params.type} → ${recipientStr}`);
    } catch (err: any) {
      log.status = 'failed';
      log.errorMessage = err.message;
      this.logger.error(`E-posta gönderilemedi: ${params.type} → ${recipientStr}: ${err.message}`);
      throw err;
    } finally {
      await this.emailLogRepo.save(log);
    }
  }

  async sendWhatsAppNotification(params: {
    type: string;
    phones: string[];
    message: string;
  }): Promise<void> {
    for (const phone of params.phones) {
      const log = this.emailLogRepo.create({
        type: params.type,
        channel: 'whatsapp',
        recipients: phone,
        subject: `WhatsApp: ${params.type}`,
        status: 'sent',
      });

      try {
        const result = await this.messagingService.sendWhatsApp({ phone, body: params.message });
        if (!result.success) {
          throw new Error(result.error ?? 'WhatsApp send failed');
        }
        this.logger.log(`WhatsApp gönderildi: ${params.type} → ${phone}`);
      } catch (err: any) {
        log.status = 'failed';
        log.errorMessage = err.message;
        this.logger.error(`WhatsApp gönderilemedi: ${params.type} → ${phone}: ${err.message}`);
      } finally {
        await this.emailLogRepo.save(log);
      }
    }
  }

  /* ── Sistem Hatası Bildirimi (anlık) ──────── */

  async sendSystemErrorNotification(details: {
    deviceName?: string;
    deviceId?: string;
    errorType: string;
    message: string;
  }): Promise<void> {
    try {
      const s = await this.settingsRepo.findOneBy({ id: 'default' });
      if (!s?.msgServiceEnabled || !s?.notifySystemErrorEnabled) return;

      // Throttle: cihaz başına 30dk
      const key = details.deviceId ?? details.deviceName ?? 'unknown';
      const lastSent = this.systemErrorThrottle.get(key) ?? 0;
      if (Date.now() - lastSent < SYSTEM_ERROR_THROTTLE_MS) return;
      this.systemErrorThrottle.set(key, Date.now());

      const now = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });

      // E-posta kanalı
      if (s.notifySystemErrorEmailEnabled) {
        const recipients = s.notifySystemErrorRecipients?.filter(Boolean);
        if (recipients?.length) {
          try {
            await this.sendEmail({
              type: 'system_error',
              to: recipients,
              subject: `PDKS — Sistem Hatası: ${details.errorType}`,
              html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                  <h2 style="color:#dc2626;">PDKS Sistem Hatası</h2>
                  <table style="border-collapse:collapse;width:100%;">
                    <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Hata Türü</td><td style="padding:8px;border-bottom:1px solid #eee;">${details.errorType}</td></tr>
                    ${details.deviceName ? `<tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Cihaz</td><td style="padding:8px;border-bottom:1px solid #eee;">${details.deviceName}</td></tr>` : ''}
                    <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Mesaj</td><td style="padding:8px;border-bottom:1px solid #eee;">${details.message}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;">Zaman</td><td style="padding:8px;">${now}</td></tr>
                  </table>
                </div>
              `,
            });
          } catch {}
        }
      }

      // WhatsApp kanalı
      if (s.notifySystemErrorWaEnabled) {
        const waRecipients = s.notifySystemErrorWaRecipients?.filter(Boolean);
        if (waRecipients?.length) {
          await this.sendWhatsAppNotification({
            type: 'system_error',
            phones: waRecipients,
            message: `PDKS Sistem Hatası\nTür: ${details.errorType}\n${details.deviceName ? `Cihaz: ${details.deviceName}\n` : ''}Mesaj: ${details.message}\nZaman: ${now}`,
          });
        }
      }
    } catch (err: any) {
      this.logger.error(`Sistem hatası bildirimi gönderilemedi: ${err.message}`);
    }
  }

  /* ── Zamanlanmış Görevler ─────────────────── */

  @Interval(60_000)
  async scheduledCheck(): Promise<void> {
    try {
      const s = await this.settingsRepo.findOneBy({ id: 'default' });
      if (!s?.msgServiceEnabled) return;

      const now = new Date(Date.now() + (s.timezoneOffset ?? 3) * 3600000);
      const currentTime = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
      const todayStr = now.toISOString().slice(0, 10);

      // Devamsızlık uyarısı
      if (s.notifyAbsenceEnabled && currentTime === s.notifyAbsenceTime && this.lastAbsenceDate !== todayStr) {
        const alreadySent = await this.emailLogRepo.findOne({
          where: {
            type: 'absence_warning',
            createdAt: Between(new Date(todayStr + 'T00:00:00Z'), new Date(todayStr + 'T23:59:59Z')),
          },
        });
        if (!alreadySent) {
          this.lastAbsenceDate = todayStr;
          await this.sendAbsenceWarnings(s, todayStr);
        }
      }

      // İK raporu
      if (s.notifyHrEnabled && currentTime === s.notifyHrTime && this.lastHrDate !== todayStr) {
        const alreadySent = await this.emailLogRepo.findOne({
          where: {
            type: 'hr_daily_report',
            createdAt: Between(new Date(todayStr + 'T00:00:00Z'), new Date(todayStr + 'T23:59:59Z')),
          },
        });
        if (!alreadySent) {
          this.lastHrDate = todayStr;
          await this.sendHrDailyReport(s, todayStr);
        }
      }
    } catch (err: any) {
      this.logger.error(`Zamanlanmış bildirim kontrolü hatası: ${err.message}`);
    }
  }

  private async isHolidayOrWeekend(dateStr: string, timezoneOffset: number): Promise<boolean> {
    const d = new Date(dateStr + 'T12:00:00Z');
    const day = d.getDay();
    if (day === 0 || day === 6) return true;
    const holiday = await this.holidayRepo.findOneBy({ date: dateStr });
    return !!holiday;
  }

  private async sendAbsenceWarnings(s: SystemSettings, todayStr: string): Promise<void> {
    if (await this.isHolidayOrWeekend(todayStr, s.timezoneOffset)) return;

    const allPersonnel = await this.personnelRepo.find({ where: { isActive: true } });
    const tzMs = (s.timezoneOffset ?? 3) * 3600000;
    const dayStartUtc = new Date(new Date(todayStr + 'T00:00:00Z').getTime() - tzMs);
    const dayEndUtc = new Date(new Date(todayStr + 'T23:59:59Z').getTime() - tzMs);

    const todayLogs = await this.accessLogRepo
      .createQueryBuilder('log')
      .select('DISTINCT log.personnel_id', 'personnelId')
      .where('log.event_time BETWEEN :start AND :end', { start: dayStartUtc, end: dayEndUtc })
      .andWhere('log.personnel_id IS NOT NULL')
      .getRawMany();

    const presentIds = new Set(todayLogs.map((l) => l.personnelId));
    const absentPersonnel = allPersonnel.filter((p) => !presentIds.has(p.id));

    if (absentPersonnel.length === 0) return;

    // E-posta kanalı
    if (s.notifyAbsenceEmailEnabled) {
      const emailRecipients = s.notifyAbsenceRecipients?.filter(Boolean);
      if (emailRecipients?.length) {
        const rows = absentPersonnel
          .map(
            (p) =>
              `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">${p.firstName} ${p.lastName}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;">${p.department ?? '-'}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;">${p.employeeId ?? '-'}</td></tr>`,
          )
          .join('');

        const now = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
        try {
          await this.sendEmail({
            type: 'absence_warning',
            to: emailRecipients,
            subject: `PDKS — Devamsızlık Raporu (${todayStr})`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
                <h2 style="color:#0078d4;">PDKS Devamsızlık Uyarısı</h2>
                <p>Bugün (${todayStr}) kart basmayan personel listesi:</p>
                <table style="border-collapse:collapse;width:100%;">
                  <thead>
                    <tr style="background:#f3f4f6;">
                      <th style="padding:8px 12px;text-align:left;font-size:13px;">Ad Soyad</th>
                      <th style="padding:8px 12px;text-align:left;font-size:13px;">Departman</th>
                      <th style="padding:8px 12px;text-align:left;font-size:13px;">Sicil No</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>
                <p style="margin-top:16px;font-size:13px;color:#666;">Toplam: ${allPersonnel.length} personel, ${absentPersonnel.length} devamsız</p>
                <p style="color:#999;font-size:11px;">Oluşturulma: ${now}</p>
              </div>
            `,
          });
        } catch {}
      }
    }

    // WhatsApp kanalı
    if (s.notifyAbsenceWaEnabled) {
      const waRecipients = s.notifyAbsenceWaRecipients?.filter(Boolean);
      if (waRecipients?.length) {
        const names = absentPersonnel.map((p) => `- ${p.firstName} ${p.lastName} (${p.department ?? '-'})`).join('\n');
        await this.sendWhatsAppNotification({
          type: 'absence_warning',
          phones: waRecipients,
          message: `PDKS Devamsızlık Uyarısı (${todayStr})\n\nBugün kart basmayan personel (${absentPersonnel.length} kişi):\n${names}\n\nToplam: ${allPersonnel.length} personel`,
        });
      }
    }

    this.logger.log(`Devamsızlık uyarısı gönderildi: ${absentPersonnel.length} kişi`);
  }

  private async sendHrDailyReport(s: SystemSettings, todayStr: string): Promise<void> {
    if (await this.isHolidayOrWeekend(todayStr, s.timezoneOffset)) return;

    const allPersonnel = await this.personnelRepo.find({ where: { isActive: true } });
    const tzMs = (s.timezoneOffset ?? 3) * 3600000;
    const dayStartUtc = new Date(new Date(todayStr + 'T00:00:00Z').getTime() - tzMs);
    const dayEndUtc = new Date(new Date(todayStr + 'T23:59:59Z').getTime() - tzMs);

    const todayLogs = await this.accessLogRepo
      .createQueryBuilder('log')
      .select('DISTINCT log.personnel_id', 'personnelId')
      .where('log.event_time BETWEEN :start AND :end', { start: dayStartUtc, end: dayEndUtc })
      .andWhere('log.personnel_id IS NOT NULL')
      .getRawMany();

    const presentIds = new Set(todayLogs.map((l) => l.personnelId));
    const presentCount = presentIds.size;
    const absentPersonnel = allPersonnel.filter((p) => !presentIds.has(p.id));

    // Geç kalanlar
    const workConfig = await this.settingsService.getGlobalWorkConfig();
    const workStartMinutes = workConfig.startHour * 60 + workConfig.startMin;

    const firstEntries = await this.accessLogRepo
      .createQueryBuilder('log')
      .select('log.personnel_id', 'personnelId')
      .addSelect('MIN(log.event_time)', 'firstEntry')
      .where('log.event_time BETWEEN :start AND :end', { start: dayStartUtc, end: dayEndUtc })
      .andWhere('log.personnel_id IS NOT NULL')
      .groupBy('log.personnel_id')
      .getRawMany();

    const lateEntries = firstEntries.filter((e) => {
      const entryLocal = new Date(new Date(e.firstEntry).getTime() + tzMs);
      const entryMinutes = entryLocal.getUTCHours() * 60 + entryLocal.getUTCMinutes();
      return entryMinutes > workStartMinutes;
    });

    // E-posta kanalı
    if (s.notifyHrEmailEnabled) {
      const emailRecipients = s.notifyHrRecipients?.filter(Boolean);
      if (emailRecipients?.length) {
        const absentRows = absentPersonnel
          .slice(0, 30)
          .map(
            (p) =>
              `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:13px;">${p.firstName} ${p.lastName}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:13px;">${p.department ?? '-'}</td></tr>`,
          )
          .join('');

        const now = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
        try {
          await this.sendEmail({
            type: 'hr_daily_report',
            to: emailRecipients,
            subject: `PDKS — İK Günlük Rapor (${todayStr})`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
                <h2 style="color:#0078d4;">PDKS İK Günlük Özet</h2>
                <p>Tarih: <strong>${todayStr}</strong></p>
                <div style="display:flex;gap:16px;margin:16px 0;">
                  <div style="flex:1;background:#f0fdf4;padding:16px;border-radius:8px;text-align:center;">
                    <div style="font-size:24px;font-weight:bold;color:#16a34a;">${presentCount}</div>
                    <div style="font-size:12px;color:#666;">Gelen</div>
                  </div>
                  <div style="flex:1;background:#fef2f2;padding:16px;border-radius:8px;text-align:center;">
                    <div style="font-size:24px;font-weight:bold;color:#dc2626;">${absentPersonnel.length}</div>
                    <div style="font-size:12px;color:#666;">Gelmeyen</div>
                  </div>
                  <div style="flex:1;background:#fefce8;padding:16px;border-radius:8px;text-align:center;">
                    <div style="font-size:24px;font-weight:bold;color:#ca8a04;">${lateEntries.length}</div>
                    <div style="font-size:12px;color:#666;">Geç Kalan</div>
                  </div>
                  <div style="flex:1;background:#eff6ff;padding:16px;border-radius:8px;text-align:center;">
                    <div style="font-size:24px;font-weight:bold;color:#2563eb;">${allPersonnel.length}</div>
                    <div style="font-size:12px;color:#666;">Toplam</div>
                  </div>
                </div>
                ${absentPersonnel.length > 0 ? `
                <h3 style="color:#dc2626;margin-top:24px;">Devamsız Personel</h3>
                <table style="border-collapse:collapse;width:100%;">
                  <thead>
                    <tr style="background:#f3f4f6;">
                      <th style="padding:6px 8px;text-align:left;font-size:12px;">Ad Soyad</th>
                      <th style="padding:6px 8px;text-align:left;font-size:12px;">Departman</th>
                    </tr>
                  </thead>
                  <tbody>${absentRows}</tbody>
                </table>
                ${absentPersonnel.length > 30 ? `<p style="font-size:12px;color:#999;">... ve ${absentPersonnel.length - 30} kişi daha</p>` : ''}
                ` : ''}
                <p style="color:#999;font-size:11px;margin-top:16px;">Oluşturulma: ${now}</p>
              </div>
            `,
          });
        } catch {}
      }
    }

    // WhatsApp kanalı
    if (s.notifyHrWaEnabled) {
      const waRecipients = s.notifyHrWaRecipients?.filter(Boolean);
      if (waRecipients?.length) {
        const absentNames = absentPersonnel
          .slice(0, 20)
          .map((p) => `- ${p.firstName} ${p.lastName}`)
          .join('\n');
        const suffix = absentPersonnel.length > 20 ? `\n... ve ${absentPersonnel.length - 20} kişi daha` : '';

        await this.sendWhatsAppNotification({
          type: 'hr_daily_report',
          phones: waRecipients,
          message: `PDKS İK Günlük Rapor (${todayStr})\n\nGelen: ${presentCount}\nGelmeyen: ${absentPersonnel.length}\nGeç Kalan: ${lateEntries.length}\nToplam: ${allPersonnel.length}${absentPersonnel.length > 0 ? `\n\nDevamsız Personel:\n${absentNames}${suffix}` : ''}`,
        });
      }
    }

    this.logger.log(`İK günlük raporu gönderildi: ${presentCount} gelen, ${absentPersonnel.length} gelmeyen`);
  }

  /* ── Bildirim Geçmişi ─────────────────────── */

  async getEmailLogs(page = 1, limit = 20, channel?: string): Promise<{ data: EmailLog[]; total: number }> {
    const where: any = {};
    if (channel) where.channel = channel;
    const [data, total] = await this.emailLogRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }
}
