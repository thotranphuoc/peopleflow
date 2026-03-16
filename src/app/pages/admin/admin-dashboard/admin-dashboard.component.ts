import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminStatsService } from '../../../core/services/admin-stats.service';
import type { AdminStats } from '../../../core/services/admin-stats.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboardComponent implements OnInit {
  protected readonly statsService = inject(AdminStatsService);

  protected readonly stats = signal<AdminStats | null>(null);
  protected readonly loading = signal(true);

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    const s = await this.statsService.getStats();
    this.stats.set(s);
    this.loading.set(false);
  }
}
