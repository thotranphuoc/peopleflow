import { Injectable, signal, inject, computed } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { LEAVE_TYPE_LABELS, LEAVE_TYPES_WITH_DURATION, type LeaveType } from '../models';
import type { LeaveTypeConfig } from '../models';

@Injectable({ providedIn: 'root' })
export class LeaveTypeService {
  private readonly supabase = inject(SupabaseService);

  private readonly _list = signal<LeaveTypeConfig[]>([]);
  readonly list = this._list.asReadonly();
  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  /** Map code -> display_name từ DB. Fallback sang LEAVE_TYPE_LABELS nếu không có trong DB. */
  readonly labelsMap = computed(() => {
    const arr = this._list();
    const map: Record<string, string> = { ...LEAVE_TYPE_LABELS };
    for (const row of arr) {
      map[row.code] = row.display_name;
    }
    return map;
  });

  /** Loại nghỉ có duration (nguyên/nửa ngày/theo giờ). Từ DB hoặc fallback. */
  readonly typesWithDuration = computed(() => {
    const arr = this._list();
    if (arr.length === 0) return [...LEAVE_TYPES_WITH_DURATION];
    return arr.filter((r) => r.has_duration && r.is_active).map((r) => r.code as LeaveType);
  });

  /** Loại nghỉ hiển thị trong form tạo đơn. */
  readonly formVisibleTypes = computed(() => {
    const arr = this._list();
    if (arr.length === 0) {
      return (Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).filter(
        (t) => !['late_explanation', 'ot', 'off_site_work'].includes(t)
      );
    }
    return arr
      .filter((r) => r.is_form_visible && r.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => r.code as LeaveType);
  });

  /** Tất cả mã loại nghỉ (cho admin edit). */
  readonly allCodes = computed(() => {
    const arr = this._list();
    if (arr.length === 0) return Object.keys(LEAVE_TYPE_LABELS) as LeaveType[];
    return arr.sort((a, b) => a.sort_order - b.sort_order).map((r) => r.code as LeaveType);
  });

  getLabel(code: string): string {
    return this.labelsMap()[code] ?? LEAVE_TYPE_LABELS[code as LeaveType] ?? code;
  }

  hasDuration(code: string): boolean {
    return this.typesWithDuration().includes(code as LeaveType);
  }

  showDeductAnnualCheckbox(code: string): boolean {
    return code === 'sick_no_bhxh';
  }

  async loadAll(): Promise<void> {
    this._loading.set(true);
    const { data, error } = await this.supabase.supabase
      .from('leave_types')
      .select('*')
      .order('sort_order');
    this._loading.set(false);
    if (error) {
      this._list.set([]);
      return;
    }
    this._list.set((data ?? []) as LeaveTypeConfig[]);
  }

  async create(payload: {
    code: string;
    display_name: string;
    description?: string | null;
    has_duration: boolean;
    deduct_annual_leave: boolean;
    sort_order?: number;
    is_active: boolean;
    is_form_visible: boolean;
  }): Promise<{ error: string | null }> {
    const { error } = await this.supabase.supabase.from('leave_types').insert({
      code: payload.code.trim().toLowerCase().replace(/\s+/g, '_'),
      display_name: payload.display_name.trim(),
      description: payload.description?.trim() || null,
      has_duration: payload.has_duration,
      deduct_annual_leave: payload.deduct_annual_leave,
      sort_order: payload.sort_order ?? this._list().length,
      is_active: payload.is_active ?? true,
      is_form_visible: payload.is_form_visible ?? true,
    });
    if (error) return { error: error.message };
    await this.loadAll();
    return { error: null };
  }

  async update(
    id: string,
    payload: Partial<{
      code: string;
      display_name: string;
      description: string | null;
      has_duration: boolean;
      deduct_annual_leave: boolean;
      sort_order: number;
      is_active: boolean;
      is_form_visible: boolean;
    }>
  ): Promise<{ error: string | null }> {
    const patch: Record<string, unknown> = {};
    if (payload['display_name'] !== undefined) patch['display_name'] = payload['display_name']!.trim();
    if (payload['description'] !== undefined) patch['description'] = payload['description']?.trim() || null;
    if (payload['has_duration'] !== undefined) patch['has_duration'] = payload['has_duration'];
    if (payload['deduct_annual_leave'] !== undefined) patch['deduct_annual_leave'] = payload['deduct_annual_leave'];
    if (payload['sort_order'] !== undefined) patch['sort_order'] = payload['sort_order'];
    if (payload['is_active'] !== undefined) patch['is_active'] = payload['is_active'];
    if (payload['is_form_visible'] !== undefined) patch['is_form_visible'] = payload['is_form_visible'];
    if (payload['code'] !== undefined) patch['code'] = payload['code']!.trim().toLowerCase().replace(/\s+/g, '_');
    const { error } = await this.supabase.supabase.from('leave_types').update(patch).eq('id', id);
    if (error) return { error: error.message };
    await this.loadAll();
    return { error: null };
  }

  async delete(id: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase.supabase.from('leave_types').delete().eq('id', id);
    if (error) return { error: error.message };
    await this.loadAll();
    return { error: null };
  }

  /** Cập nhật sort_order theo thứ tự ids. Gọi sau khi drag reorder. */
  async reorder(ids: string[]): Promise<{ error: string | null }> {
    for (let i = 0; i < ids.length; i++) {
      const { error } = await this.supabase.supabase
        .from('leave_types')
        .update({ sort_order: i })
        .eq('id', ids[i]);
      if (error) return { error: error.message };
    }
    await this.loadAll();
    return { error: null };
  }
}
