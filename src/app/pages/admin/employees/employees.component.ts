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
import { EmployeeService } from '../../../core/services/employee.service';
import { CompaniesService } from '../../../core/services/companies.service';
import type { Employee, Department, EmployeeDependent, ContractType, EmploymentType, EmployeeStatus } from '../../../core/models';
import type { Company } from '../../../core/models';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';

@Component({
  selector: 'app-employees',
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
  ],
  templateUrl: './employees.html',
  styleUrl: './employees.scss',
})
export class EmployeesComponent implements OnInit {
  protected readonly employeeService = inject(EmployeeService);
  private readonly companiesService = inject(CompaniesService);

  protected readonly list = signal<Employee[]>([]);
  protected readonly departments = signal<Department[]>([]);
  protected readonly companies = signal<Company[]>([]);
  protected readonly loading = signal(true);
  protected readonly syncEmailInProgress = signal(false);
  protected readonly syncEmailMessage = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly formName = signal('');
  protected readonly formPhone = signal('');
  protected readonly formRole = signal<Employee['role']>('employee');
  protected readonly formCompanyId = signal<string | null>(null);
  protected readonly formDepartmentId = signal<string | null>(null);
  protected readonly formManagerId = signal<string | null>(null);
  protected readonly formDateOfBirth = signal<Date | null>(null);
  protected readonly formIdNumber = signal('');
  protected readonly formAddress = signal('');
  protected readonly formBankAccount = signal('');
  protected readonly formBankName = signal('');
  protected readonly formStartDate = signal<Date | null>(null);
  protected readonly formTaxCode = signal('');
  protected readonly formSocialInsuranceNumber = signal('');
  protected readonly formEmail = signal('');
  protected readonly formContractType = signal<ContractType | null>('indefinite');
  protected readonly formContractEndDate = signal<Date | null>(null);
  protected readonly formEmploymentType = signal<EmploymentType | null>('official');
  protected readonly formDependentsCount = signal(0);
  protected readonly formEmergencyContactName = signal('');
  protected readonly formEmergencyContactPhone = signal('');
  protected readonly formGender = signal('');
  protected readonly formIdIssuePlace = signal('');
  protected readonly formIdIssueDate = signal<Date | null>(null);
  protected readonly formJobTitle = signal('');
  protected readonly formResignationDate = signal<Date | null>(null);
  protected readonly formStatus = signal<EmployeeStatus | null>('active');
  protected readonly formSaving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly dependents = signal<EmployeeDependent[]>([]);
  protected readonly showAddDependent = signal(false);
  protected readonly addDepName = signal('');
  protected readonly addDepRelationship = signal('Con');
  protected readonly addDepBirthYear = signal<number | null>(null);
  protected readonly addDepIdNumber = signal('');
  protected readonly addDepNote = signal('');
  protected readonly addDepSubmitting = signal(false);
  protected readonly editDepId = signal<string | null>(null);
  protected readonly editDepName = signal('');
  protected readonly editDepRelationship = signal('Con');
  protected readonly editDepBirthYear = signal<number | null>(null);
  protected readonly editDepIdNumber = signal('');
  protected readonly editDepNote = signal('');
  protected readonly editDepSubmitting = signal(false);

  protected readonly relationshipOptions = [
    { value: 'Con', label: 'Con' },
    { value: 'Vợ/chồng', label: 'Vợ/chồng' },
    { value: 'Cha/mẹ', label: 'Cha/mẹ' },
    { value: 'Khác', label: 'Khác' },
  ];

  protected readonly contractTypeOptions: { value: ContractType; label: string }[] = [
    { value: 'indefinite', label: 'Vô thời hạn' },
    { value: 'fixed', label: 'Có thời hạn' },
  ];
  protected readonly employmentTypeOptions: { value: EmploymentType; label: string }[] = [
    { value: 'official', label: 'Nhân viên chính thức' },
    { value: 'probation', label: 'Thử việc' },
    { value: 'contractor', label: 'Cộng tác viên' },
    { value: 'intern', label: 'Thực tập' },
  ];
  protected readonly statusOptions: { value: EmployeeStatus; label: string }[] = [
    { value: 'active', label: 'Đang làm' },
    { value: 'left', label: 'Đã nghỉ' },
    { value: 'suspended', label: 'Tạm ngừng' },
  ];

