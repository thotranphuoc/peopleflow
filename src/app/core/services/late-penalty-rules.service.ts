import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import type { LatePenaltyRule } from '../models';

@Injectable({ providedIn: 'root' })
export class LatePenaltyRulesService {
  private readonly supabase = inject(SupabaseService);

  async list(): Promise<LatePenaltyRule[]> {
    const { data, error } = await this.supabase.supabase
      .from('late_penalty_rules')
      .select('*')
      .order('threshold_minutes');
    if (error) return [];
    return (data ?? []) as LatePenaltyRule[];
  }

  /** Áp dụng bậc phạt: trả về rule có threshold lớn nhất mà <= lateMinutes. */
  getApplicableRule(rules: LatePenaltyRule[], lateMinutes: number): LatePenaltyRule | null {
    const sorted = [...rules].sort((a, b) => b.threshold_minutes - a.threshold_minutes);
    return sorted.find((r) => r.threshold_minutes <= lateMinutes) ?? null;
  }

  async update(id: string, payload: { penalty_amount?: number; half_day_unpaid?: boolean }): Promise<string | null> {
    const patch: Record<string, unknown> = {};
    if (payload.penalty_amount !== undefined) patch['penalty_amount'] = payload.penalty_amount;
    if (payload.half_day_unpaid !== undefined) patch['half_day_unpaid'] = payload.half_day_unpaid;
    if (Object.keys(patch).length === 0) return null;
    const { error } = await this.supabase.supabase.from('late_penalty_rules').update(patch).eq('id', id);
    return error?.message ?? null;
  }
}
