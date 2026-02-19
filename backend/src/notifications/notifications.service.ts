import { Injectable } from '@nestjs/common';

export interface Notification {
  id: number;
  type: 'unknown_card' | 'late_arrival' | 'after_hours';
  message: string;
  personnelName?: string;
  deviceName?: string;
  createdAt: Date;
  isRead: boolean;
}

@Injectable()
export class NotificationsService {
  private notifications: Notification[] = [];
  private nextId = 1;
  private readonly MAX_NOTIFICATIONS = 100;

  add(params: Omit<Notification, 'id' | 'createdAt' | 'isRead'>): void {
    this.notifications.unshift({
      ...params,
      id: this.nextId++,
      createdAt: new Date(),
      isRead: false,
    });

    if (this.notifications.length > this.MAX_NOTIFICATIONS) {
      this.notifications = this.notifications.slice(0, this.MAX_NOTIFICATIONS);
    }
  }

  getAll(): Notification[] {
    return this.notifications.slice(0, 50);
  }

  getUnreadCount(): number {
    return this.notifications.filter((n) => !n.isRead).length;
  }

  markAllRead(): void {
    for (const n of this.notifications) {
      n.isRead = true;
    }
  }
}
