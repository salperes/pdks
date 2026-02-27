import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Personnel } from './personnel.entity';
import { User } from './user.entity';

@Entity('temp_card_assignments')
export class TempCardAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'personnel_id' })
  personnelId: string;

  @ManyToOne(() => Personnel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'personnel_id' })
  personnel: Personnel;

  @Column({ type: 'varchar', length: 50, name: 'temp_card_number' })
  tempCardNumber: string;

  @Column({ type: 'int', name: 'temp_uid' })
  tempUid: number;

  @Column({ type: 'varchar', length: 30 })
  reason: string; // 'forgot_card' | 'guest'

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'document_type' })
  documentType: string | null; // 'kimlik' | 'ehliyet' | 'pasaport'

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'shelf_no' })
  shelfNo: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'visited_personnel_id' })
  visitedPersonnelId: string | null;

  @ManyToOne(() => Personnel, { nullable: true })
  @JoinColumn({ name: 'visited_personnel_id' })
  visitedPersonnel: Personnel | null;

  @Column({ type: 'text', nullable: true, name: 'visit_reason' })
  visitReason: string | null;

  @Column({ type: 'jsonb', name: 'device_ids' })
  deviceIds: string[];

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string; // 'active' | 'expired' | 'revoked'

  @Column({ type: 'uuid', name: 'issued_by' })
  issuedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'issued_by' })
  issuer: User;

  @Column({ type: 'timestamptz', nullable: true, name: 'revoked_at' })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
