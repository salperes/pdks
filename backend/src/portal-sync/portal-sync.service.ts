import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Personnel, SystemSettings } from '../entities';

interface PortalUser {
  id: string;
  adUsername: string;
  displayName: string;
  email: string;
  department: string;
  title: string;
  phone?: string;
  isActive: boolean;
}

@Injectable()
export class PortalSyncService {
  private readonly logger = new Logger(PortalSyncService.name);

  constructor(
    @InjectRepository(Personnel)
    private readonly personnelRepo: Repository<Personnel>,
    @InjectRepository(SystemSettings)
    private readonly settingsRepo: Repository<SystemSettings>,
  ) {}

  private async getSettings(): Promise<SystemSettings | null> {
    return this.settingsRepo.findOneBy({ id: 'default' });
  }

  private splitDisplayName(displayName: string): { firstName: string; lastName: string } {
    const idx = displayName.indexOf(' ');
    if (idx === -1) return { firstName: displayName, lastName: '' };
    return {
      firstName: displayName.substring(0, idx),
      lastName: displayName.substring(idx + 1),
    };
  }

  private async fetchPortalUsers(apiUrl: string, apiKey: string, timeoutMs: number): Promise<PortalUser[]> {
    const base = apiUrl.replace(/\/$/, '');
    const url = `${base}/api/users?limit=1000`;
    const res = await fetch(url, {
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data: { users: PortalUser[] } = await res.json();
    return data.users ?? [];
  }

  async testConnection(): Promise<{ success: boolean; userCount?: number; error?: string }> {
    const settings = await this.getSettings();
    if (!settings?.portalApiUrl || !settings?.portalApiKey) {
      return { success: false, error: 'Portal URL veya API Key tanımlı değil' };
    }

    try {
      const users = await this.fetchPortalUsers(settings.portalApiUrl, settings.portalApiKey, 10_000);
      return { success: true, userCount: users.length };
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Bağlantı hatası' };
    }
  }

  async syncNow(): Promise<{ synced: number; created: number; updated: number; error?: string }> {
    const settings = await this.getSettings();
    if (!settings?.portalApiUrl || !settings?.portalApiKey) {
      return { synced: 0, created: 0, updated: 0, error: 'Portal URL veya API Key tanımlı değil' };
    }

    if (!settings.portalSyncEnabled) {
      return { synced: 0, created: 0, updated: 0, error: 'Portal senkronizasyonu devre dışı' };
    }

    let users: PortalUser[];
    try {
      users = await this.fetchPortalUsers(settings.portalApiUrl, settings.portalApiKey, 15_000);
    } catch (err: any) {
      const msg = err?.message ?? 'Bilinmeyen hata';
      this.logger.error(`[PortalSync] Portal API hatası: ${msg}`);
      return { synced: 0, created: 0, updated: 0, error: msg };
    }

    let created = 0;
    let updated = 0;

    for (const user of users) {
      if (!user.adUsername) continue;

      const existing = await this.personnelRepo.findOneBy({ username: user.adUsername });
      const { firstName, lastName } = this.splitDisplayName(user.displayName ?? '');

      if (existing) {
        existing.firstName = firstName || existing.firstName;
        existing.lastName = lastName ?? existing.lastName;
        existing.email = user.email ?? existing.email;
        existing.department = user.department ?? existing.department;
        existing.title = user.title ?? existing.title;
        existing.phone = user.phone ?? existing.phone;
        existing.isActive = user.isActive;
        await this.personnelRepo.save(existing);
        updated++;
      } else {
        const personnel = this.personnelRepo.create({
          username: user.adUsername,
          firstName: firstName || user.adUsername,
          lastName: lastName ?? '',
          email: user.email ?? undefined,
          department: user.department ?? undefined,
          title: user.title ?? undefined,
          phone: user.phone ?? undefined,
          isActive: user.isActive,
          cardNumber: null,
        });
        await this.personnelRepo.save(personnel);
        created++;
      }
    }

    // Son sync bilgisini güncelle
    await this.settingsRepo.update('default', {
      portalLastSync: new Date(),
      portalLastSyncCount: created + updated,
    });

    this.logger.log(`[PortalSync] Tamamlandı — oluşturulan: ${created}, güncellenen: ${updated}`);
    return { synced: created + updated, created, updated };
  }

  @Cron('0 0,6,12,18 * * *')
  async scheduledSync() {
    const settings = await this.getSettings();
    if (!settings?.portalSyncEnabled) return;
    this.logger.log('[PortalSync] Zamanlanmış senkronizasyon başladı');
    await this.syncNow();
  }

  async getStatus() {
    const settings = await this.getSettings();
    return {
      enabled: settings?.portalSyncEnabled ?? false,
      portalApiUrl: settings?.portalApiUrl ?? null,
      hasApiKey: !!settings?.portalApiKey,
      lastSync: settings?.portalLastSync ?? null,
      lastSyncCount: settings?.portalLastSyncCount ?? null,
    };
  }
}
