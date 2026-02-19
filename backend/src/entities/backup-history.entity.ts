import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('backup_history')
export class BackupHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  @Column({ type: 'bigint', default: 0 })
  size: number;

  @Column({ type: 'varchar', length: 20, default: 'success' })
  status: string;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
