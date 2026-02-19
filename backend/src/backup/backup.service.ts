import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { BackupHistory } from '../entities';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir = '/app/backups';

  constructor(
    @InjectRepository(BackupHistory)
    private readonly backupHistoryRepository: Repository<BackupHistory>,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
  ) {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledBackup() {
    try {
      const settings = await this.settingsService.getSettings();
      if (!settings.backupEnabled) {
        return;
      }
      this.logger.log('Zamanlanmış yedekleme başlatılıyor...');
      await this.performBackup();
      await this.cleanOldBackups(settings.backupRetentionDays);
    } catch (err) {
      this.logger.error('Zamanlanmış yedekleme başarısız', err);
    }
  }

  async performBackup(): Promise<BackupHistory> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `pdks-backup-${timestamp}.sql`;
    const filepath = path.join(this.backupDir, filename);

    const host = this.configService.get('DB_HOST', 'localhost');
    const port = this.configService.get('DB_PORT', '5432');
    const user = this.configService.get('DB_USERNAME', 'pdks');
    const db = this.configService.get('DB_DATABASE', 'pdks');
    const password = this.configService.get('DB_PASSWORD', 'pdks123');

    const entry = this.backupHistoryRepository.create({
      filename,
      size: 0,
      status: 'failed',
    });

    try {
      const cmd = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${user} -d ${db} -F p -f "${filepath}"`;
      execSync(cmd, { timeout: 300000 });

      const stats = fs.statSync(filepath);
      entry.size = stats.size;
      entry.status = 'success';

      this.logger.log(`Yedekleme tamamlandı: ${filename} (${stats.size} bytes)`);
    } catch (err: any) {
      entry.errorMessage = err.message?.substring(0, 500) || 'Bilinmeyen hata';
      this.logger.error(`Yedekleme başarısız: ${err.message}`);
    }

    return this.backupHistoryRepository.save(entry);
  }

  async getHistory(limit = 20): Promise<BackupHistory[]> {
    return this.backupHistoryRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  getBackupPath(filename: string): string | null {
    const filepath = path.join(this.backupDir, filename);
    if (!fs.existsSync(filepath)) return null;
    // Prevent path traversal
    if (!filepath.startsWith(this.backupDir)) return null;
    return filepath;
  }

  private async cleanOldBackups(retentionDays: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const oldEntries = await this.backupHistoryRepository
      .createQueryBuilder('b')
      .where('b.createdAt < :cutoff', { cutoff })
      .getMany();

    for (const entry of oldEntries) {
      const filepath = path.join(this.backupDir, entry.filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      await this.backupHistoryRepository.remove(entry);
    }

    if (oldEntries.length > 0) {
      this.logger.log(`${oldEntries.length} eski yedek temizlendi`);
    }
  }
}
