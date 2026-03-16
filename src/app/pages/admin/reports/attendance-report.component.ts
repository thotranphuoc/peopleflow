import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { EmployeeService } from '../../../core/services/employee.service';
import { ReportService } from '../../../core/services/report.service';
import { ExportCsvService } from '../../../core/services/export-csv.service';
import type {
  AttendanceReportRow,
  AttendanceDayRow,
} from '../../../core/services/report.service';
import type { Department } from '../../../core/models';
import {
  AttendanceApprovalDialogComponent,
  type AttendanceApprovalDialogResult,
} from './attendance-approval-dialog.component';

type ViewMode = 'month' | 'day' | 'pending';

@Component({
  selector: 'app-attendance-report',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, DatePipe, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatDatepickerModule],
  templateUrl: './attendance-report.html',
  styleUrl: './attendance-report.scss',
})
export class AttendanceReportComponent implements OnInit {
  protected readonly employeeService = inject(EmployeeService);
  protected readonly reportService = inject(ReportService);
  protected readonly exportCsv = inject(ExportCsvService);
  private readonly dialog = inject(MatDialog);

  protected readonly viewMode = signal<ViewMode>('month');
  protected readonly month = signal<number>(new Date().getMonth() + 1);
  protected readonly year = signal<number>(new Date().getFullYear());
  /** Khoảng ngày cho tab Theo ngày (mặc định: cả tháng hiện tại). */
  protected readonly fromDate = signal<string>((() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  })());
  protected readonly toDate = signal<string>((() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  })());
  /** Date object cho Material datepicker (từ fromDate/toDate string). */
  protected readonly fromDateObj = computed(() => {
    const s = this.fromDate();
    return new Date(s + 'T12:00:00');
  });
  protected readonly toDateObj = computed(() => {
    const s = this.toDate();
    return new Date(s + 'T12:00:00');
  });
  protected readonly departmentId = signal<string | null>(null);
  protected readonly rows = signal<AttendanceReportRow[]>([]);
  protected readonly rowsByDay = signal<AttendanceDayRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly departments = signal<Department[]>([]);
  /** Ghi chú duyệt theo key employee_id + work_date (chỉ dòng pending). */
  protected readonly approvalNotes = signal<Record<string, string>>({});
  protected readonly approvingKey = signal<string | null>(null);

  protected readonly months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  protected readonly years = (() => {
    const y = new Date().getFullYear();
    return [y, y - 1];
  })();

  async ngOnInit(): Promise<void> {
    const depts = await this.employeeService.getDepartments();
    this.departments.set(depts);
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    if (this.viewMode() === 'day') {
      const data = await this.reportService.getAttendanceReportByDay(
        this.fromDate(),
        this.departmentId(),
        this.toDate()
      );
      this.rowsByDay.set(data);
    } else if (this.viewMode() === 'pending') {
      const data = await this.reportService.getPendingAttendances(
        this.departmentId(),
        this.month(),
        this.year()
      );
      this.rowsByDay.set(data);
    } else {
      const data = await this.reportService.getAttendanceReport(
        this.month(),
        this.year(),
        this.departmentId()
      );
      this.rows.set(data);
    }
    this.loading.set(false);
  }

  protected setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
    void this.load();
  }

  protected monthLabel(m: number): string {
    return `Tháng ${m}`;
  }

  /** Cập nhật fromDate/toDate khi chọn ngày từ Material datepicker. */
  protected onFromDateChange(d: Date | null): void {
    if (!d) return;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    this.fromDate.set(`${y}-${m}-${day}`);
  }

  protected onToDateChange(d: Date | null): void {
    if (!d) return;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    this.toDate.set(`${y}-${m}-${day}`);
  }

  protected formatTime(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  protected formatDuration(minutes: number | null): string {
    if (minutes == null) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}p`;
  }

  protected statusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Chờ duyệt',
      valid: 'Hợp lệ',
      violation: 'Vi phạm',
    };
    return map[status] ?? status;
  }

  protected rowKey(r: AttendanceDayRow): string {
    return `${r.employee_id}:${r.work_date}`;
  }

  protected setApprovalNote(key: string, value: string): void {
    this.approvalNotes.update((m) => ({ ...m, [key]: value }));
  }

  /** Mở dialog Duyệt/Từ chối (dùng ở view Chờ duyệt). */
  protected openApprovalDialog(r: AttendanceDayRow): void {
    const ref = this.dialog.open(AttendanceApprovalDialogComponent, {
      width: '400px',
      data: { row: r },
    });
    ref.afterClosed().subscribe(async (result: AttendanceApprovalDialogResult | undefined) => {
      if (!result) return;
      const key = this.rowKey(r);
      this.setApprovalNote(key, result.note ?? '');
      if (result.action === 'approve') await this.approveRow(r);
      else await this.rejectRow(r);
    });
  }

  protected async approveRow(r: AttendanceDayRow): Promise<void> {
    const key = this.rowKey(r);
    this.approvingKey.set(key);
    const note = this.approvalNotes()[key] ?? null;
    const err = await this.reportService.updateAttendanceStatus(r.employee_id, r.work_date, 'valid', note);
    this.approvingKey.set(null);
    if (err) alert(err);
    else {
      this.setApprovalNote(key, '');
      await this.load();
    }
  }

  protected async rejectRow(r: AttendanceDayRow): Promise<void> {
    const key = this.rowKey(r);
    this.approvingKey.set(key);
    const note = this.approvalNotes()[key] ?? null;
    const err = await this.reportService.updateAttendanceStatus(r.employee_id, r.work_date, 'violation', note);
    this.approvingKey.set(null);
    if (err) alert(err);
    else {
      this.setApprovalNote(key, '');
      await this.load();
    }
  }

  protected formatShortfall(minutes: number): string {
    if (minutes <= 0) return '0';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}p` : `${h}h`;
  }

  protected exportCsvReport(): void {
    const data = this.rows().map((r) => ({
      employee_code: r.employee_code,
      full_name: r.full_name,
      department_code: r.department_code ?? '',
      working_days_in_month: r.working_days_in_month,
      work_days: r.work_days,
      leave_days: r.leave_days,
      total_shortfall_minutes: r.total_shortfall_minutes,
    }));
    const filename = `bao-cao-cham-cong-${this.year()}-${String(this.month()).padStart(2, '0')}.csv`;
    this.exportCsv.download(data, filename);
  }

  protected exportCsvDayReport(): void {
    const data = this.rowsByDay().map((r) => ({
      employee_code: r.employee_code,
      full_name: r.full_name,
      department_code: r.department_code ?? '',
      work_date: r.work_date,
      check_in: r.check_in_time ?? '',
      check_out: r.check_out_time ?? '',
      total_work_minutes: r.total_work_minutes ?? '',
      status: r.status,
      supplement_reason: r.supplement_reason ?? '',
      approval_note: r.approval_note ?? '',
    }));
    const filename =
      this.viewMode() === 'pending'
        ? `cham-cong-cho-duyet-${this.year()}-${String(this.month()).padStart(2, '0')}.csv`
        : `cham-cong-ngay-${this.fromDate()}-den-${this.toDate()}.csv`;
    this.exportCsv.download(data, filename);
  }
}
