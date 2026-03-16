import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DecimalPipe } from '@angular/common';
import { EmployeeService } from '../../../core/services/employee.service';
import { PayrollAdminService } from '../../../core/services/payroll-admin.service';
import { WorkScheduleService } from '../../../core/services/work-schedule.service';
import { ExportCsvService } from '../../../core/services/export-csv.service';
import { TaxConfigService } from '../../../core/services/tax-config.service';
import { AuditLogService } from '../../../core/services/audit-log.service';
import { NotificationService } from '../../../core/services/notification.service';
import type { PayrollAdminRow } from '../../../core/services/payroll-admin.service';
import type { Department } from '../../../core/models';
import { FocusInputDirective } from './focus-input.directive';

interface PayrollEdit {
  p3_amount: number;
  gross_salary: number;
  insurance_amount: number;
  tax_amount: number;
  penalty_amount: number;
}

@Component({
  selector: 'app-payroll-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, MatButtonModule, MatSlideToggleModule, DecimalPipe, FocusInputDirective],
  templateUrl: './payroll-admin.html',
  styleUrl: './payroll-admin.scss',
})
export class PayrollAdminComponent implements OnInit {
  protected readonly employeeService = inject(EmployeeService);
  protected readonly payrollService = inject(PayrollAdminService);
  protected readonly workScheduleService = inject(WorkScheduleService);
  protected readonly exportCsv = inject(ExportCsvService);
  protected readonly taxConfigService = inject(TaxConfigService);
  protected readonly auditLog = inject(AuditLogService);
  private readonly notificationService = inject(NotificationService);

  protected readonly month = signal<number>(new Date().getMonth() + 1);
  protected readonly year = signal<number>(new Date().getFullYear());
  protected readonly departmentId = signal<string | null>(null);
  protected readonly edits = signal<Record<string, PayrollEdit>>({});
  protected readonly saving = signal(false);
  protected readonly publishing = signal(false);
  protected readonly unpublishing = signal(false);
  protected readonly publishingEmployeeId = signal<string | null>(null);
  protected readonly unpublishingEmployeeId = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly departments = signal<Department[]>([]);
  /** Ô đang sửa: click vào text thì thành input, blur/Enter thì về text. */
  protected readonly editingCell = signal<{ employeeId: string; field: keyof PayrollEdit } | null>(null);
  /** Số ngày làm việc trong tháng (theo lịch mặc định, trừ ngày lễ). */
  protected readonly workingDaysInMonth = signal<number | null>(null);

  protected readonly months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  protected readonly years = (() => {
    const y = new Date().getFullYear();
    return [y, y - 1];
  })();

  protected readonly hasDirty = computed(() => Object.keys(this.edits()).length > 0);
  protected readonly publishedRows = computed(() =>
    this.payrollService.rows().filter((r) => r.payroll?.status === 'published')
  );
  protected readonly hasPublished = computed(() => this.publishedRows().length > 0);
  /** Tất cả dòng đều đã công bố (dùng cho toggle "Công bố tất cả"). */
  protected readonly allPublished = computed(() => {
    const rows = this.payrollService.rows();
    return rows.length > 0 && this.publishedRows().length === rows.length;
  });

  async ngOnInit(): Promise<void> {
    const depts = await this.employeeService.getDepartments();
    this.departments.set(depts);
    await this.load();
  }

  protected async load(): Promise<void> {
    this.edits.set({});
    this.message.set(null);
    this.workingDaysInMonth.set(null);
    await this.payrollService.load(this.month(), this.year(), this.departmentId());
    const days = await this.workScheduleService.getWorkingDaysInMonth(this.year(), this.month());
    this.workingDaysInMonth.set(days);
  }

  /** Ngày công hiệu lực của NV trong tháng (gốc trừ 0,5 × số lần đi trễ ≥120 phút). */
  protected getEffectiveWorkingDays(row: PayrollAdminRow): number | null {
    const base = this.workingDaysInMonth();
    if (base == null) return null;
    const v = base - 0.5 * row.halfDayUnpaidCount;
    return Math.round(v * 10) / 10;
  }

  protected getEdit(row: PayrollAdminRow): PayrollEdit {
    const e = this.edits()[row.employee_id];
    if (e) return e;
    const p = row.payroll;
    const suggested = this.payrollService.getSuggestedFromConfig(row);
    return {
      p3_amount: p?.p3_amount ?? suggested.p3_amount,
      gross_salary: p?.gross_salary ?? suggested.gross_salary,
      insurance_amount: p?.insurance_amount ?? suggested.insurance_amount,
      tax_amount: p?.tax_amount ?? suggested.tax_amount,
      penalty_amount: p?.penalty_amount ?? suggested.penalty_amount,
    };
  }

  protected setEdit(row: PayrollAdminRow, field: keyof PayrollEdit, value: number): void {
    const cur = this.getEdit(row);
    const next = { ...cur, [field]: value };
    if (field === 'p3_amount' && row.config) {
      next.gross_salary = (row.config.p1_salary ?? 0) + (row.config.p2_salary ?? 0) + value;
    }
    this.edits.update((prev) => ({
      ...prev,
      [row.employee_id]: next,
    }));
  }

