import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { DatePipe, DecimalPipe, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { EmployeeService } from '../../core/services/employee.service';
import { LeaveRequestService } from '../../core/services/leave-request.service';
import { LeaveTypeService } from '../../core/services/leave-type.service';
import { DURATION_LABELS, type LeaveRequest, type LeaveType, type LeaveDuration } from '../../core/models';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

@Component({
  selector: 'app-leave',
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
    MatCheckboxModule,
    MatDialogModule,
    MatDatepickerModule,
  ],
  templateUrl: './leave.html',
  styleUrl: './leave.scss',
})
export class LeaveComponent implements OnInit {
  protected readonly employeeService = inject(EmployeeService);
  protected readonly leaveService = inject(LeaveRequestService);
  protected readonly leaveTypeService = inject(LeaveTypeService);

  protected readonly showCreateForm = signal(false);
  protected readonly createLeaveType = signal<LeaveType>('annual_leave');
  protected readonly createDuration = signal<LeaveDuration>('leave_full');
  protected readonly createDeductAnnual = signal(false);
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
  protected readonly isManager = this.employeeService.isManager;

  protected readonly pendingList = this.leaveService.pendingForManager;

  readonly leaveTypeLabels = this.leaveTypeService.labelsMap;
  readonly durationLabels = DURATION_LABELS;
  readonly statusLabels = STATUS_LABELS;
  readonly leaveTypesWithDuration = this.leaveTypeService.typesWithDuration;

  protected readonly leaveTypeOptions = this.leaveTypeService.formVisibleTypes;

  protected readonly currentYear = new Date().getFullYear();

  protected showDurationField(): boolean {
    return this.leaveTypeService.hasDuration(this.createLeaveType());
  }
  protected showDeductAnnualCheckbox(): boolean {
    return this.leaveTypeService.showDeductAnnualCheckbox(this.createLeaveType());
  }

  ngOnInit(): void {
    this.leaveTypeService.loadAll();
    this.leaveService.loadMyRequests();
    const uid = this.employeeService.currentEmployee()?.id;
    if (uid) {
      this.leaveService.loadLeaveBalance(uid, this.currentYear);
    }
    const emp = this.employeeService.currentEmployee();
    if (emp && (this.employeeService.isManager() ?? false)) {
      this.leaveService.loadPendingForManager(emp.id);
    }
  }

  openCreate(): void {
    const today = new Date();
    this.createLeaveType.set('annual_leave');
    this.createDuration.set('leave_full');
    this.createDeductAnnual.set(false);
    this.createStartDate.set(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
    this.createStartTime.set('08:00');
    this.createEndDate.set(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
    this.createEndTime.set('17:00');
    this.createReason.set('');
    this.createError.set(null);
    this.showCreateForm.set(true);
  }

  private buildDateTimeFromDateAndTime(date: Date, time: string): string {
    const [h, m] = time.split(':').map(Number);
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h ?? 0, m ?? 0, 0);
    return d.toISOString();
  }

  closeCreate(): void {
    this.showCreateForm.set(false);
  }

  protected totalMinutesFromRange(start: string, end: string): number {
    if (!start || !end) return 0;
    const a = new Date(start).getTime();
    const b = new Date(end).getTime();
    return Math.round((b - a) / 60000);
  }

  async submitCreate(): Promise<void> {
    const start = this.buildDateTimeFromDateAndTime(this.createStartDate(), this.createStartTime());
    const end = this.buildDateTimeFromDateAndTime(this.createEndDate(), this.createEndTime());
    const total = this.totalMinutesFromRange(start, end);
    if (total <= 0) {
      this.createError.set('Thời gian kết thúc phải sau thời gian bắt đầu');
      return;
    }
    const leaveType = this.createLeaveType();
    const requestType = this.showDurationField()
      ? this.createDuration()
      : leaveType;
    this.createSubmitting.set(true);
    this.createError.set(null);
    const emp = this.employeeService.currentEmployee();
    const { error } = await this.leaveService.create({
      leave_type: leaveType,
      request_type: requestType as LeaveRequest['request_type'],
      start_time: start,
      end_time: end,
      total_minutes_requested: total,
      reason: this.createReason() || undefined,
      manager_id: emp?.manager_id ?? undefined,
      deduct_annual_leave: this.showDeductAnnualCheckbox() ? this.createDeductAnnual() : undefined,
    });
    this.createSubmitting.set(false);
    if (error) {
      this.createError.set(error);
      return;
    }
    this.closeCreate();
    if (leaveType === 'annual_leave') {
      const uid = this.employeeService.currentEmployee()?.id;
      if (uid) this.leaveService.loadLeaveBalance(uid, this.currentYear);
    }
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

  async approve(id: string): Promise<void> {
    await this.leaveService.approve(id);
  }

  async reject(id: string): Promise<void> {
    await this.leaveService.reject(id);
  }

  protected requestLabel(r: LeaveRequest): string {
    const typeLabel = this.leaveTypeService.getLabel(r.leave_type);
    if (this.leaveTypeService.hasDuration(r.leave_type) && (r.request_type === 'leave_full' || r.request_type === 'leave_half' || r.request_type === 'leave_hours')) {
      return `${typeLabel} (${DURATION_LABELS[r.request_type]})`;
    }
    return typeLabel;
  }

  /** Số ngày nghỉ (từ total_minutes_requested, 480 phút = 1 ngày). */
  protected leaveDaysLabel(r: LeaveRequest): string {
    const mins = r.total_minutes_requested ?? 0;
    if (mins >= 480) {
      const days = (mins / 480).toFixed(1);
      return `${days} ngày`;
    }
    return `${mins} phút`;
  }

}
