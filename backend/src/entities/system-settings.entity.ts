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

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
