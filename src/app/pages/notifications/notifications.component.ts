import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { NotificationService } from '../../core/services/notification.service';
import type { Notification } from '../../core/models';

@Component({
  selector: 'app-notifications',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class NotificationsComponent implements OnInit {
  protected readonly notificationService = inject(NotificationService);

  protected readonly list = this.notificationService.list;
  protected readonly loading = signal(true);

  async ngOnInit(): Promise<void> {
    await this.notificationService.load();
    this.loading.set(false);
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleString('vi-VN');
  }

  protected async markRead(n: Notification): Promise<void> {
    if (!n.read_at) await this.notificationService.markRead(n.id);
  }

  protected async markAllRead(): Promise<void> {
    await this.notificationService.markAllRead();
  }
}
