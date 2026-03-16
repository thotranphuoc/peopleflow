import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
  computed,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PendingUsersService, type PendingUser } from '../../../core/services/pending-users.service';
import { EmployeeService } from '../../../core/services/employee.service';
import type { Department, Employee } from '../../../core/models';

@Component({
  selector: 'app-pending-users',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './pending-users.html',
  styleUrl: './pending-users.scss',
})
export class PendingUsersComponent implements OnInit {
  protected readonly pendingService = inject(PendingUsersService);
  private readonly employeeService = inject(EmployeeService);

  protected readonly list = this.pendingService.list;
  protected readonly loading = this.pendingService.loading;
  protected readonly departments = signal<Department[]>([]);
  protected readonly employees = signal<Employee[]>([]);

  protected readonly showFormFor = signal<PendingUser | null>(null);
  protected readonly formCode = signal('');
  protected readonly formName = signal('');
  protected readonly formRole = signal<'employee' | 'manager' | 'hr' | 'admin'>('employee');
  protected readonly formDepartmentId = signal<string | null>(null);
  protected readonly formManagerId = signal<string | null>(null);
  protected readonly formSubmitting = signal(false);
  protected readonly formError = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    this.pendingService.load();
    const depts = await this.employeeService.getDepartments();
    this.departments.set(depts);
    const emps = await this.employeeService.getEmployees();
    this.employees.set(emps);
  }

  openForm(p: PendingUser): void {
    this.showFormFor.set(p);
    this.formCode.set(this.suggestNextEmployeeCode());
    this.formName.set(p.email.split('@')[0] ?? '');
    this.formRole.set('employee');
    this.formDepartmentId.set(null);
    this.formManagerId.set(null);
    this.formError.set(null);
  }

  /** Gợi ý mã NV tiếp theo (NV001, NV002, ...). */
  private suggestNextEmployeeCode(): string {
    const emps = this.employees();
    const numbers = emps
      .map((e) => e.employee_code.match(/^NV(\d+)$/i)?.[1])
      .filter((n): n is string => !!n)
      .map((n) => parseInt(n, 10));
    const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    return 'NV' + String(next).padStart(3, '0');
  }

  closeForm(): void {
    this.showFormFor.set(null);
  }

  managersForSelect = computed(() => {
    const emps = this.employees();
    return emps.filter((e) => e.role === 'manager' || e.role === 'hr' || e.role === 'admin');
  });

  async submitForm(): Promise<void> {
    const p = this.showFormFor();
    if (!p) return;
    const code = this.formCode().trim();
    const name = this.formName().trim();
    if (!code || !name) {
      this.formError.set('Mã NV và Họ tên không để trống.');
      return;
    }
    this.formSubmitting.set(true);
    this.formError.set(null);
    const { error } = await this.pendingService.addAsEmployee({
      userId: p.user_id,
      email: p.email,
      employeeCode: code,
      fullName: name,
      role: this.formRole(),
      departmentId: this.formDepartmentId() || null,
      managerId: this.formManagerId() || null,
    });
    this.formSubmitting.set(false);
    if (error) {
      this.formError.set(error);
      return;
    }
    this.closeForm();
  }
}
