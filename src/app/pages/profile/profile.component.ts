import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { EmployeeService } from '../../core/services/employee.service';
import { CompaniesService } from '../../core/services/companies.service';
import type {
  Employee,
  Department,
  Company,
  EmployeeDependent,
  ContractType,
  EmploymentType,
  EmployeeStatus,
} from '../../core/models';

@Component({
  selector: 'app-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class ProfileComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly employeeService = inject(EmployeeService);
  private readonly companiesService = inject(CompaniesService);

  protected readonly departments = signal<Department[]>([]);
  protected readonly companies = signal<Company[]>([]);
  protected readonly manager = signal<Employee | null>(null);
  protected readonly dependents = signal<EmployeeDependent[]>([]);

  async ngOnInit(): Promise<void> {
    const uid = this.auth.user()?.id;
    if (!uid) return;
    await this.employeeService.loadCurrentEmployee(uid);
    const emp = this.employeeService.currentEmployee();
    if (emp) {
      const [depts, companiesList, deps, managerData] = await Promise.all([
        this.employeeService.getDepartments(),
        this.companiesService.list(),
        this.employeeService.getDependents(emp.id),
        emp.manager_id ? this.employeeService.getEmployeeById(emp.manager_id) : Promise.resolve(null),
      ]);
      this.departments.set(depts);
      this.companies.set(companiesList);
      this.dependents.set(deps);
      if (managerData) this.manager.set(managerData);
    }
  }

  protected roleLabel(role: string): string {
    const m: Record<string, string> = {
      employee: 'Nhân viên',
      manager: 'Quản lý',
      hr: 'HR',
      admin: 'Admin',
    };
    return m[role] ?? role;
  }

  protected companyName(id: string | null): string {
    if (!id) return '—';
    const c = this.companies().find((x) => x.id === id);
    return c ? (c.short_name ? `${c.short_name} – ${c.company_name}` : c.company_name) : '—';
  }

  protected departmentName(id: string | null): string {
    if (!id) return '—';
    const d = this.departments().find((x) => x.id === id);
    return d ? `${d.code} — ${d.name}` : '—';
  }

  protected managerName(_managerId: string | null): string {
    const m = this.manager();
    return m ? `${m.full_name} (${m.employee_code})` : '—';
  }

  protected formatDate(d: string | null): string {
    if (!d) return '—';
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('vi-VN');
  }

  protected employmentTypeLabel(t: EmploymentType | null): string {
    if (!t) return '—';
    const m: Record<EmploymentType, string> = {
      official: 'Nhân viên chính thức',
      probation: 'Thử việc',
      contractor: 'Cộng tác viên',
      intern: 'Thực tập',
    };
    return m[t] ?? t;
  }

  protected contractTypeLabel(t: ContractType | null): string {
    if (!t) return '—';
    const m: Record<ContractType, string> = {
      indefinite: 'Vô thời hạn',
      fixed: 'Có thời hạn',
    };
    return m[t] ?? t;
  }

  protected statusLabel(s: EmployeeStatus | null): string {
    if (!s) return '—';
    const m: Record<EmployeeStatus, string> = {
      active: 'Đang làm',
      left: 'Đã nghỉ',
      suspended: 'Tạm ngừng',
    };
    return m[s] ?? s;
  }
}
