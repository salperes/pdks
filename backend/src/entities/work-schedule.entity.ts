import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('work_schedules')
export class WorkSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 5, name: 'work_start_time' })
  workStartTime: string;

  @Column({ type: 'varchar', length: 5, name: 'work_end_time' })
  workEndTime: string;

  @Column({ type: 'boolean', default: false, name: 'is_flexible' })
  isFlexible: boolean;

  @Column({ type: 'int', nullable: true, name: 'flex_grace_minutes' })
  flexGraceMinutes: number | null;

  @Column({ type: 'varchar', length: 10, default: 'firstLast', name: 'calculation_mode' })
  calculationMode: 'firstLast' | 'paired';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
