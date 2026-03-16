import { ChangeDetectionStrategy, Component, effect, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { EmployeeService } from '../../core/services/employee.service';
import { NotificationService } from '../../core/services/notification.service';
import { OfflineQueueService } from '../../core/services/offline-queue.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayoutComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly employeeService = inject(EmployeeService);
  protected readonly notificationService = inject(NotificationService);
  private readonly offlineQueue = inject(OfflineQueueService);
  private readonly platformId = inject(PLATFORM_ID);

  protected readonly menuOpen = signal(false);

  constructor() {
    effect(() => {
      if (typeof document !== 'undefined') {
        document.body.classList.toggle('menu-open', this.menuOpen());
      }
    });
  }

  ngOnInit(): void {
    this.employeeService.refreshCurrentEmployee();
    void this.notificationService.load();
    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('online', () => this.offlineQueue.syncAll());
      void this.offlineQueue.syncAll();
    }
  }

  protected openMenu(): void {
    this.menuOpen.set(true);
  }
  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  /** Bottom nav: Trang chủ, Chấm công, Nghỉ phép, Báo vắng */
  protected bottomNavItems = [
    { path: '/dashboard', label: 'Trang chủ', icon: 'home' },
    { path: '/timesheet', label: 'Chấm công', icon: 'schedule' },
    { path: '/leave', label: 'Nghỉ phép', icon: 'event_available' },
    { path: '/absence', label: 'Báo vắng', icon: 'location_off' },
  ];

  /** Hamburger menu: Phiếu lương, Heat map, Cá nhân + Notifications, Quản trị */
  protected menuNavItems = [
    { path: '/payslip', label: 'Phiếu lương', icon: 'payments' },
    { path: '/attendance-heatmap', label: 'Heat map', icon: 'grid_view' },
    { path: '/profile', label: 'Cá nhân', icon: 'person' },
  ];

  protected navItems = [
    ...this.bottomNavItems,
    ...this.menuNavItems,
  ];
}
