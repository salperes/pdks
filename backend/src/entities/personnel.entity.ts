import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

@Entity('personnel')
export class Personnel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 11, unique: true, nullable: true, name: 'tc_kimlik_no' })
  tcKimlikNo: string;

  @Column({ type: 'varchar', length: 100, name: 'first_name' })
  firstName: string;

  @Column({ type: 'varchar', length: 100, name: 'last_name' })
  lastName: string;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: true, name: 'employee_id' })
  employeeId: string;

  // Cihaz UID'leri integer; leading-zero stringler ('0000999') aynı kişi olmasına
  // ragmen string equality'de '999' ile eşleşmiyor. Her insert/update'te numeric
  // formdaki employeeId'lerden leading zero'lari soyariz (Portal-sync, manuel
  // form, vs.) — non-numeric ID'lere (alfanumerik) dokunulmaz.
  @BeforeInsert()
  @BeforeUpdate()
  normalizeEmployeeId(): void {
    if (this.employeeId && /^0+[0-9]+$/.test(this.employeeId)) {
      this.employeeId = String(parseInt(this.employeeId, 10));
    }
  }

  @Index()
  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  username: string;

  @Index()
  @Column({ type: 'varchar', length: 50, unique: true, nullable: true, name: 'card_number' })
  cardNumber: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  department: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  title: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'photo_url' })
  photoUrl: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
