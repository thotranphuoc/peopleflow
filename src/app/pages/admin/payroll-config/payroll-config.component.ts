import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { EmployeeService } from '../../../core/services/employee.service';
import { PayrollConfigService } from '../../../core/services/payroll-config.service';
import { SalaryGradeService } from '../../../core/services/salary-grade.service';
import type { PayrollConfigRow } from '../../../core/services/payroll-config.service';
import type { Employee, SalaryGrade } from '../../../core/models';

@Component({
  selector: 'app-payroll-config',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    DecimalPipe,
  ],
  templateUrl: './payroll-config.html',
  styleUrl: './payroll-config.scss',
})
export class PayrollConfigComponent implements OnInit {
  protected readonly employeeService = inject(EmployeeService);
  protected readonly configService = inject(PayrollConfigService);
  protected readonly gradeService = inject(SalaryGradeService);

  protected readonly list = signal<PayrollConfigRow[]>([]);
  protected readonly employees = signal<Employee[]>([]);
  protected readonly grades = signal<SalaryGrade[]>([]);
  protected readonly loading = signal(true);
  protected readonly message = signal<string | null>(null);

  protected readonly showAddForm = signal(false);
  protected readonly addEmployeeId = signal<string | null>(null);
  protected readonly addSalaryGradeId = signal<string | null>(null);
  protected readonly addEffectiveDate = signal<Date>(new Date());
  protected readonly addP1 = signal<number>(0);
  protected readonly addP2 = signal<number>(0);
  protected readonly addP3 = signal<number>(0);
  protected readonly addInsuranceRate = signal<number>(10.5);
  protected readonly addDependents = signal<number>(0);
  protected readonly addSubmitting = signal(false);
  protected readonly addError = signal<string | null>(null);

  protected readonly editId = signal<string | null>(null);
  protected readonly editSalaryGradeId = signal<string | null>(null);
  protected readonly editEffectiveDate = signal<Date>(new Date());
  protected readonly editP1 = signal<number>(0);
  protected readonly editP2 = signal<number>(0);
  protected readonly editP3 = signal<number>(0);
  protected readonly editInsuranceRate = signal<number>(10.5);
  protected readonly editDependents = signal<number>(0);
  protected readonly editSubmitting = signal(false);
  protected readonly editError = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.message.set(null);
    const [configs, emps, grades] = await Promise.all([
      this.configService.getAll(),
      this.employeeService.getEmployees(),
      this.gradeService.getAll(),
    ]);
    this.list.set(configs);
    this.employees.set(emps);
    this.grades.set(grades);
    this.loading.set(false);
  }

  protected openAdd(): void {
    this.addEmployeeId.set(null);
    this.addSalaryGradeId.set(null);
    this.addEffectiveDate.set(new Date());
    this.addP1.set(0);
    this.addP2.set(0);
    this.addP3.set(0);
    this.addInsuranceRate.set(10.5);
    this.addDependents.set(0);
    this.addError.set(null);
    this.showAddForm.set(true);
  }

  protected onAddEmployeeChange(employeeId: string | null): void {
    this.addEmployeeId.set(employeeId);
    if (employeeId) {
      const emp = this.employees().find((e) => e.id === employeeId);
      if (emp) this.addDependents.set(emp.dependents_count ?? 0);
    }
  }

  protected onAddGradeChange(gradeId: string | null): void {
    this.addSalaryGradeId.set(gradeId);
    if (gradeId) {
      const g = this.grades().find((x) => x.id === gradeId);
      if (g) {
        this.addP1.set(g.p1_salary);
        this.addP2.set(g.p2_salary);
        this.addP3.set(g.p3_salary ?? 0);
      }
    }
  }

  protected closeAdd(): void {
    this.showAddForm.set(false);
  }

  protected async submitAdd(): Promise<void> {
    const empId = this.addEmployeeId();
    if (!empId) {
      this.addError.set('Chọn nhân viên');
      return;
    }
    this.addSubmitting.set(true);
    this.addError.set(null);
    const d = this.addEffectiveDate();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const err = await this.configService.create({
      employee_id: empId,
      salary_grade_id: this.addSalaryGradeId() || null,
      effective_date: dateStr,
      p1_salary: this.addP1(),
      p2_salary: this.addP2(),
      p3_salary: this.addP3(),
      insurance_rate: this.addInsuranceRate(),
      dependents_count: this.addDependents(),
    });
    this.addSubmitting.set(false);
    if (err) {
      this.addError.set(err);
      return;
    }
    this.closeAdd();
    await this.load();
  }

  protected openEdit(row: PayrollConfigRow): void {
    const [y, m, d] = row.effective_date.slice(0, 10).split('-').map(Number);
    this.editId.set(row.id);
    this.editSalaryGradeId.set(row.salary_grade_id ?? null);
    this.editEffectiveDate.set(new Date(y, m - 1, d));
    this.editP1.set(row.p1_salary);
    this.editP2.set(row.p2_salary);
    this.editP3.set(row.p3_salary ?? 0);
    this.editInsuranceRate.set(row.insurance_rate);
    this.editDependents.set(row.dependents_count);
    this.editError.set(null);
  }

  protected onEditGradeChange(gradeId: string | null): void {
    this.editSalaryGradeId.set(gradeId);
    if (gradeId) {
      const g = this.grades().find((x) => x.id === gradeId);
      if (g) {
        this.editP1.set(g.p1_salary);
        this.editP2.set(g.p2_salary);
        this.editP3.set(g.p3_salary ?? 0);
      }
    }
  }

  protected cancelEdit(): void {
    this.editId.set(null);
  }

  protected async submitEdit(): Promise<void> {
    const id = this.editId();
    if (!id) return;
    this.editSubmitting.set(true);
    this.editError.set(null);
    const d = this.editEffectiveDate();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const err = await this.configService.update(id, {
      salary_grade_id: this.editSalaryGradeId() ?? null,
      effective_date: dateStr,
      p1_salary: this.editP1(),
      p2_salary: this.editP2(),
      p3_salary: this.editP3(),
      insurance_rate: this.editInsuranceRate(),
      dependents_count: this.editDependents(),
    });
    this.editSubmitting.set(false);
    if (err) {
      this.editError.set(err);
      return;
    }
    this.editId.set(null);
    await this.load();
  }

  protected async deleteConfig(row: PayrollConfigRow): Promise<void> {
    if (!confirm(`Xóa cấu hình lương của ${row.full_name} (từ ${row.effective_date})?`)) return;
    const err = await this.configService.delete(row.id);
    if (err) this.message.set('Lỗi: ' + err);
    else await this.load();
  }

  protected formatDate(s: string): string {
    return s.slice(0, 10);
  }
}
