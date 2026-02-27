import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('system_settings')
export class SystemSettings {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  id: string;

  @Column({ type: 'varchar', length: 5, default: '08:00', name: 'work_start_time' })
  workStartTime: string;

  @Column({ type: 'varchar', length: 5, default: '17:00', name: 'work_end_time' })
  workEndTime: string;

  @Column({ type: 'int', default: 3, name: 'timezone_offset' })
  timezoneOffset: number;

  @Column({ type: 'int', default: 120, name: 'sync_interval' })
  syncInterval: number;

  @Column({ type: 'boolean', default: false, name: 'backup_enabled' })
  backupEnabled: boolean;

  @Column({ type: 'int', default: 7, name: 'backup_retention_days' })
  backupRetentionDays: number;

  /* ── E-posta / SMTP — @deprecated: msgService'e taşındı ── */

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'smtp_host' })
  smtpHost: string | null;

  @Column({ type: 'int', default: 587, name: 'smtp_port' })
  smtpPort: number;

  @Column({ type: 'varchar', length: 10, default: 'TLS', name: 'smtp_security' })
  smtpSecurity: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'smtp_username' })
  smtpUsername: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'smtp_password' })
  smtpPassword: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'smtp_from_address' })
  smtpFromAddress: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'smtp_from_name' })
  smtpFromName: string | null;

  @Column({ type: 'boolean', default: false, name: 'email_enabled' })
  emailEnabled: boolean;

  /* ── Bildirim türleri ───────────────────── */

  @Column({ type: 'boolean', default: false, name: 'notify_absence_enabled' })
  notifyAbsenceEnabled: boolean;

  @Column({ type: 'simple-array', nullable: true, name: 'notify_absence_recipients' })
  notifyAbsenceRecipients: string[] | null;

  @Column({ type: 'varchar', length: 5, default: '18:00', name: 'notify_absence_time' })
  notifyAbsenceTime: string;

  @Column({ type: 'boolean', default: true, name: 'notify_absence_email_enabled' })
  notifyAbsenceEmailEnabled: boolean;

  @Column({ type: 'boolean', default: false, name: 'notify_absence_wa_enabled' })
  notifyAbsenceWaEnabled: boolean;

  @Column({ type: 'simple-array', nullable: true, name: 'notify_absence_wa_recipients' })
  notifyAbsenceWaRecipients: string[] | null;

  @Column({ type: 'boolean', default: false, name: 'notify_hr_enabled' })
  notifyHrEnabled: boolean;

  @Column({ type: 'simple-array', nullable: true, name: 'notify_hr_recipients' })
  notifyHrRecipients: string[] | null;

  @Column({ type: 'varchar', length: 5, default: '18:30', name: 'notify_hr_time' })
  notifyHrTime: string;

  @Column({ type: 'boolean', default: true, name: 'notify_hr_email_enabled' })
  notifyHrEmailEnabled: boolean;

  @Column({ type: 'boolean', default: false, name: 'notify_hr_wa_enabled' })
  notifyHrWaEnabled: boolean;

  @Column({ type: 'simple-array', nullable: true, name: 'notify_hr_wa_recipients' })
  notifyHrWaRecipients: string[] | null;

  @Column({ type: 'boolean', default: false, name: 'notify_system_error_enabled' })
  notifySystemErrorEnabled: boolean;

  @Column({ type: 'simple-array', nullable: true, name: 'notify_system_error_recipients' })
  notifySystemErrorRecipients: string[] | null;

  @Column({ type: 'boolean', default: true, name: 'notify_system_error_email_enabled' })
  notifySystemErrorEmailEnabled: boolean;

  @Column({ type: 'boolean', default: false, name: 'notify_system_error_wa_enabled' })
  notifySystemErrorWaEnabled: boolean;

  @Column({ type: 'simple-array', nullable: true, name: 'notify_system_error_wa_recipients' })
  notifySystemErrorWaRecipients: string[] | null;

  /* ── Mesajlaşma Servisi (msgService) ──── */

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'msg_service_url' })
  msgServiceUrl: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'msg_service_api_key' })
  msgServiceApiKey: string | null;

  @Column({ type: 'boolean', default: false, name: 'msg_service_enabled' })
  msgServiceEnabled: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
