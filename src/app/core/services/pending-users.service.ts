import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface PendingUser {
  user_id: string;
  email: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class PendingUsersService {
  private readonly supabase = inject(SupabaseService);

  private readonly _list = signal<PendingUser[]>([]);
  readonly list = this._list.asReadonly();
  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  async load(): Promise<void> {
    this._loading.set(true);
    const { data, error } = await this.supabase.supabase
      .from('pending_users')
      .select('user_id, email, created_at')
      .order('created_at', { ascending: false });
    this._loading.set(false);
    if (!error) this._list.set((data ?? []) as PendingUser[]);
  }

  async addAsEmployee(params: {
    userId: string;
    email: string;
    employeeCode: string;
    fullName: string;
    role: 'employee' | 'manager' | 'hr' | 'admin';
    departmentId: string | null;
    managerId: string | null;
  }): Promise<{ error: string | null }> {
    const { error } = await this.supabase.supabase.from('employees').insert({
      id: params.userId,
      email: params.email,
      employee_code: params.employeeCode,
      full_name: params.fullName,
      role: params.role,
      department_id: params.departmentId,
      manager_id: params.managerId,
    });
    if (error) {
      if (error.code === '23505' && error.message?.includes('employee_code')) {
        return { error: 'Mã nhân viên đã tồn tại. Vui lòng chọn mã khác (vd. NV003).' };
      }
      return { error: error.message };
    }
    await this.supabase.supabase.from('pending_users').delete().eq('user_id', params.userId);
    await this.load();
    return { error: null };
  }
}
