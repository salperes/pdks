import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('email_logs')
export class EmailLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  type: string; // 'absence_warning' | 'hr_daily_report' | 'system_error' | 'test'

  @Column({ type: 'varchar', length: 20, default: 'email' })
  channel: string; // 'email' | 'whatsapp'

  @Column({ type: 'text' })
  recipients: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'varchar', length: 20, default: 'sent' })
  status: string; // 'sent' | 'failed'

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
