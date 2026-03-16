import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import type { LeaveBalance } from '../models';

export interface LeaveBalanceRow {
  employee_id: string;
  employee_code: string;
  full_name: string;
  department_code: string | null;
  balance_id: string | null;
  total_minutes: number;
  extra_minutes: number;
  used_minutes: number;
}

const DEFAULT_TOTAL_MINUTES = 5760; // 12 ngày × 480 phút

@Injectable({ providedIn: 'root' })
export class LeaveBalanceService {
  private readonly supabase = inject(SupabaseService);

  private readonly _rows = signal<LeaveBalanceRow[]>([]);
  readonly rows = this._rows.asReadonly();
  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();
  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  /** Load tất cả nhân viên và quỹ phép năm đã chọn (ai chưa có thì balance_id null, total/used = 0). */
  async loadForYear(year: number): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    const { data: employees, error: errEmp } = await this.supabase.supabase
      .from('employees')
      .select('id, employee_code, full_name, department_id')
      .order('employee_code');
    if (errEmp) {
      this._loading.set(false);
      this._error.set(errEmp.message);
      this._rows.set([]);
      return;
    }
    const { data: balances } = await this.supabase.supabase
      .from('leave_balances')
      .select('id, employee_id, total_minutes, extra_minutes, used_minutes')
      .eq('year', year);
    const balanceByEmployee = new Map<string, LeaveBalance>();
    for (const b of balances ?? []) {
      balanceByEmployee.set((b as LeaveBalance).employee_id, b as LeaveBalance);
    }
    const deptIds = [...new Set((employees ?? []).map((e: { department_id: string | null }) => e.department_id).filter(Boolean))] as string[];
    let departments: { id: string; code: string }[] = [];
    if (deptIds.length > 0) {
      const { data: depts } = await this.supabase.supabase
        .from('departments')
        .select('id, code')
        .in('id', deptIds);
      departments = (depts ?? []) as { id: string; code: string }[];
    }
    const deptCodeById = new Map(departments.map((d) => [d.id, d.code]));
    const rows: LeaveBalanceRow[] = (employees ?? []).map((e: { id: string; employee_code: string; full_name: string; department_id: string | null }) => {
      const bal = balanceByEmployee.get(e.id);
      return {
        employee_id: e.id,
        employee_code: e.employee_code,
        full_name: e.full_name,
        department_code: e.department_id ? deptCodeById.get(e.department_id) ?? null : null,
        balance_id: bal?.id ?? null,
        total_minutes: bal?.total_minutes ?? 0,
        extra_minutes: (bal as LeaveBalance & { extra_minutes?: number })?.extra_minutes ?? 0,
        used_minutes: bal?.used_minutes ?? 0,
      };
    });
    this._rows.set(rows);
    this._loading.set(false);
  }

  /** Cấp phép năm: tạo leave_balances cho nhân viên chưa có quỹ năm này. */
  async grantForYear(year: number, totalMinutes: number = DEFAULT_TOTAL_MINUTES): Promise<{ error: string | null; granted: number }> {
    const { data: employees } = await this.supabase.supabase.from('employees').select('id');
    const { data: existing } = await this.supabase.supabase
      .from('leave_balances')
      .select('employee_id')
      .eq('year', year);
    const existingIds = new Set((existing ?? []).map((r: { employee_id: string }) => r.employee_id));
    const toInsert = (employees ?? [])
      .map((e: { id: string }) => e.id)
      .filter((id: string) => !existingIds.has(id));
    if (toInsert.length === 0) {
      return { error: null, granted: 0 };
    }
    const { error } = await this.supabase.supabase.from('leave_balances').insert(
      toInsert.map((employee_id: string) => ({
        employee_id,
        year,
        total_minutes: totalMinutes,
        extra_minutes: 0,
        used_minutes: 0,
      }))
    );
    if (error) return { error: error.message, granted: 0 };
    await this.loadForYear(year);
    return { error: null, granted: toInsert.length };
  }

  /** Cập nhật total_minutes và/hoặc extra_minutes của một bản ghi. */
  async updateBalance(
    employeeId: string,
    year: number,
    patch: { total_minutes?: number; extra_minutes?: number }
  ): Promise<string | null> {
    const rows = this._rows();
    const row = rows.find((r) => r.employee_id === employeeId);
    const body: Record<string, number> = {};
    if (patch.total_minutes !== undefined) body['total_minutes'] = patch.total_minutes;
    if (patch.extra_minutes !== undefined) body['extra_minutes'] = patch.extra_minutes;
    if (Object.keys(body).length === 0) return null;
    if (row?.balance_id) {
      const { error } = await this.supabase.supabase
        .from('leave_balances')
        .update(body)
        .eq('id', row.balance_id);
      return error?.message ?? null;
    }
    const { error } = await this.supabase.supabase.from('leave_balances').insert({
      employee_id: employeeId,
      year,
      total_minutes: patch.total_minutes ?? row?.total_minutes ?? 0,
      extra_minutes: patch.extra_minutes ?? row?.extra_minutes ?? 0,
      used_minutes: 0,
    });
    return error?.message ?? null;
  }

  /** Lưu hàng loạt: cập nhật/insert nhiều nhân viên, xong reload. */
  async saveBatch(
    year: number,
    updates: Array<{ employee_id: string; total_minutes?: number; extra_minutes?: number }>
  ): Promise<string | null> {
    for (const u of updates) {
      const err = await this.updateBalance(u.employee_id, year, {
        total_minutes: u.total_minutes,
        extra_minutes: u.extra_minutes,
      });
      if (err) return err;
    }
    await this.loadForYear(year);
    return null;
  }
}
