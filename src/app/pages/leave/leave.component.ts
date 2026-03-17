import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { DecimalPipe, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatRadioModule } from '@angular/material/radio';
import { EmployeeService } from '../../core/services/employee.service';
import { LeaveRequestService } from '../../core/services/leave-request.service';
import { LeaveTypeService } from '../../core/services/leave-type.service';
import { AttendanceConfigService } from '../../core/services/attendance-config.service';
import { HolidayService } from '../../core/services/holiday.service';
import { DURATION_LABELS, type LeaveRequest, type LeaveType, type LeaveDuration } from '../../core/models';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

type HalfDayPart = 'morning' | 'afternoon';

@Component({
  selector: 'app-leave',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
    MatRadioModule,
  ],
  templateUrl: './leave.html',
  styleUrl: './leave.scss',
})
export class LeaveComponent implements OnInit {
  protected readonly employeeService = inject(EmployeeService);
  protected readonly leaveService = inject(LeaveRequestService);
  protected readonly leaveTypeService = inject(LeaveTypeService);
  private readonly attendanceConfig = inject(AttendanceConfigService);
  private readonly holidayService = inject(HolidayService);

  protected readonly showCreateForm = signal(false);
  protected readonly createLeaveType = signal<LeaveType>('annual_leave');
  protected readonly createDuration = signal<LeaveDuration>('leave_full');
  protected readonly createDeductAnnual = signal(false);
  protected readonly createStartDate = signal<Date>(new Date());
  protected readonly createStartTime = signal<string>('08:00');
  protected readonly createEndDate = signal<Date>(new Date());
  protected readonly createEndTime = signal<string>('17:30');
  /** Nửa ngày: chọn buổi sáng/chiều. */
  protected readonly createHalfDayPart = signal<HalfDayPart>('morning');
  protected readonly createReason = signal('');
  protected readonly createSubmitting = signal(false);
  protected readonly createError = signal<string | null>(null);

  /** Cấu hình giờ làm (fallback nếu chưa load được). */
  protected readonly workStartTime = signal('08:00');
  protected readonly workEndTime = signal('17:30');
  protected readonly lunchStartTime = signal('12:00');
  protected readonly lunchEndTime = signal('13:30');
  protected readonly requiredMinutesPerDay = signal(480);

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

  async ngOnInit(): Promise<void> {
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

    const cfg = await this.attendanceConfig.get();
    if (cfg) {
      this.workStartTime.set(cfg.work_start_time.slice(0, 5));
      this.workEndTime.set(cfg.work_end_time.slice(0, 5));
      this.lunchStartTime.set(cfg.lunch_start_time.slice(0, 5));
      this.lunchEndTime.set(cfg.lunch_end_time.slice(0, 5));
      this.requiredMinutesPerDay.set(cfg.required_work_minutes_per_day ?? 480);
    }
  }

