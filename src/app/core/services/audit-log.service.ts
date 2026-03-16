import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

export interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  old_value: unknown;
  new_value: unknown;
  action_by: string | null;
  action_at: string;
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  /** Ghi một dòng audit (action_by = user đăng nhập hiện tại). */
  async log(params: {
    table_name: string;
    record_id?: string | null;
    action: string;
    old_value?: unknown;
    new_value?: unknown;
  }): Promise<void> {
    const uid = this.auth.user()?.id ?? null;
    await this.supabase.supabase.from('audit_logs').insert({
      table_name: params.table_name,
      record_id: params.record_id ?? null,
      action: params.action,
      old_value: params.old_value ?? null,
      new_value: params.new_value ?? null,
      action_by: uid,
    });
  }

  /** Lấy danh sách audit log (mới nhất trước), có lọc theo bảng và khoảng thời gian. */
  async getList(filters?: {
    table_name?: string;
    action?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    let q = this.supabase.supabase
      .from('audit_logs')
      .select('*')
      .order('action_at', { ascending: false })
      .limit(Math.min(filters?.limit ?? 100, 500));
    if (filters?.table_name) q = q.eq('table_name', filters.table_name);
    if (filters?.action) q = q.eq('action', filters.action);
    if (filters?.from_date) q = q.gte('action_at', filters.from_date);
    if (filters?.to_date) q = q.lte('action_at', filters.to_date + 'T23:59:59.999Z');
    const { data, error } = await q;
    if (error) return [];
    return (data ?? []) as AuditLogEntry[];
  }
}
