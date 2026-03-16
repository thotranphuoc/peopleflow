import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { EmployeeService } from '../../../core/services/employee.service';
import { LeaveRequestService } from '../../../core/services/leave-request.service';
import { LeaveTypeService } from '../../../core/services/leave-type.service';
import type { Department, Employee, LeaveRequest } from '../../../core/models';
import {
  LeaveRequestEditDialogComponent,
  type LeaveRequestEditDialogResult,
} from './leave-request-edit-dialog.component';

@Component({
  selector: 'app-leave-requests-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
  ],
  templateUrl: './leave-requests-admin.html',
  styleUrl: './leave-requests-admin.scss',
})
export class LeaveRequestsAdminComponent implements OnInit {
  private readonly employeeService = inject(EmployeeService);
  private readonly leaveService = inject(LeaveRequestService);
  private readonly leaveTypeService = inject(LeaveTypeService);
  private readonly dialog = inject(MatDialog);

  protected readonly loading = signal(false);
  protected readonly departments = signal<Department[]>([]);
  protected readonly employees = signal<Employee[]>([]);
  protected readonly list = signal<LeaveRequest[]>([]);

  protected readonly fromDate = signal<string>('');
  protected readonly toDate = signal<string>('');
  protected readonly fromDateObj = computed(() => (this.fromDate() ? new Date(this.fromDate() + 'T12:00:00') : new Date()));
  protected readonly toDateObj = computed(() => (this.toDate() ? new Date(this.toDate() + 'T12:00:00') : new Date()));
  protected readonly departmentId = signal<string | null>(null);
  protected readonly employeeId = signal<string | null>(null);
  protected readonly statusFilter = signal<'all' | 'pending' | 'approved' | 'rejected'>('all');

  protected onFromDateChange(d: Date | null): void {
    if (!d) return;
    this.fromDate.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  protected onToDateChange(d: Date | null): void {
    if (!d) return;
    this.toDate.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }

  async ngOnInit(): Promise<void> {
    await this.leaveTypeService.loadAll();
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
    const empId = this.employeeId();

    let query = (this.leaveService as any)['supabase']['supabase']
      .from('leave_requests')
      .select('*')
      .gte('start_time', from + 'T00:00:00')
      .lte('end_time', to + 'T23:59:59')
      .order('created_at', { ascending: false });
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
    let rows = (data ?? []) as LeaveRequest[];
    const deptId = this.departmentId();
    if (deptId) {
      const ids = this.employees().filter((e) => e.department_id === deptId).map((e) => e.id);
      rows = rows.filter((r) => ids.includes(r.employee_id));
    }
    const status = this.statusFilter();
    if (status !== 'all') {
      rows = rows.filter((r) => r.status === status);
    }
    this.list.set(rows);
  }

  protected employeeLabel(id: string): string {
    const emp = this.employees().find((e) => e.id === id);
    if (!emp) return id;
    return `${emp.full_name} (${emp.employee_code})`;
  }

  protected openEditDialog(row: LeaveRequest): void {
    const ref = this.dialog.open(LeaveRequestEditDialogComponent, {
      width: '440px',
      data: {
        row,
        employees: this.employees().map((e) => ({ id: e.id, employee_code: e.employee_code, full_name: e.full_name })),
      },
    });
    ref.afterClosed().subscribe(async (res: LeaveRequestEditDialogResult) => {
      if (!res) return;
      if (res.action === 'delete') {
        const { error } = await (this.leaveService as any)['supabase']['supabase']
          .from('leave_requests')
          .delete()
          .eq('id', row.id);
        if (error) {
          alert(error.message);
          return;
        }
      } else if (res.action === 'save') {
        const { patch } = res;
        const { error } = await (this.leaveService as any)['supabase']['supabase']
          .from('leave_requests')
          .update({
            employee_id: patch.employee_id,
            manager_id: patch.manager_id,
            request_type: patch.request_type,
            leave_type: patch.leave_type,
            deduct_annual_leave: patch.deduct_annual_leave,
            start_time: patch.start_time,
            end_time: patch.end_time,
            total_minutes_requested: patch.total_minutes_requested,
            reason: patch.reason,
            status: patch.status,
            manager_note: patch.manager_note,
          })
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

