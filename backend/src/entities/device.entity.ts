import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Location } from './location.entity';

export enum DeviceDirection {
  IN = 'in',
  OUT = 'out',
  BOTH = 'both',
}

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: true, name: 'serial_number' })
  serialNumber: string;

  @Column({ type: 'varchar', length: 45, name: 'ip_address' })
  ipAddress: string;

  @Column({ type: 'int', default: 4370 })
  port: number;

  @Column({ type: 'uuid', nullable: true, name: 'location_id' })
  locationId: string;

  @ManyToOne(() => Location, (location) => location.devices)
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column({ type: 'enum', enum: DeviceDirection, default: DeviceDirection.BOTH })
  direction: DeviceDirection;

  @Column({ type: 'boolean', default: false, name: 'is_online' })
  isOnline: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_sync_at' })
  lastSyncAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_online_at' })
  lastOnlineAt: Date;

  @Column({ type: 'varchar', length: 50, nullable: true, default: null, name: 'comm_key' })
  commKey: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
