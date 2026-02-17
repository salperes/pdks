import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Personnel } from './personnel.entity';
import { Device } from './device.entity';
import { Location } from './location.entity';

@Entity('access_logs')
@Unique(['deviceId', 'deviceUserId', 'eventTime'])
export class AccessLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true, name: 'personnel_id' })
  personnelId: string;

  @ManyToOne(() => Personnel)
  @JoinColumn({ name: 'personnel_id' })
  personnel: Personnel;

  @Column({ type: 'uuid', name: 'device_id' })
  deviceId: string;

  @ManyToOne(() => Device)
  @JoinColumn({ name: 'device_id' })
  device: Device;

  @Column({ type: 'uuid', nullable: true, name: 'location_id' })
  locationId: string;

  @ManyToOne(() => Location)
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Index()
  @Column({ type: 'timestamptz', name: 'event_time' })
  eventTime: Date;

  @Index()
  @Column({ type: 'varchar', length: 5, nullable: true })
  direction: string;

  @Column({ type: 'varchar', length: 20, default: 'sync' })
  source: string;

  @Column({ type: 'int', nullable: true, name: 'device_user_id' })
  deviceUserId: number;

  @Column({ type: 'jsonb', nullable: true, name: 'raw_data' })
  rawData: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