  protected inputVal(row: PayrollAdminRow, field: keyof PayrollEdit): string {
    const v = this.getEdit(row)[field];
    return v === 0 ? '' : String(v);
  }

  protected isEditingCell(row: PayrollAdminRow, field: keyof PayrollEdit): boolean {
    const c = this.editingCell();
    return c !== null && c.employeeId === row.employee_id && c.field === field;
  }

  protected cellDisplayValue(row: PayrollAdminRow, field: keyof PayrollEdit): string {
    const v = this.getEdit(row)[field];
    return v === 0 ? '—' : v.toLocaleString('vi-VN');
  }

  protected startEdit(row: PayrollAdminRow, field: keyof PayrollEdit): void {
    this.editingCell.set({ employeeId: row.employee_id, field });
  }

  protected commitEdit(row: PayrollAdminRow, field: keyof PayrollEdit, value: string): void {
    const num = +value.replace(/\s/g, '') || 0;
    this.setEdit(row, field, num);
    this.editingCell.set(null);
  }

  protected cancelEditCell(): void {
    this.editingCell.set(null);
  }

  protected netSalary(row: PayrollAdminRow): number {
    const e = this.getEdit(row);
    return Math.max(0, e.gross_salary - e.insurance_amount - e.tax_amount - e.penalty_amount);
  }

  protected async fillFromConfig(): Promise<void> {
    const [brackets, deductions] = await Promise.all([
      this.taxConfigService.getBrackets(),
      this.taxConfigService.getDeductions(),
    ]);
    const taxConfig = { brackets, deductions };
    const rows = this.payrollService.rows();
    const next: Record<string, PayrollEdit> = {};
    for (const row of rows) {
      const s = this.payrollService.getSuggestedFromConfig(row, taxConfig);
      next[row.employee_id] = {
        p3_amount: s.p3_amount,
        gross_salary: s.gross_salary,
        insurance_amount: s.insurance_amount,
        tax_amount: s.tax_amount,
        penalty_amount: s.penalty_amount,
      };
    }
    this.edits.set(next);
    this.message.set('Đã điền gợi ý từ config lương (gross, BHXH, thuế TNCN theo bậc). Chỉnh sửa nếu cần rồi bấm Lưu.');
  }

  protected async saveAll(): Promise<void> {
    const month = this.month();
    const year = this.year();
    const rows = this.payrollService.rows();
    const updates: Array<{
      employee_id: string;
      p1_amount: number;
      p2_amount: number;
      p3_amount: number;
      penalty_amount: number;
      gross_salary: number;
      insurance_amount: number;
      tax_amount: number;
      net_salary: number;
      status: 'draft' | 'published';
    }> = [];
    for (const row of rows) {
      const e = this.getEdit(row);
      const net = Math.max(0, e.gross_salary - e.insurance_amount - e.tax_amount - e.penalty_amount);
      const p1 = row.config?.p1_salary ?? e.gross_salary;
      const p2 = row.config?.p2_salary ?? 0;
      updates.push({
        employee_id: row.employee_id,
        p1_amount: p1,
        p2_amount: p2,
        p3_amount: e.p3_amount,
        penalty_amount: e.penalty_amount,
        gross_salary: e.gross_salary,
        insurance_amount: e.insurance_amount,
        tax_amount: e.tax_amount,
        net_salary: net,
        status: 'draft',
      });
    }
    this.saving.set(true);
    this.message.set(null);
    const err = await this.payrollService.saveBatch(month, year, updates, this.departmentId());
    this.saving.set(false);
    if (err) {
      this.message.set('Lỗi: ' + err);
      return;
    }
    this.edits.set({});
    this.message.set('Đã lưu phiếu lương.');
    await this.auditLog.log({
      table_name: 'payrolls',
      action: 'save_batch',
      new_value: { month, year, count: updates.length },
    });
  }

  protected async publishAll(): Promise<void> {
    const rows = this.payrollService.rows();
    if (rows.length === 0) return;
    this.publishing.set(true);
    this.message.set(null);
    const err = await this.payrollService.publishBatch(
      this.month(),
      this.year(),
      rows.map((r) => r.employee_id)
    );
    this.publishing.set(false);
    if (err) {
      this.message.set('Lỗi: ' + err);
      return;
    }
    await this.load();
    this.message.set('Đã công bố phiếu lương. Nhân viên có thể xem ở Phiếu lương.');
    await this.auditLog.log({
      table_name: 'payrolls',
      action: 'publish_batch',
      new_value: { month: this.month(), year: this.year(), count: rows.length },
    });
    const month = this.month();
    const year = this.year();
    for (const r of rows) {
      await this.notificationService.create(
        r.employee_id,
        'payroll_published',
        'Phiếu lương đã công bố',
        `Phiếu lương tháng ${month}/${year} đã sẵn sàng. Bạn có thể xem tại Phiếu lương.`
      );
    }
  }

