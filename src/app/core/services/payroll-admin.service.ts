import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { TaxConfigService } from './tax-config.service';
import type { Payroll, PayrollConfig } from '../models';
import type { TaxBracket, TaxDeduction } from '../models';

export interface PayrollAdminRow {
  employee_id: string;
  employee_code: string;
  full_name: string;
  department_code: string | null;
  tax_code: string | null;
  social_insurance_number: string | null;
  bank_account: string | null;
  bank_name: string | null;
  config: PayrollConfig | null;
  payroll: Payroll | null;
  /** Tổng tiền phạt đi trễ trong tháng (từ attendance_penalties). */
  penaltyFromAttendance: number;
  /** Số lần bị ghi nhận ½ ngày không lương (đi trễ ≥120 phút). Trừ vào ngày công: effectiveDays = workingDaysInMonth - 0.5 * này. */
  halfDayUnpaidCount: number;
}

@Injectable({ providedIn: 'root' })
export class PayrollAdminService {
  private readonly supabase = inject(SupabaseService);
  private readonly taxConfig = inject(TaxConfigService);

  private readonly _rows = signal<PayrollAdminRow[]>([]);
  readonly rows = this._rows.asReadonly();
  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();
  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  async load(month: number, year: number, departmentId?: string | null): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    let empQuery = this.supabase.supabase
      .from('employees')
      .select('id, employee_code, full_name, department_id, tax_code, social_insurance_number, bank_account, bank_name')
      .order('employee_code');
    if (departmentId) {
      empQuery = empQuery.eq('department_id', departmentId);
    }
    const { data: employees } = await empQuery;
    if (!employees?.length) {
      this._rows.set([]);
      this._loading.set(false);
      return;
    }
    const empIds = (employees as { id: string }[]).map((e) => e.id);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const [balancesRes, configsRes, penaltiesRes] = await Promise.all([
      this.supabase.supabase
        .from('payrolls')
        .select('*')
        .eq('month', month)
        .eq('year', year)
        .in('employee_id', empIds),
      this.supabase.supabase
        .from('payroll_configs')
        .select('*')
        .in('employee_id', empIds)
        .lte('effective_date', `${year}-${String(month).padStart(2, '0')}-31`)
        .order('effective_date', { ascending: false }),
      this.supabase.supabase
        .from('attendance_penalties')
        .select('employee_id, penalty_amount, half_day_unpaid')
        .in('employee_id', empIds)
        .gte('work_date', start)
        .lte('work_date', end),
    ]);
    const payrollByEmp = new Map<string, Payroll>();
    for (const p of balancesRes.data ?? []) {
      const row = p as Payroll;
      payrollByEmp.set(row.employee_id, row);
    }
    const configByEmp = new Map<string, PayrollConfig>();
    for (const c of configsRes.data ?? []) {
      const row = c as PayrollConfig;
      if (!configByEmp.has(row.employee_id)) configByEmp.set(row.employee_id, row);
    }
    const penaltyByEmp = new Map<string, number>();
    const halfDayByEmp = new Map<string, number>();
    for (const p of penaltiesRes.data ?? []) {
      const row = p as { employee_id: string; penalty_amount: number; half_day_unpaid?: boolean };
      penaltyByEmp.set(row.employee_id, (penaltyByEmp.get(row.employee_id) ?? 0) + Number(row.penalty_amount));
      if (row.half_day_unpaid) {
        halfDayByEmp.set(row.employee_id, (halfDayByEmp.get(row.employee_id) ?? 0) + 1);
      }
    }
    const deptIds = [...new Set((employees as { department_id: string | null }[]).map((e) => e.department_id).filter(Boolean))] as string[];
    let departments: { id: string; code: string }[] = [];
    if (deptIds.length > 0) {
      const { data: depts } = await this.supabase.supabase.from('departments').select('id, code').in('id', deptIds);
      departments = (depts ?? []) as { id: string; code: string }[];
    }
    const deptCodeById = new Map(departments.map((d) => [d.id, d.code]));
    type EmpRow = { id: string; employee_code: string; full_name: string; department_id: string | null; tax_code?: string | null; social_insurance_number?: string | null; bank_account?: string | null; bank_name?: string | null };
    const rows: PayrollAdminRow[] = (employees as EmpRow[]).map((e) => ({
      employee_id: e.id,
      employee_code: e.employee_code,
      full_name: e.full_name,
      department_code: e.department_id ? deptCodeById.get(e.department_id) ?? null : null,
      tax_code: e.tax_code ?? null,
      social_insurance_number: e.social_insurance_number ?? null,
      bank_account: e.bank_account ?? null,
      bank_name: e.bank_name ?? null,
      config: configByEmp.get(e.id) ?? null,
      payroll: payrollByEmp.get(e.id) ?? null,
      penaltyFromAttendance: penaltyByEmp.get(e.id) ?? 0,
      halfDayUnpaidCount: halfDayByEmp.get(e.id) ?? 0,
    }));
    this._rows.set(rows);
    this._loading.set(false);
  }

  /** Trả về số liệu gợi ý từ config (gross = p1+p2+p3, BHXH theo rate). Nếu truyền taxConfig thì tính thuế theo bậc + giảm trừ. */
  getSuggestedFromConfig(
    row: PayrollAdminRow,
    taxConfig?: { brackets: TaxBracket[]; deductions: TaxDeduction[] }
  ): { gross_salary: number; p3_amount: number; insurance_amount: number; tax_amount: number; penalty_amount: number; net_salary: number } {
    const c = row.config;
    const p3 = (c?.p3_salary ?? row.payroll?.p3_amount) ?? 0;
    if (!c) {
      const p = row.payroll;
      const penalty = p?.penalty_amount ?? row.penaltyFromAttendance ?? 0;
      return {
        gross_salary: p?.gross_salary ?? 0,
        p3_amount: p?.p3_amount ?? 0,
        insurance_amount: p?.insurance_amount ?? 0,
        tax_amount: p?.tax_amount ?? 0,
        penalty_amount: penalty,
        net_salary: (p?.net_salary ?? 0) || Math.max(0, (p?.gross_salary ?? 0) - (p?.insurance_amount ?? 0) - (p?.tax_amount ?? 0) - penalty),
      };
    }
    const gross = (c.p1_salary ?? 0) + (c.p2_salary ?? 0) + p3;
    const rate = (c.insurance_rate ?? 10.5) / 100;
    const insurance = Math.round(gross * rate);
    let tax = 0;
    if (taxConfig?.brackets?.length && taxConfig?.deductions?.length) {
      tax = this.taxConfig.calculateTaxSync(
        taxConfig.brackets,
        taxConfig.deductions,
        gross,
        insurance,
        c.dependents_count ?? 0
      );
    }
    const penalty = row.penaltyFromAttendance ?? 0;
    const net = gross - insurance - tax - penalty;
    return { gross_salary: gross, p3_amount: p3, insurance_amount: insurance, tax_amount: tax, penalty_amount: penalty, net_salary: net };
  }

  async upsertPayroll(
    employeeId: string,
    month: number,
    year: number,
    payload: {
      p1_amount: number;
      p2_amount: number;
      p3_amount: number;
      penalty_amount: number;
      gross_salary: number;
      insurance_amount: number;
      tax_amount: number;
      net_salary: number;
      status: 'draft' | 'published';
    }
  ): Promise<string | null> {
    const { error } = await this.supabase.supabase.from('payrolls').upsert(
      {
        employee_id: employeeId,
        month,
        year,
        p1_amount: payload.p1_amount,
        p2_amount: payload.p2_amount,
        p3_amount: payload.p3_amount,
        penalty_amount: payload.penalty_amount,
        gross_salary: payload.gross_salary,
        insurance_amount: payload.insurance_amount,
        tax_amount: payload.tax_amount,
        net_salary: payload.net_salary,
        status: payload.status,
      },
      { onConflict: 'employee_id,month,year' }
    );
    return error?.message ?? null;
  }

  async saveBatch(
    month: number,
    year: number,
    updates: Array<{
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
    }>,
    departmentId?: string | null
  ): Promise<string | null> {
    for (const u of updates) {
      const err = await this.upsertPayroll(u.employee_id, month, year, u);
      if (err) return err;
    }
    await this.load(month, year, departmentId);
    return null;
  }

  /** Công bố phiếu lương: chuyển status sang 'published' cho các nhân viên trong danh sách (kỳ month/year). */
  async publishBatch(
    month: number,
    year: number,
    employeeIds: string[]
  ): Promise<string | null> {
    if (employeeIds.length === 0) return null;
    const { error } = await this.supabase.supabase
      .from('payrolls')
      .update({ status: 'published' })
      .eq('month', month)
      .eq('year', year)
      .in('employee_id', employeeIds);
    return error?.message ?? null;
  }

  /** Công bố một phiếu lương (lưu nếu cần rồi set status = published). */
  async publishOne(
    month: number,
    year: number,
    payload: {
      employee_id: string;
      p1_amount: number;
      p2_amount: number;
      p3_amount: number;
      penalty_amount: number;
      gross_salary: number;
      insurance_amount: number;
      tax_amount: number;
      net_salary: number;
    },
    departmentId?: string | null
  ): Promise<string | null> {
    const err = await this.upsertPayroll(payload.employee_id, month, year, {
      ...payload,
      status: 'published',
    });
    if (err) return err;
    await this.load(month, year, departmentId);
    return null;
  }

  /** Bỏ công bố: chuyển status về 'draft' để xem lại và chỉnh sửa. */
  async unpublishBatch(month: number, year: number, employeeIds: string[]): Promise<string | null> {
    if (employeeIds.length === 0) return null;
    const { error } = await this.supabase.supabase
      .from('payrolls')
      .update({ status: 'draft' })
      .eq('month', month)
      .eq('year', year)
      .in('employee_id', employeeIds);
    return error?.message ?? null;
  }

  /** Bỏ công bố một phiếu lương (chỉ đổi status về draft). */
  async unpublishOne(month: number, year: number, employeeId: string, departmentId?: string | null): Promise<string | null> {
    const row = this._rows().find((r) => r.employee_id === employeeId);
    const p = row?.payroll;
    if (!p) return null;
    const { error } = await this.supabase.supabase
      .from('payrolls')
      .update({ status: 'draft' })
      .eq('id', p.id);
    if (error) return error.message;
    await this.load(month, year, departmentId);
    return null;
  }
}
