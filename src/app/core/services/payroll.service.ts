import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import type { Payroll } from '../models';

@Injectable({ providedIn: 'root' })
export class PayrollService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  private readonly _list = signal<Payroll[]>([]);
  readonly list = this._list.asReadonly();
  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  async loadMyPayrolls(): Promise<void> {
    const uid = this.auth.user()?.id;
    if (!uid) return;
    this._loading.set(true);
    const { data, error } = await this.supabase.supabase
      .from('payrolls')
      .select('*')
      .eq('employee_id', uid)
      .eq('status', 'published')
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    this._loading.set(false);
    if (!error) this._list.set((data ?? []) as Payroll[]);
  }

  async getPayroll(month: number, year: number): Promise<Payroll | null> {
    const uid = this.auth.user()?.id;
    if (!uid) return null;
    const { data, error } = await this.supabase.supabase
      .from('payrolls')
      .select('*')
      .eq('employee_id', uid)
      .eq('month', month)
      .eq('year', year)
      .eq('status', 'published')
      .single();
    if (error) return null;
    return data as Payroll;
  }
}
