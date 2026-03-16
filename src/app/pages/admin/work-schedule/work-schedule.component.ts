import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { LOCALE_ID } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { WorkScheduleService } from '../../../core/services/work-schedule.service';
import type { WorkSchedule } from '../../../core/models';

/** Short weekday names by locale (0=Sun .. 6=Sat). */
function getWeekdayShortNames(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const out: string[] = [];
  for (let d = 0; d < 7; d++) {
    const date = new Date(2024, 0, 7 + d);
    out.push(formatter.format(date));
  }
  return out;
}

@Component({
  selector: 'app-work-schedule',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule],
  templateUrl: './work-schedule.html',
  styleUrl: './work-schedule.scss',
})
export class WorkScheduleComponent implements OnInit {
  private readonly locale = inject(LOCALE_ID);
  protected readonly workScheduleService = inject(WorkScheduleService);

  protected readonly list = signal<WorkSchedule[]>([]);
  protected readonly loading = signal(true);
  protected readonly message = signal<string | null>(null);
  protected readonly savingId = signal<string | null>(null);

  private readonly localeStr = typeof this.locale === 'string' ? this.locale : 'en';
  private readonly weekdayShort = getWeekdayShortNames(this.localeStr);
  private readonly halfDayLabel = this.localeStr.startsWith('vi') ? 'nửa ngày' : 'half';

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.message.set(null);
    const items = await this.workScheduleService.getAll();
    this.list.set(items);
    this.loading.set(false);
  }

  protected async setAsDefault(schedule: WorkSchedule): Promise<void> {
    if (schedule.is_default) return;
    this.savingId.set(schedule.id);
    this.message.set(null);
    const err = await this.workScheduleService.setDefault(schedule.id);
    this.savingId.set(null);
    if (err) {
      this.message.set('Lỗi: ' + err);
      return;
    }
    this.message.set(`Đã đặt "${schedule.name}" làm lịch mặc định.`);
    await this.load();
  }

  protected dayLabel(s: WorkSchedule): string {
    const parts: string[] = [];
    if (s.sunday) parts.push(this.weekdayShort[0]);
    if (s.monday) parts.push(this.weekdayShort[1]);
    if (s.tuesday) parts.push(this.weekdayShort[2]);
    if (s.wednesday) parts.push(this.weekdayShort[3]);
    if (s.thursday) parts.push(this.weekdayShort[4]);
    if (s.friday) parts.push(this.weekdayShort[5]);
    if (s.saturday) parts.push(s.saturday_half_only ? `${this.weekdayShort[6]} (${this.halfDayLabel})` : this.weekdayShort[6]);
    return parts.length ? parts.join(', ') : '—';
  }
}
