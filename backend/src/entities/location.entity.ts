import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Device } from './device.entity';

@Entity('locations')
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'varchar', length: 5, nullable: true, name: 'work_start_time' })
  workStartTime: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true, name: 'work_end_time' })
  workEndTime: string | null;

  @Column({ type: 'boolean', default: false, name: 'is_flexible' })
  isFlexible: boolean;

  @Column({ type: 'int', nullable: true, name: 'flex_grace_minutes' })
  flexGraceMinutes: number | null;

  @OneToMany(() => Device, (device) => device.location)
  devices: Device[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