  protected buildPayload(row: PayrollAdminRow): {
    employee_id: string;
    p1_amount: number;
    p2_amount: number;
    p3_amount: number;
    penalty_amount: number;
    gross_salary: number;
    insurance_amount: number;
    tax_amount: number;
    net_salary: number;
  } {
    const e = this.getEdit(row);
    const net = Math.max(0, e.gross_salary - e.insurance_amount - e.tax_amount - e.penalty_amount);
    const p1 = row.config?.p1_salary ?? e.gross_salary;
    const p2 = row.config?.p2_salary ?? 0;
    return {
      employee_id: row.employee_id,
      p1_amount: p1,
      p2_amount: p2,
      p3_amount: e.p3_amount,
      penalty_amount: e.penalty_amount,
      gross_salary: e.gross_salary,
      insurance_amount: e.insurance_amount,
      tax_amount: e.tax_amount,
      net_salary: net,
    };
  }

  protected async publishRow(row: PayrollAdminRow): Promise<void> {
    this.publishingEmployeeId.set(row.employee_id);
    this.message.set(null);
    const payload = this.buildPayload(row);
    const err = await this.payrollService.publishOne(
      this.month(),
      this.year(),
      payload,
      this.departmentId()
    );
    this.publishingEmployeeId.set(null);
    if (err) {
      this.message.set('Lỗi: ' + err);
      return;
    }
    this.message.set(`Đã công bố phiếu lương: ${row.full_name}.`);
    await this.auditLog.log({
      table_name: 'payrolls',
      record_id: row.employee_id,
      action: 'publish_one',
      new_value: { month: this.month(), year: this.year(), employee_id: row.employee_id },
    });
    await this.notificationService.create(
      row.employee_id,
      'payroll_published',
      'Phiếu lương đã công bố',
      `Phiếu lương tháng ${this.month()}/${this.year()} đã sẵn sàng. Bạn có thể xem tại Phiếu lương.`
    );
  }

  protected isPublished(row: PayrollAdminRow): boolean {
    return row.payroll?.status === 'published';
  }

  protected async unpublishAll(): Promise<void> {
    const rows = this.publishedRows();
    if (rows.length === 0) return;
    this.unpublishing.set(true);
    this.message.set(null);
    const err = await this.payrollService.unpublishBatch(
      this.month(),
      this.year(),
      rows.map((r) => r.employee_id)
    );
    this.unpublishing.set(false);
    if (err) {
      this.message.set('Lỗi: ' + err);
      return;
    }
    await this.load();
    this.message.set('Đã bỏ công bố phiếu lương. Có thể chỉnh sửa rồi lưu lại.');
    await this.auditLog.log({
      table_name: 'payrolls',
      action: 'unpublish_batch',
      new_value: { month: this.month(), year: this.year(), count: rows.length },
    });
  }

  protected async onToggleAll(checked: boolean): Promise<void> {
    if (checked) {
      await this.publishAll();
    } else {
      await this.unpublishAll();
    }
  }

  protected async onRowToggle(row: PayrollAdminRow, checked: boolean): Promise<void> {
    if (checked) {
      await this.publishRow(row);
    } else {
      await this.unpublishRow(row);
    }
  }

  protected async unpublishRow(row: PayrollAdminRow): Promise<void> {
    this.unpublishingEmployeeId.set(row.employee_id);
    this.message.set(null);
    const err = await this.payrollService.unpublishOne(
      this.month(),
      this.year(),
      row.employee_id,
      this.departmentId()
    );
    this.unpublishingEmployeeId.set(null);
    if (err) {
      this.message.set('Lỗi: ' + err);
      return;
    }
    this.message.set(`Đã bỏ công bố: ${row.full_name}. Có thể chỉnh sửa rồi lưu.`);
    await this.auditLog.log({
      table_name: 'payrolls',
      record_id: row.employee_id,
      action: 'unpublish_one',
      new_value: { month: this.month(), year: this.year(), employee_id: row.employee_id },
    });
  }

  protected exportPayrollCsv(): void {
    const rows = this.payrollService.rows();
    const data = rows.map((row) => {
      const e = this.getEdit(row);
      const net = Math.max(0, e.gross_salary - e.insurance_amount - e.tax_amount - e.penalty_amount);
      return {
        employee_code: row.employee_code,
        full_name: row.full_name,
        department_code: row.department_code ?? '',
        tax_code: row.tax_code ?? '',
        social_insurance_number: row.social_insurance_number ?? '',
        bank_account: row.bank_account ?? '',
        bank_name: row.bank_name ?? '',
        gross_salary: e.gross_salary,
        insurance_amount: e.insurance_amount,
        tax_amount: e.tax_amount,
        penalty_amount: e.penalty_amount,
        net_salary: net,
      };
    });
    const filename = `phieu-luong-${this.year()}-${String(this.month()).padStart(2, '0')}.csv`;
    this.exportCsv.download(data, filename);
  }
}
