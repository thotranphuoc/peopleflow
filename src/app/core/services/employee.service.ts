import { Injectable, signal, computed, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import type { Employee, Department, EmployeeDependent } from '../models';

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  private readonly _currentEmployee = signal<Employee | null>(null);
  readonly currentEmployee = this._currentEmployee.asReadonly();
  readonly isManager = computed(() => this._currentEmployee()?.role === 'manager' || this._currentEmployee()?.role === 'hr' || this._currentEmployee()?.role === 'admin');
  readonly isHrOrAdmin = computed(() => this._currentEmployee()?.role === 'hr' || this._currentEmployee()?.role === 'admin');

  constructor() {
    // Load current employee when user changes
    const uid = this.auth.user()?.id;
    if (uid) void this.loadCurrentEmployee(uid);
    // Subscribe to auth user changes (effect would need untracked for async)
  }

  async loadCurrentEmployee(userId: string): Promise<void> {
    const { data, error } = await this.supabase.supabase
      .from('employees')
      .select('*')
      .eq('id', userId)
      .single();
    if (!error) this._currentEmployee.set(data as Employee);
    else this._currentEmployee.set(null);
  }

  /** Gọi sau khi auth session có user (ví dụ trong effect hoặc layout init). */
  refreshCurrentEmployee(): void {
    const uid = this.auth.user()?.id;
    if (uid) void this.loadCurrentEmployee(uid);
  }

  async getDepartments(): Promise<Department[]> {
    const { data, error } = await this.supabase.supabase.from('departments').select('*').order('code');
    if (error) return [];
    return (data ?? []) as Department[];
  }

  async createDepartment(payload: { code: string; name: string }): Promise<string | null> {
    const { error } = await this.supabase.supabase.from('departments').insert({
      code: payload.code.trim(),
      name: payload.name.trim(),
    });
    return error?.message ?? null;
  }

  async updateDepartment(id: string, payload: { code?: string; name?: string }): Promise<string | null> {
    const patch: Record<string, unknown> = {};
    if (payload['code'] !== undefined) patch['code'] = (payload['code'] as string).trim();
    if (payload['name'] !== undefined) patch['name'] = (payload['name'] as string).trim();
    const { error } = await this.supabase.supabase.from('departments').update(patch).eq('id', id);
    return error?.message ?? null;
  }

  async deleteDepartment(id: string): Promise<string | null> {
    const { error } = await this.supabase.supabase.from('departments').delete().eq('id', id);
    return error?.message ?? null;
  }

  async getEmployees(): Promise<Employee[]> {
    const { data, error } = await this.supabase.supabase
      .from('employees')
      .select('*')
      .order('employee_code');
    if (error) return [];
    return (data ?? []) as Employee[];
  }

  /**
   * Đồng bộ employees.email từ auth (email đăng nhập).
   * Gọi RPC sync_employee_emails_from_auth. Trả về số bản ghi đã cập nhật, hoặc lỗi.
   */
  async syncEmailsFromAuth(): Promise<{ count: number } | { error: string }> {
    const { data, error } = await this.supabase.supabase.rpc('sync_employee_emails_from_auth');
    if (error) return { error: error.message };
    return { count: typeof data === 'number' ? data : 0 };
  }

  async getEmployeeById(id: string): Promise<Employee | null> {
    const { data, error } = await this.supabase.supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data as Employee;
  }

  async updateEmployee(
    id: string,
    patch: Partial<Pick<Employee,
      'full_name' | 'phone' | 'role' | 'company_id' | 'department_id' | 'manager_id' | 'employee_code' |
      'date_of_birth' | 'id_number' | 'id_issue_place' | 'id_issue_date' | 'address' |
      'bank_account' | 'bank_name' | 'start_date' |
      'tax_code' | 'social_insurance_number' | 'email' |
      'contract_type' | 'contract_end_date' | 'employment_type' | 'dependents_count' |
      'emergency_contact_name' | 'emergency_contact_phone' |
      'gender' | 'job_title' | 'resignation_date' | 'status'
    >>
  ): Promise<{ error: string | null }> {
    const { error } = await this.supabase.supabase
      .from('employees')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    return { error: error?.message ?? null };
  }

  async getDependents(employeeId: string): Promise<EmployeeDependent[]> {
    const { data, error } = await this.supabase.supabase
      .from('employee_dependents')
      .select('*')
      .eq('employee_id', employeeId)
      .order('full_name');
    if (error) return [];
    return (data ?? []) as EmployeeDependent[];
  }

  async createDependent(
    employeeId: string,
    payload: { full_name: string; relationship: string; birth_year?: number | null; id_number?: string | null; note?: string | null }
  ): Promise<string | null> {
    const { error } = await this.supabase.supabase.from('employee_dependents').insert({
      employee_id: employeeId,
      full_name: payload.full_name.trim(),
      relationship: payload.relationship.trim(),
      birth_year: payload.birth_year ?? null,
      id_number: payload.id_number?.trim() || null,
      note: payload.note?.trim() || null,
    });
    return error?.message ?? null;
  }

  async updateDependent(
    id: string,
    payload: { full_name?: string; relationship?: string; birth_year?: number | null; id_number?: string | null; note?: string | null }
  ): Promise<string | null> {
    const patch: Record<string, unknown> = {};
    if (payload['full_name'] !== undefined) patch['full_name'] = (payload['full_name'] as string).trim();
    if (payload['relationship'] !== undefined) patch['relationship'] = (payload['relationship'] as string).trim();
    if (payload['birth_year'] !== undefined) patch['birth_year'] = payload['birth_year'];
    if (payload['id_number'] !== undefined) patch['id_number'] = payload['id_number']?.trim() || null;
    if (payload['note'] !== undefined) patch['note'] = payload['note']?.trim() || null;
    const { error } = await this.supabase.supabase.from('employee_dependents').update(patch).eq('id', id);
    return error?.message ?? null;
  }

  async deleteDependent(id: string): Promise<string | null> {
    const { error } = await this.supabase.supabase.from('employee_dependents').delete().eq('id', id);
    return error?.message ?? null;
  }
}
