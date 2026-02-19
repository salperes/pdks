import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Interval } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
import { SystemSettings, EmailLog, Personnel, AccessLog, Holiday } from '../entities';
import { SettingsService } from '../settings/settings.service';

const PASSWORD_MASK = '********';
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
  ) {}

  /* ── SMTP Transport ──────────────────────── */

  private async getTransporter(): Promise<nodemailer.Transporter> {
    const s = await this.settingsRepo.findOneBy({ id: 'default' });
    if (!s?.smtpHost) throw new Error('SMTP yapılandırması eksik');

    const secure = s.smtpSecurity === 'SSL';
    const config: any = {
      host: s.smtpHost,
      port: s.smtpPort,
      secure,
    };

    if (s.smtpUsername) {
      config.auth = { user: s.smtpUsername, pass: s.smtpPassword };
    }

    if (s.smtpSecurity === 'TLS' && !secure) {
      config.tls = { rejectUnauthorized: false };
    }

    if (s.smtpSecurity === 'none') {
      config.secure = false;
      config.tls = { rejectUnauthorized: false };
    }

    return nodemailer.createTransport(config);
  }

  /* ── Test ─────────────────────────────────── */

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const transporter = await this.getTransporter();
      await transporter.verify();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async sendTestEmail(toAddress: string): Promise<{ success: boolean; error?: string }> {
    try {
      const s = await this.settingsRepo.findOneBy({ id: 'default' });
      await this.sendEmail({
        type: 'test',
        to: toAddress,
        subject: 'PDKS — Test E-postası',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#0078d4;">PDKS E-posta Testi</h2>
            <p>Bu bir test e-postasıdır. SMTP yapılandırmanız başarıyla çalışıyor.</p>
            <p style="color:#666;font-size:12px;">Gönderim: ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</p>
            <p style="color:#666;font-size:12px;">Gönderen: ${s?.smtpFromName ?? 'PDKS'} &lt;${s?.smtpFromAddress ?? ''}&gt;</p>
          </div>
        `,
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /* ── Core Send ───────────────────────────── */

  async sendEmail(params: {
    type: string;
    to: string | string[];
    subject: string;
    html: string;
  }): Promise<void> {
    const s = await this.settingsRepo.findOneBy({ id: 'default' });
    const recipients = Array.isArray(params.to) ? params.to : [params.to];
    const recipientStr = recipients.join(', ');

    const log = this.emailLogRepo.create({
      type: params.type,
      recipients: recipientStr,
      subject: params.subject,
      status: 'sent',
    });

    try {
      const transporter = await this.getTransporter();
      await transporter.sendMail({
        from: s?.smtpFromName
          ? `"${s.smtpFromName}" <${s.smtpFromAddress}>`
          : s?.smtpFromAddress ?? undefined,
        to: recipientStr,
        subject: params.subject,
        html: params.html,
      });
      this.logger.log(`E-posta gönderildi: ${params.type} → ${recipientStr}`);
    } catch (err: any) {
      log.status = 'failed';
      log.errorMessage = err.message;
      this.logger.error(`E-posta gönderilemedi: ${params.type} → ${recipientStr}: ${err.message}`);
      throw err;
    } finally {
      await this.emailLogRepo.save(log);
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
      if (!s?.emailEnabled || !s?.notifySystemErrorEnabled) return;
      const recipients = s.notifySystemErrorRecipients?.filter(Boolean);
      if (!recipients?.length) return;

      // Throttle: cihaz başına 30dk
      const key = details.deviceId ?? details.deviceName ?? 'unknown';
      const lastSent = this.systemErrorThrottle.get(key) ?? 0;
      if (Date.now() - lastSent < SYSTEM_ERROR_THROTTLE_MS) return;
      this.systemErrorThrottle.set(key, Date.now());

      const now = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
      await this.sendEmail({
        type: 'system_error',
        to: recipients,
        subject: `PDKS — Sistem Hatası: ${details.errorType}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#dc2626;">⚠ PDKS Sistem Hatası</h2>
            <table style="border-collapse:collapse;width:100%;">
              <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Hata Türü</td><td style="padding:8px;border-bottom:1px solid #eee;">${details.errorType}</td></tr>
              ${details.deviceName ? `<tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Cihaz</td><td style="padding:8px;border-bottom:1px solid #eee;">${details.deviceName}</td></tr>` : ''}
              <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Mesaj</td><td style="padding:8px;border-bottom:1px solid #eee;">${details.message}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;">Zaman</td><td style="padding:8px;">${now}</td></tr>
            </table>
          </div>
        `,
      });
    } catch (err: any) {
      this.logger.error(`Sistem hatası bildirimi gönderilemedi: ${err.message}`);
    }
  }

  /* ── Zamanlanmış Görevler ─────────────────── */

  @Interval(60_000)
  async scheduledCheck(): Promise<void> {
    try {
      const s = await this.settingsRepo.findOneBy({ id: 'default' });
      if (!s?.emailEnabled) return;

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
      this.logger.error(`Zamanlanmış e-posta kontrolü hatası: ${err.message}`);
    }
  }

  private async isHolidayOrWeekend(dateStr: string, timezoneOffset: number): Promise<boolean> {
    const d = new Date(dateStr + 'T12:00:00Z');
    const day = d.getDay(); // 0=Pazar, 6=Cumartesi
    if (day === 0 || day === 6) return true;

    const holiday = await this.holidayRepo.findOneBy({ date: dateStr });
    return !!holiday;
  }

  private async sendAbsenceWarnings(s: SystemSettings, todayStr: string): Promise<void> {
    if (await this.isHolidayOrWeekend(todayStr, s.timezoneOffset)) return;

    const recipients = s.notifyAbsenceRecipients?.filter(Boolean);
    if (!recipients?.length) return;

    // Tüm aktif personeli bul
    const allPersonnel = await this.personnelRepo.find({ where: { isActive: true } });

    // Bugünkü giriş kayıtlarını bul (UTC olarak)
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

    // Devamsız listesi HTML
    const rows = absentPersonnel
      .map(
        (p) =>
          `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">${p.firstName} ${p.lastName}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;">${p.department ?? '-'}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;">${p.employeeId ?? '-'}</td></tr>`,
      )
      .join('');

    const now = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
    await this.sendEmail({
      type: 'absence_warning',
      to: recipients,
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

    this.logger.log(`Devamsızlık uyarısı gönderildi: ${absentPersonnel.length} kişi`);
  }

  private async sendHrDailyReport(s: SystemSettings, todayStr: string): Promise<void> {
    if (await this.isHolidayOrWeekend(todayStr, s.timezoneOffset)) return;

    const recipients = s.notifyHrRecipients?.filter(Boolean);
    if (!recipients?.length) return;

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

    // Geç kalanlar (mesai başlangıcından sonra ilk giriş)
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

    // Devamsız liste
    const absentRows = absentPersonnel
      .slice(0, 30) // ilk 30
      .map(
        (p) =>
          `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:13px;">${p.firstName} ${p.lastName}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:13px;">${p.department ?? '-'}</td></tr>`,
      )
      .join('');

    const now = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
    await this.sendEmail({
      type: 'hr_daily_report',
      to: recipients,
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

    this.logger.log(`İK günlük raporu gönderildi: ${presentCount} gelen, ${absentPersonnel.length} gelmeyen`);
  }

  /* ── E-posta Geçmişi ─────────────────────── */

  async getEmailLogs(page = 1, limit = 20): Promise<{ data: EmailLog[]; total: number }> {
    const [data, total] = await this.emailLogRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }
}