  openCreate(): void {
    const today = new Date();
    this.createLeaveType.set('annual_leave');
    this.createDuration.set('leave_full');
    this.createDeductAnnual.set(false);
    this.createStartDate.set(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
    this.createStartTime.set(this.workStartTime());
    this.createEndDate.set(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
    this.createEndTime.set(this.workEndTime());
    this.createHalfDayPart.set('morning');
    this.createReason.set('');
    this.createError.set(null);
    this.showCreateForm.set(true);
  }

  protected isSingleDayOnlyDuration(): boolean {
    const d = this.createDuration();
    return d === 'leave_half' || d === 'leave_hours';
  }

  protected onStartDateChanged(d: Date): void {
    this.createStartDate.set(d);
    if (this.isSingleDayOnlyDuration()) {
      this.createEndDate.set(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    }
  }

  private ymd(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private buildDateTimeFromDateAndTime(date: Date, time: string): string {
    const [h, m] = time.split(':').map(Number);
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h ?? 0, m ?? 0, 0);
    return d.toISOString();
  }

  private datesInRange(startYmd: string, endYmd: string): string[] {
    const list: string[] = [];
    const d = new Date(startYmd + 'T12:00:00Z');
    const endD = new Date(endYmd + 'T12:00:00Z');
    while (d <= endD) {
      list.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return list;
  }

  private isWeekend(ymd: string): boolean {
    const d = new Date(ymd + 'T12:00:00');
    const day = d.getDay();
    return day === 0 || day === 6;
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
    const leaveType = this.createLeaveType();
    const requestType = this.showDurationField() ? this.createDuration() : leaveType;
    const dur = this.createDuration();

    // Enforce same-day for half-day / hours
    if (dur === 'leave_half' || dur === 'leave_hours') {
      this.createEndDate.set(new Date(this.createStartDate().getFullYear(), this.createStartDate().getMonth(), this.createStartDate().getDate()));
    }

    let start: string;
    let end: string;
    let total: number;

    if (dur === 'leave_full') {
      const startYmd = this.ymd(this.createStartDate());
      const endYmd = this.ymd(this.createEndDate());
      start = this.buildDateTimeFromDateAndTime(this.createStartDate(), this.workStartTime());
      end = this.buildDateTimeFromDateAndTime(this.createEndDate(), this.workEndTime());

      const holidaySet = await this.holidayService.getHolidayDatesInRange(startYmd, endYmd);
      const workingDates = this.datesInRange(startYmd, endYmd).filter((d) => !this.isWeekend(d) && !holidaySet.has(d));
      total = workingDates.length * this.requiredMinutesPerDay();
      if (total <= 0) {
        this.createError.set('Khoảng ngày không có ngày làm việc hợp lệ (T7/CN/ngày lễ không tính)');
        return;
      }
    } else if (dur === 'leave_half') {
      const part = this.createHalfDayPart();
      const date = this.createStartDate();
      const ws = this.workStartTime();
      const we = this.workEndTime();
      const ls = this.lunchStartTime();
      const le = this.lunchEndTime();
      if (part === 'morning') {
        start = this.buildDateTimeFromDateAndTime(date, ws);
        end = this.buildDateTimeFromDateAndTime(date, ls);
        total = this.attendanceConfig.timeToMinutes(ls) - this.attendanceConfig.timeToMinutes(ws);
      } else {
        start = this.buildDateTimeFromDateAndTime(date, le);
        end = this.buildDateTimeFromDateAndTime(date, we);
        total = this.attendanceConfig.timeToMinutes(we) - this.attendanceConfig.timeToMinutes(le);
      }
      if (total <= 0) {
        this.createError.set('Cấu hình giờ làm/giờ nghỉ trưa không hợp lệ');
        return;
      }
    } else {
      // leave_hours (same day)
      start = this.buildDateTimeFromDateAndTime(this.createStartDate(), this.createStartTime());
      end = this.buildDateTimeFromDateAndTime(this.createStartDate(), this.createEndTime());
      total = this.totalMinutesFromRange(start, end);
      if (total <= 0) {
        this.createError.set('Giờ kết thúc phải sau giờ bắt đầu');
        return;
      }
    }

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

  /** Phút từ 0h theo ISO time (dùng so sánh sáng/chiều). */
  private timeToMinutes(iso: string): number {
    const d = new Date(iso);
    return d.getHours() * 60 + d.getMinutes();
  }

  /** Format HH:mm từ ISO. */
  private formatHHmm(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  protected requestTimeLabel(r: LeaveRequest): string {
    const rt = r.request_type;
    const startDate = r.start_time?.slice(0, 10) ?? '';
    const endDate = r.end_time?.slice(0, 10) ?? '';
    const startTimeStr = r.start_time ? this.formatHHmm(r.start_time) : '';
    const endTimeStr = r.end_time ? this.formatHHmm(r.end_time) : '';

    if (rt === 'leave_full') {
      if (startDate && endDate && startDate !== endDate) return `${startDate} → ${endDate}`;
      return startDate || '—';
    }
    if (rt === 'leave_half') {
      const startM = r.start_time ? this.timeToMinutes(r.start_time) : 0;
      const endM = r.end_time ? this.timeToMinutes(r.end_time) : 0;
      const lunchStartM = this.attendanceConfig.timeToMinutes(this.lunchStartTime());
      const lunchEndM = this.attendanceConfig.timeToMinutes(this.lunchEndTime());
      const part =
        endM <= lunchStartM ? 'Nghỉ buổi sáng' :
        startM >= lunchEndM ? 'Nghỉ buổi chiều' :
        'Nghỉ nửa ngày';
      const range = startTimeStr && endTimeStr ? ` ${startTimeStr}–${endTimeStr}` : '';
      return startDate ? `${startDate} (${part}${range})` : `${part}${range}`.trim();
    }
    if (rt === 'leave_hours') {
      return startDate ? `${startDate} (${startTimeStr} → ${endTimeStr})` : `${startTimeStr} → ${endTimeStr}`;
    }
    return r.start_time && r.end_time ? `${r.start_time} → ${r.end_time}` : '—';
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