  protected readonly managersForSelect = computed(() =>
    this.list().filter((e) => e.role === 'manager' || e.role === 'hr' || e.role === 'admin')
  );

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    const [data, depts, companiesList] = await Promise.all([
      this.employeeService.getEmployees(),
      this.employeeService.getDepartments(),
      this.companiesService.list(),
    ]);
    this.list.set(data);
    this.departments.set(depts);
    this.companies.set(companiesList);
    this.loading.set(false);
  }

  protected roleLabel(role: string): string {
    const m: Record<string, string> = { employee: 'Nhân viên', manager: 'Quản lý', hr: 'HR', admin: 'Admin' };
    return m[role] ?? role;
  }

  protected companyDisplay(c: Company): string {
    return c.short_name ? `${c.short_name} – ${c.company_name}` : c.company_name;
  }

  protected managerName(e: Employee): string {
    if (!e.manager_id) return '—';
    const manager = this.list().find((m) => m.id === e.manager_id);
    return manager ? `${manager.full_name} (${manager.employee_code})` : '—';
  }

  async syncEmailsFromAuth(): Promise<void> {
    this.syncEmailMessage.set(null);
    this.syncEmailInProgress.set(true);
    const result = await this.employeeService.syncEmailsFromAuth();
    this.syncEmailInProgress.set(false);
    if ('error' in result) {
      this.syncEmailMessage.set('Lỗi: ' + result.error);
      return;
    }
    this.syncEmailMessage.set(`Đã đồng bộ email cho ${result.count} nhân viên.`);
    const data = await this.employeeService.getEmployees();
    this.list.set(data);
  }

  async startEdit(e: Employee): Promise<void> {
    this.editingId.set(e.id);
    this.dependents.set(await this.employeeService.getDependents(e.id));
    this.showAddDependent.set(false);
    this.editDepId.set(null);
    this.formName.set(e.full_name);
    this.formPhone.set(e.phone ?? '');
    this.formRole.set(e.role);
    this.formCompanyId.set(e.company_id ?? null);
    this.formDepartmentId.set(e.department_id ?? null);
    this.formManagerId.set(e.manager_id ?? null);
    this.formDateOfBirth.set(e.date_of_birth ? new Date(e.date_of_birth + 'T00:00:00') : null);
    this.formIdNumber.set(e.id_number ?? '');
    this.formIdIssuePlace.set(e.id_issue_place ?? '');
    this.formIdIssueDate.set(e.id_issue_date ? new Date(e.id_issue_date + 'T00:00:00') : null);
    this.formAddress.set(e.address ?? '');
    this.formBankAccount.set(e.bank_account ?? '');
    this.formBankName.set(e.bank_name ?? '');
    this.formStartDate.set(e.start_date ? new Date(e.start_date + 'T00:00:00') : null);
    this.formTaxCode.set(e.tax_code ?? '');
    this.formSocialInsuranceNumber.set(e.social_insurance_number ?? '');
    this.formEmail.set(e.email ?? '');
    this.formContractType.set(e.contract_type ?? 'indefinite');
    this.formContractEndDate.set(e.contract_end_date ? new Date(e.contract_end_date + 'T00:00:00') : null);
    this.formEmploymentType.set(e.employment_type ?? 'official');
    this.formDependentsCount.set(e.dependents_count ?? 0);
    this.formEmergencyContactName.set(e.emergency_contact_name ?? '');
    this.formEmergencyContactPhone.set(e.emergency_contact_phone ?? '');
    this.formGender.set(e.gender ?? '');
    this.formJobTitle.set(e.job_title ?? '');
    this.formResignationDate.set(e.resignation_date ? new Date(e.resignation_date + 'T00:00:00') : null);
    this.formStatus.set(e.status ?? 'active');
    this.formError.set(null);
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  protected async saveEdit(): Promise<void> {
    const id = this.editingId();
    if (!id) return;
    const name = this.formName().trim();
    if (!name) {
      this.formError.set('Họ tên không để trống.');
      return;
    }
    this.formSaving.set(true);
    this.formError.set(null);
    const dob = this.formDateOfBirth();
    const start = this.formStartDate();
    const contractEnd = this.formContractEndDate();
    const idIssueDate = this.formIdIssueDate();
    const resignation = this.formResignationDate();
    const { error } = await this.employeeService.updateEmployee(id, {
      full_name: name,
      phone: this.formPhone().trim() || null,
      role: this.formRole(),
      company_id: this.formCompanyId() || null,
      department_id: this.formDepartmentId() || null,
      manager_id: this.formManagerId() || null,
      date_of_birth: dob ? dob.toISOString().slice(0, 10) : null,
      id_number: this.formIdNumber().trim() || null,
      id_issue_place: this.formIdIssuePlace().trim() || null,
      id_issue_date: idIssueDate ? idIssueDate.toISOString().slice(0, 10) : null,
      address: this.formAddress().trim() || null,
      bank_account: this.formBankAccount().trim() || null,
      bank_name: this.formBankName().trim() || null,
      start_date: start ? start.toISOString().slice(0, 10) : null,
      tax_code: this.formTaxCode().trim() || null,
      social_insurance_number: this.formSocialInsuranceNumber().trim() || null,
      email: this.formEmail().trim() || null,
      contract_type: this.formContractType(),
      contract_end_date: contractEnd ? contractEnd.toISOString().slice(0, 10) : null,
      employment_type: this.formEmploymentType(),
      dependents_count: this.formDependentsCount(),
      emergency_contact_name: this.formEmergencyContactName().trim() || null,
      emergency_contact_phone: this.formEmergencyContactPhone().trim() || null,
      gender: this.formGender().trim() || null,
      job_title: this.formJobTitle().trim() || null,
      resignation_date: resignation ? resignation.toISOString().slice(0, 10) : null,
      status: this.formStatus(),
    });
    this.formSaving.set(false);
    if (error) {
      this.formError.set(error);
      return;
    }
    this.editingId.set(null);
    const data = await this.employeeService.getEmployees();
    this.list.set(data);
  }

  protected openAddDependent(): void {
    this.addDepName.set('');
    this.addDepRelationship.set('Con');
    this.addDepBirthYear.set(null);
    this.addDepIdNumber.set('');
    this.addDepNote.set('');
    this.showAddDependent.set(true);
  }

  protected closeAddDependent(): void {
    this.showAddDependent.set(false);
  }

  protected async submitAddDependent(): Promise<void> {
    const id = this.editingId();
    if (!id) return;
    const name = this.addDepName().trim();
    if (!name) return;
    this.addDepSubmitting.set(true);
    const err = await this.employeeService.createDependent(id, {
      full_name: name,
      relationship: this.addDepRelationship(),
      birth_year: this.addDepBirthYear(),
      id_number: this.addDepIdNumber().trim() || null,
      note: this.addDepNote().trim() || null,
    });
    this.addDepSubmitting.set(false);
    if (!err) {
      this.dependents.set(await this.employeeService.getDependents(id));
      this.formDependentsCount.set(this.dependents().length);
      this.closeAddDependent();
    }
  }

  protected openEditDependent(d: EmployeeDependent): void {
    this.editDepId.set(d.id);
    this.editDepName.set(d.full_name);
    this.editDepRelationship.set(d.relationship);
    this.editDepBirthYear.set(d.birth_year ?? null);
    this.editDepIdNumber.set(d.id_number ?? '');
    this.editDepNote.set(d.note ?? '');
  }

  protected cancelEditDependent(): void {
    this.editDepId.set(null);
  }

  protected async submitEditDependent(): Promise<void> {
    const depId = this.editDepId();
    if (!depId) return;
    const name = this.editDepName().trim();
    if (!name) return;
    this.editDepSubmitting.set(true);
    const err = await this.employeeService.updateDependent(depId, {
      full_name: name,
      relationship: this.editDepRelationship(),
      birth_year: this.editDepBirthYear(),
      id_number: this.editDepIdNumber().trim() || null,
      note: this.editDepNote().trim() || null,
    });
    this.editDepSubmitting.set(false);
    if (!err) {
      const empId = this.editingId();
      if (empId) this.dependents.set(await this.employeeService.getDependents(empId));
      this.formDependentsCount.set(this.dependents().length);
      this.editDepId.set(null);
    }
  }

  protected async deleteDependent(d: EmployeeDependent): Promise<void> {
    if (!confirm(`Xóa người phụ thuộc "${d.full_name}"?`)) return;
    const err = await this.employeeService.deleteDependent(d.id);
    if (!err) {
      const empId = this.editingId();
      if (empId) {
        this.dependents.set(await this.employeeService.getDependents(empId));
        this.formDependentsCount.set(this.dependents().length);
      }
    }
  }
}
