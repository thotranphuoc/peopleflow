import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { DatePipe, DecimalPipe, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { EmployeeService } from '../../core/services/employee.service';
import { LeaveRequestService } from '../../core/services/leave-request.service';
import { DURATION_LABELS, type LeaveDuration, type LeaveRequest } from '../../core/models';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

@Component({
  selector: 'app-annual-leave',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    KeyValuePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
  ],
  templateUrl: './annual-leave.html',
  styleUrl: './annual-leave.scss',
})
export class AnnualLeaveComponent implements OnInit {
  protected readonly employeeService = inject(EmployeeService);
  protected readonly leaveService = inject(LeaveRequestService);

  protected readonly showCreateForm = signal(false);
  protected readonly createDuration = signal<LeaveDuration>('leave_full');
  protected readonly createStartDate = signal<Date>(new Date());
  protected readonly createStartTime = signal<string>('08:00');
  protected readonly createEndDate = signal<Date>(new Date());
  protected readonly createEndTime = signal<string>('17:00');
  protected readonly createReason = signal('');
  protected readonly createSubmitting = signal(false);
  protected readonly createError = signal<string | null>(null);

  protected readonly balance = this.leaveService.balance;
  protected readonly list = this.leaveService.list;
  protected readonly loading = this.leaveService.loading;

  protected readonly annualList = computed(() =>
    this.list().filter((r: LeaveRequest) => r.leave_type === 'annual_leave')
  );

  protected readonly currentYear = new Date().getFullYear();
  readonly durationLabels = DURATION_LABELS;
  readonly statusLabels = STATUS_LABELS;

  ngOnInit(): void {
    this.leaveService.loadMyRequests();
    const uid = this.employeeService.currentEmployee()?.id;
    if (uid) {
      this.leaveService.loadLeaveBalance(uid, this.currentYear);
    }
  }

  openCreate(): void {
    const today = new Date();
    this.createStartDate.set(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
    this.createStartTime.set('08:00');
    this.createEndDate.set(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
    this.createEndTime.set('17:00');
    this.createReason.set('');
    this.createError.set(null);
    this.showCreateForm.set(true);
  }

  closeCreate(): void {
    this.showCreateForm.set(false);
  }

  private buildDateTimeFromDateAndTime(date: Date, time: string): string {
    const [h, m] = time.split(':').map(Number);
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h ?? 0, m ?? 0, 0);
    return d.toISOString();
  }

  protected totalMinutesFromRange(start: string, end: string): number {
    if (!start || !end) return 0;
    return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  }

  async submitCreate(): Promise<void> {
    const start = this.buildDateTimeFromDateAndTime(this.createStartDate(), this.createStartTime());
    const end = this.buildDateTimeFromDateAndTime(this.createEndDate(), this.createEndTime());
    const total = this.totalMinutesFromRange(start, end);
    if (total <= 0) {
      this.createError.set('Thời gian kết thúc phải sau thời gian bắt đầu');
      return;
    }
    this.createSubmitting.set(true);
    this.createError.set(null);
    const emp = this.employeeService.currentEmployee();
    const { error } = await this.leaveService.create({
      leave_type: 'annual_leave',
      request_type: this.createDuration(),
      start_time: start,
      end_time: end,
      total_minutes_requested: total,
      reason: this.createReason() || undefined,
      manager_id: emp?.manager_id ?? undefined,
    });
    this.createSubmitting.set(false);
    if (error) {
      this.createError.set(error);
      return;
    }
    this.closeCreate();
    const uid = this.employeeService.currentEmployee()?.id;
    if (uid) this.leaveService.loadLeaveBalance(uid, this.currentYear);
  }

  protected remainingMinutes(): number {
    const b = this.balance();
    if (!b) return 0;
    return Math.max(0, b.total_minutes - b.used_minutes);
  }

  protected balanceDays(): string {
    const b = this.balance();
    if (!b) return '—';
    const totalDays = (b.total_minutes / 480).toFixed(1);
    const usedDays = (b.used_minutes / 480).toFixed(1);
    const rem = Math.max(0, b.total_minutes - b.used_minutes);
    const remDays = (rem / 480).toFixed(1);
    return `${remDays} / ${totalDays} ngày (đã dùng ${usedDays})`;
  }

  protected durationLabel(r: LeaveRequest): string {
    const t = r.request_type;
    if (t === 'leave_full' || t === 'leave_half' || t === 'leave_hours') return DURATION_LABELS[t];
    return t;
  }
}
