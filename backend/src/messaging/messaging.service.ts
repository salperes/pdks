import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSettings } from '../entities';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    @InjectRepository(SystemSettings)
    private readonly settingsRepo: Repository<SystemSettings>,
  ) {}

  private async getConfig(): Promise<{ url: string; apiKey: string }> {
    const s = await this.settingsRepo.findOneBy({ id: 'default' });
    if (!s?.msgServiceUrl) throw new Error('Mesajlaşma servisi URL yapılandırması eksik');
    if (!s?.msgServiceApiKey) throw new Error('Mesajlaşma servisi API Key yapılandırması eksik');
    return { url: s.msgServiceUrl.replace(/\/+$/, ''), apiKey: s.msgServiceApiKey };
  }

  async healthCheck(): Promise<{
    success: boolean;
    data?: { status: string; smtp?: string; whatsapp?: string; queue?: any; version?: string };
    error?: string;
  }> {
    try {
      const { url } = await this.getConfig();
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      return { success: data.status === 'ok', data };
    } catch (err: any) {
      this.logger.warn(`msgService health check hatası: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async sendEmail(params: {
    to: string[];
    subject: string;
    body: string;
    bodyType?: 'html' | 'text';
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { url, apiKey } = await this.getConfig();
      const res = await fetch(`${url}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({
          to: params.to,
          subject: params.subject,
          body: params.body,
          bodyType: params.bodyType ?? 'html',
          metadata: { source: 'pdks' },
        }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || `HTTP ${res.status}` };
      }
      this.logger.log(`Mail gönderildi (msgService): ${params.to.join(', ')} — ${data.messageId}`);
      return { success: true, messageId: data.messageId };
    } catch (err: any) {
      this.logger.error(`Mail gönderim hatası (msgService): ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async sendWhatsApp(params: {
    phone: string;
    body: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { url, apiKey } = await this.getConfig();
      const res = await fetch(`${url}/wa/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({
          phone: params.phone,
          body: params.body,
          metadata: { source: 'pdks' },
        }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || `HTTP ${res.status}` };
      }
      this.logger.log(`WhatsApp gönderildi (msgService): ${params.phone} — ${data.messageId}`);
      return { success: true, messageId: data.messageId };
    } catch (err: any) {
      this.logger.error(`WhatsApp gönderim hatası (msgService): ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}
