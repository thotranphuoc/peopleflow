import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { EmployeeService } from '../../../core/services/employee.service';
import { AttendanceService } from '../../../core/services/attendance.service';
import type { Department, Attendance, Employee } from '../../../core/models';
import {
  AttendanceEditDialogComponent,
  type AttendanceEditDialogResult,
} from './attendance-edit-dialog.component';

@Component({
  selector: 'app-attendances-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, FormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatDatepickerModule, MatDialogModule],
  templateUrl: './attendances-admin.html',
  styleUrl: './attendances-admin.scss',
})
export class AttendancesAdminComponent implements OnInit {
  private readonly employeeService = inject(EmployeeService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly dialog = inject(MatDialog);

  protected readonly loading = signal(false);
  protected readonly departments = signal<Department[]>([]);
  protected readonly list = signal<Attendance[]>([]);
  protected readonly employees = signal<Employee[]>([]);

  protected readonly fromDate = signal<string>('');
  protected readonly toDate = signal<string>('');
  protected readonly fromDateObj = computed(() => (this.fromDate() ? new Date(this.fromDate() + 'T12:00:00') : new Date()));
  protected readonly toDateObj = computed(() => (this.toDate() ? new Date(this.toDate() + 'T12:00:00') : new Date()));
  protected readonly departmentId = signal<string | null>(null);
  protected readonly employeeId = signal<string | null>(null);

  protected onFromDateChange(d: Date | null): void {
    if (!d) return;
    this.fromDate.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  protected onToDateChange(d: Date | null): void {
    if (!d) return;
    this.toDate.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }

  async ngOnInit(): Promise<void> {
    const depts = await this.employeeService.getDepartments();
    this.departments.set(depts);
    const emps = await this.employeeService.getEmployees();
    this.employees.set(emps);
    const today = new Date();
    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const first = `${ym}-01`;
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const last = `${ym}-${String(lastDay).padStart(2, '0')}`;
    this.fromDate.set(first);
    this.toDate.set(last);
    await this.search();
  }

  protected async search(): Promise<void> {
    this.loading.set(true);
    const from = this.fromDate();
    const to = this.toDate();
    const deptId = this.departmentId();
    const empId = this.employeeId();
    let query = this.attendanceService['supabase']['supabase']
      .from('attendances')
      .select('*')
      .gte('work_date', from)
      .lte('work_date', to)
      .order('work_date', { ascending: true });
    if (empId) {
      query = query.eq('employee_id', empId);
    }
    const { data, error } = await query;
    this.loading.set(false);
    if (error) {
      alert(error.message);
      this.list.set([]);
      return;
    }
    let rows = (data ?? []) as Attendance[];
    if (deptId) {
      const ids = this.employees().filter((e) => e.department_id === deptId).map((e) => e.id);
      rows = rows.filter((r) => ids.includes(r.employee_id));
    }
    this.list.set(rows);
  }

  protected employeeLabel(id: string): string {
    const emp = this.employees().find((e) => e.id === id);
    if (!emp) return id;
    return `${emp.full_name} (${emp.employee_code})`;
  }

  protected openEditDialog(row: Attendance): void {
    const ref = this.dialog.open(AttendanceEditDialogComponent, {
      width: '440px',
      data: {
        row,
        employees: this.employees().map((e) => ({ id: e.id, employee_code: e.employee_code, full_name: e.full_name })),
      },
    });
    ref.afterClosed().subscribe(async (res: AttendanceEditDialogResult) => {
      if (!res) return;
      if (res.action === 'save') {
        const { error } = await this.attendanceService['supabase']['supabase']
          .from('attendances')
          .update(res.patch)
          .eq('id', row.id);
        if (error) {
          alert(error.message);
          return;
        }
      } else if (res.action === 'delete') {
        const { error } = await this.attendanceService['supabase']['supabase']
          .from('attendances')
          .delete()
          .eq('id', row.id);
        if (error) {
          alert(error.message);
          return;
        }
      }
      await this.search();
    });
  }
}

