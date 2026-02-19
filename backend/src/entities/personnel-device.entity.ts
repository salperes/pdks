import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Personnel } from './personnel.entity';
import { Device } from './device.entity';

@Entity('personnel_devices')
@Unique(['personnelId', 'deviceId'])
export class PersonnelDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'personnel_id' })
  personnelId: string;

  @ManyToOne(() => Personnel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'personnel_id' })
  personnel: Personnel;

  @Column({ type: 'uuid', name: 'device_id' })
  deviceId: string;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: Device;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string; // 'enrolled' | 'failed' | 'pending'

  @Column({ type: 'uuid', nullable: true, name: 'enrolled_by' })
  enrolledBy: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'error_message' })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'enrolled_at', type: 'timestamptz' })
  enrolledAt: Date;
}
