import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import type { Notification } from '../models';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  private readonly _list = signal<Notification[]>([]);
  readonly list = this._list.asReadonly();
  readonly unreadCount = computed(() => this._list().filter((n) => !n.read_at).length);

  async load(): Promise<void> {
    const uid = this.auth.user()?.id;
    if (!uid) {
      this._list.set([]);
      return;
    }
    const { data, error } = await this.supabase.supabase
      .from('notifications')
      .select('*')
      .eq('employee_id', uid)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return;
    this._list.set((data ?? []) as Notification[]);
  }

  async markRead(id: string): Promise<void> {
    const { error } = await this.supabase.supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) this._list.update((list) => list.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  }

  async markAllRead(): Promise<void> {
    const uid = this.auth.user()?.id;
    if (!uid) return;
    const { error } = await this.supabase.supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('employee_id', uid)
      .is('read_at', null);
    if (!error) await this.load();
  }

  /** Gọi từ service khác khi có sự kiện (đơn duyệt, phiếu lương công bố...). */
  async create(employeeId: string, type: string, title: string, body?: string | null): Promise<void> {
    await this.supabase.supabase.from('notifications').insert({
      employee_id: employeeId,
      type,
      title,
      body: body ?? null,
    });
  }
}
