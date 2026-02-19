import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  action: string;

  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId: string | null;

  @Column({ type: 'varchar', length: 100, default: '' })
  username: string;

  @Column({ type: 'varchar', length: 100, name: 'target_entity' })
  targetEntity: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'target_id' })
  targetId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, any> | null;

  @Column({ type: 'varchar', length: 45, nullable: true, name: 'ip_address' })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
