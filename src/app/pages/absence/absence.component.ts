import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { EmployeeService } from '../../core/services/employee.service';
import { AbsenceReportService, type AbsenceReportWithMembers } from '../../core/services/absence-report.service';
import type { Employee } from '../../core/models';

@Component({
  selector: 'app-absence',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
  ],
  templateUrl: './absence.html',
  styleUrl: './absence.scss',
})
export class AbsenceComponent implements OnInit {
  protected readonly employeeService = inject(EmployeeService);
  protected readonly absenceService = inject(AbsenceReportService);

  protected readonly employees = signal<Employee[]>([]);
  protected readonly showCreateForm = signal(false);
  protected readonly createReason = signal('');
  protected readonly createLocation = signal('');
  protected readonly createDate = signal<Date>(new Date());
  protected readonly createStartTime = signal<string>('08:00');
  protected readonly createEndTime = signal<string>('17:00');
  protected readonly createMemberIds = signal<string[]>([]);
  protected readonly createContactPhone = signal('');
  protected readonly createNote = signal('');
  protected readonly createSubmitting = signal(false);
  protected readonly createError = signal<string | null>(null);

  protected readonly myList = this.absenceService.myList;
  protected readonly managerList = this.absenceService.managerList;
  protected readonly allList = this.absenceService.allList;
  protected readonly loading = this.absenceService.loading;
  protected readonly isManager = this.employeeService.isManager;
  protected readonly isHrOrAdmin = this.employeeService.isHrOrAdmin;

  ngOnInit(): void {
    this.absenceService.loadMyReports();
    void this.loadEmployees();
    const emp = this.employeeService.currentEmployee();
    if (emp && (this.employeeService.isManager() ?? false)) {
      this.absenceService.loadForManager(emp.id);
    }
    if (this.employeeService.isHrOrAdmin()) {
      this.absenceService.loadAll();
    }
  }

  private async loadEmployees(): Promise<void> {
    const list = await this.employeeService.getEmployees();
    this.employees.set(list);
  }

  openCreate(): void {
    const today = new Date();
    this.createDate.set(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
    this.createStartTime.set('08:00');
    this.createEndTime.set('17:00');
    this.createReason.set('');
    this.createLocation.set('');
    this.createMemberIds.set([]);
    this.createContactPhone.set('');
    this.createNote.set('');
    this.createError.set(null);
    this.showCreateForm.set(true);
  }

  closeCreate(): void {
    this.showCreateForm.set(false);
  }

  protected buildDateTime(date: Date, time: string): string {
    const [h, m] = time.split(':').map(Number);
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h ?? 0, m ?? 0, 0);
    return d.toISOString();
  }

  async submitCreate(): Promise<void> {
    const reason = this.createReason().trim();
    if (!reason) {
      this.createError.set('Vui lòng nhập lý do / mục đích');
      return;
    }
    const start = this.buildDateTime(this.createDate(), this.createStartTime());
    const end = this.buildDateTime(this.createDate(), this.createEndTime());
    if (new Date(end).getTime() <= new Date(start).getTime()) {
      this.createError.set('Thời gian kết thúc phải sau thời gian bắt đầu');
      return;
    }
    this.createSubmitting.set(true);
    this.createError.set(null);
    const emp = this.employeeService.currentEmployee();
    const { error } = await this.absenceService.create({
      reason,
      location: this.createLocation() || null,
      start_time: start,
      end_time: end,
      member_employee_ids: this.createMemberIds().length > 0 ? this.createMemberIds() : undefined,
      contact_phone: this.createContactPhone() || null,
      note: this.createNote() || null,
      manager_id: emp?.manager_id ?? null,
    });
    this.createSubmitting.set(false);
    if (error) {
      this.createError.set(error);
      return;
    }
    this.closeCreate();
    const emp2 = this.employeeService.currentEmployee();
    if (emp2 && (this.employeeService.isManager() ?? false)) {
      await this.absenceService.loadForManager(emp2.id);
    }
    if (this.employeeService.isHrOrAdmin()) {
      await this.absenceService.loadAll();
    }
  }

  protected memberNames(report: AbsenceReportWithMembers): string {
    const emps = this.employees();
    const names = report.member_employee_ids
      .map((id) => emps.find((e) => e.id === id)?.full_name ?? id)
      .filter(Boolean);
    return names.length > 0 ? names.join(', ') : '—';
  }

  protected reporterName(report: AbsenceReportWithMembers): string {
    const emps = this.employees();
    const emp = emps.find((e) => e.id === report.reporter_id);
    return emp?.full_name ?? report.reporter_id;
  }

  /** Hiển thị thời gian báo vắng: cùng ngày thì chỉ hiện ngày 1 lần (VD: 3/7/26, 8:00 AM – 5:00 PM). */
  protected formatTimeRange(start: string, end: string): string {
    const s = new Date(start);
    const e = new Date(end);
    const sameDay =
      s.getDate() === e.getDate() &&
      s.getMonth() === e.getMonth() &&
      s.getFullYear() === e.getFullYear();
    if (sameDay) {
      return `${formatDate(start, 'M/d/yy, h:mm a', 'en-US')} – ${formatDate(end, 'h:mm a', 'en-US')}`;
    }
    return `${formatDate(start, 'M/d/yy, h:mm a', 'en-US')} – ${formatDate(end, 'M/d/yy, h:mm a', 'en-US')}`;
  }
}
