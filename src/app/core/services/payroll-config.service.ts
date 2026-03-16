import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuditLogService } from './audit-log.service';
import type { PayrollConfig } from '../models';

export interface PayrollConfigRow extends PayrollConfig {
  employee_code: string;
  full_name: string;
}

@Injectable({ providedIn: 'root' })
export class PayrollConfigService {
  private readonly supabase = inject(SupabaseService);
  private readonly auditLog = inject(AuditLogService);

  async getAll(): Promise<PayrollConfigRow[]> {
    const { data, error } = await this.supabase.supabase
      .from('payroll_configs')
      .select('*, employees!inner(employee_code, full_name)')
      .order('effective_date', { ascending: false });
    if (error) return [];
    return (data ?? []).map((row: Record<string, unknown>) => {
      const emp = row['employees'] as { employee_code: string; full_name: string };
      const { employees: _, ...rest } = row;
      return { ...rest, employee_code: emp.employee_code, full_name: emp.full_name } as PayrollConfigRow;
    });
  }

  async getByEmployee(employeeId: string): Promise<PayrollConfig[]> {
    const { data, error } = await this.supabase.supabase
      .from('payroll_configs')
      .select('*')
      .eq('employee_id', employeeId)
      .order('effective_date', { ascending: false });
    if (error) return [];
    return (data ?? []) as PayrollConfig[];
  }

  async create(payload: {
    employee_id: string;
    salary_grade_id?: string | null;
    p1_salary: number;
    p2_salary: number;
    p3_salary?: number;
    dependents_count?: number;
    insurance_rate?: number;
    effective_date: string;
  }): Promise<string | null> {
    const row: Record<string, unknown> = {
      employee_id: payload.employee_id,
      p1_salary: payload.p1_salary,
      p2_salary: payload.p2_salary ?? 0,
      p3_salary: payload.p3_salary ?? 0,
      dependents_count: payload.dependents_count ?? 0,
      insurance_rate: payload.insurance_rate ?? 10.5,
      effective_date: payload.effective_date.slice(0, 10),
    };
    if (payload['salary_grade_id'] !== undefined) row['salary_grade_id'] = payload['salary_grade_id'] || null;
    const { error } = await this.supabase.supabase.from('payroll_configs').insert(row);
    if (!error) {
      await this.auditLog.log({
        table_name: 'payroll_configs',
        action: 'create',
        new_value: payload,
      });
    }
    return error?.message ?? null;
  }

  async update(
    id: string,
    payload: {
      salary_grade_id?: string | null;
      p1_salary?: number;
      p2_salary?: number;
      p3_salary?: number;
      dependents_count?: number;
      insurance_rate?: number;
      effective_date?: string;
    }
  ): Promise<string | null> {
    const patch: Record<string, unknown> = {};
    if (payload['salary_grade_id'] !== undefined) patch['salary_grade_id'] = payload['salary_grade_id'] ?? null;
    if (payload['p1_salary'] !== undefined) patch['p1_salary'] = payload['p1_salary'];
    if (payload['p2_salary'] !== undefined) patch['p2_salary'] = payload['p2_salary'];
    if (payload['p3_salary'] !== undefined) patch['p3_salary'] = payload['p3_salary'];
    if (payload['dependents_count'] !== undefined) patch['dependents_count'] = payload['dependents_count'];
    if (payload['insurance_rate'] !== undefined) patch['insurance_rate'] = payload['insurance_rate'];
    if (payload['effective_date'] !== undefined) patch['effective_date'] = (payload['effective_date'] as string).slice(0, 10);
    const { error } = await this.supabase.supabase.from('payroll_configs').update(patch).eq('id', id);
    if (!error) {
      await this.auditLog.log({
        table_name: 'payroll_configs',
        record_id: id,
        action: 'update',
        new_value: patch,
      });
    }
    return error?.message ?? null;
  }

  async delete(id: string): Promise<string | null> {
    const { error } = await this.supabase.supabase.from('payroll_configs').delete().eq('id', id);
    if (!error) {
      await this.auditLog.log({
        table_name: 'payroll_configs',
        record_id: id,
        action: 'delete',
      });
    }
    return error?.message ?? null;
  }
}
