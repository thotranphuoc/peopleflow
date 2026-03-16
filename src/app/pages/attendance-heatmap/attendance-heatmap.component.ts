import { ChangeDetectionStrategy, Component, effect, inject, input, signal, computed, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../core/services/auth.service';
import { AttendanceHeatmapService, HeatMapDay } from '../../core/services/attendance-heatmap.service';
import { DayDetailDialogComponent, type DayDetailDialogData } from '../timesheet/day-detail-dialog.component';

type ViewMode = 'month' | 'year';

@Component({
  selector: 'app-attendance-heatmap',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './attendance-heatmap.html',
  styleUrl: './attendance-heatmap.scss',
})
export class AttendanceHeatmapComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  protected readonly heatmapService = inject(AttendanceHeatmapService);

  /** Khi set (admin): xem heat map của nhân viên này. Khi null: xem của mình. */
  readonly employeeId = input<string | null>(null);

  protected readonly viewMode = signal<ViewMode>('month');

  constructor() {
    effect(() => {
      this.employeeId();
      this.year();
      this.month();
      this.viewMode();
      void this.load();
    });
  }
  protected readonly year = signal<number>(new Date().getFullYear());
  protected readonly month = signal<number>(new Date().getMonth() + 1);
  protected readonly data = signal<HeatMapDay[]>([]);
  protected readonly loading = signal(false);

  protected readonly years = (() => {
    const y = new Date().getFullYear();
    return [y, y - 1];
  })();
  protected readonly months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  protected readonly monthGrid = computed(() => {
    const list = this.data();
    const m = this.month();
    const y = this.year();
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    // getDay(): 0=CN, 1=T2, ... 6=T7. Cột đầu là T2 → padding = (getDay + 6) % 7
    const startPad = (first.getDay() + 6) % 7;
    const daysInMonth = last.getDate();
    const byDate = new Map(list.map((d) => [d.date, d]));
    const rows: (HeatMapDay | null)[][] = [];
    let row: (HeatMapDay | null)[] = [];
    for (let i = 0; i < startPad; i++) row.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      row.push(byDate.get(dateStr) ?? { date: dateStr, effectiveMinutes: null, isLeave: false, leaveTypeLabel: null, penaltyAmount: 0, check_in_time: null, check_out_time: null });
      if (row.length === 7) {
        rows.push(row);
        row = [];
      }
    }
    if (row.length) {
      while (row.length < 7) row.push(null);
      rows.push(row);
    }
    return rows;
  });

  protected readonly yearGrid = computed(() => {
    const list = this.data();
    const y = this.year();
    const byDate = new Map(list.map((d) => [d.date, d]));
    const start = new Date(y, 0, 1);
    const end = new Date(y, 11, 31);
    // Thứ 2 đầu tuần: về thứ Hai của tuần chứa 1/1 (hoặc 1/1 nếu đã là T2)
    const startDay = start.getDay();
    const startDate = new Date(start);
    startDate.setDate(startDate.getDate() - (startDay + 6) % 7);
    const cells: (HeatMapDay | null)[][] = [];
    for (let week = 0; week < 53; week++) {
      const row: (HeatMapDay | null)[] = [];
      for (let dow = 0; dow < 7; dow++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + week * 7 + dow);
        const dateStr = d.toISOString().slice(0, 10);
        if (d >= start && d <= end) {
          row.push(byDate.get(dateStr) ?? { date: dateStr, effectiveMinutes: null, isLeave: false, leaveTypeLabel: null, penaltyAmount: 0, check_in_time: null, check_out_time: null });
        } else {
          row.push(null);
        }
      }
      cells.push(row);
    }
    return cells;
  });

  /** Thứ 2 (Monday) là cột đầu tuần, Chủ nhật là cột cuối. */
  protected readonly weekdayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  ngOnInit(): void {
    // load() chạy trong effect khi employeeId/year/month/viewMode thay đổi
  }

  protected setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  protected async load(): Promise<void> {
    const uid = this.employeeId() ?? this.auth.user()?.id;
    if (!uid) return;
    this.loading.set(true);
    const month = this.viewMode() === 'month' ? this.month() : undefined;
    const data = await this.heatmapService.getHeatMapData(uid, this.year(), month);
    this.data.set(data);
    this.loading.set(false);
  }

  protected async changeYear(y: number): Promise<void> {
    this.year.set(y);
    await this.load();
  }

  protected async changeMonth(m: number): Promise<void> {
    this.month.set(m);
    await this.load();
  }

  protected cellColor(day: HeatMapDay | null): string {
    if (!day) return 'transparent';
    return this.heatmapService.getDayColor(day);
  }

  protected cellTitle(day: HeatMapDay | null): string {
    if (!day) return '';
    const parts: string[] = [day.date];
    if (day.effectiveMinutes != null) {
      const h = Math.floor(day.effectiveMinutes / 60);
      const m = day.effectiveMinutes % 60;
      parts.push(`${h}h${m}p ${day.effectiveMinutes >= 480 ? '✓' : day.effectiveMinutes < 360 ? '✗' : '~'}`);
    }
    if (day.penaltyAmount > 0) parts.push(`Trừ: ${day.penaltyAmount.toLocaleString('vi-VN')}đ`);
    if (day.leaveTypeLabel) parts.push(day.leaveTypeLabel);
    return parts.join(' · ');
  }

  /** Dòng 1: tổng giờ làm. */
  protected formatDayHours(day: HeatMapDay | null): string {
    if (!day) return '';
    if (day.isLeave) return 'P';
    if (day.effectiveMinutes == null) return '—';
    const h = Math.floor(day.effectiveMinutes / 60);
    const m = day.effectiveMinutes % 60;
    return m > 0 ? `${h}h${m}` : `${h}h`;
  }

  /** Dòng 2: tiền bị trừ (đi trễ). */
  protected formatPenalty(day: HeatMapDay | null): string {
    if (!day || day.penaltyAmount <= 0) return '—';
    if (day.penaltyAmount >= 1000) return `Trừ: ${(day.penaltyAmount / 1000).toFixed(0)}k`;
    return `Trừ: ${day.penaltyAmount}`;
  }

  /** Dòng 3: loại nghỉ phép. */
  protected formatLeaveType(day: HeatMapDay | null): string {
    if (!day?.leaveTypeLabel) return '—';
    return day.leaveTypeLabel;
  }

  onDayClick(day: HeatMapDay | null, _event: Event): void {
    if (!day?.date) return;
    const hasDetail = day.isLeave && day.leaveTypeLabel || day.check_in_time || day.check_out_time;
    if (!hasDetail) return;
    const durationLabel = day.effectiveMinutes != null
      ? (day.effectiveMinutes % 60 > 0
        ? `${Math.floor(day.effectiveMinutes / 60)}h ${day.effectiveMinutes % 60}m`
        : `${Math.floor(day.effectiveMinutes / 60)}h`)
      : null;
    this.dialog.open(DayDetailDialogComponent, {
      data: {
        date: day.date,
        leaveLabel: day.isLeave ? day.leaveTypeLabel : null,
        checkInTime: day.check_in_time ?? null,
        checkOutTime: day.check_out_time ?? null,
        durationLabel,
      } satisfies DayDetailDialogData,
      width: '320px',
    });
  }
}
