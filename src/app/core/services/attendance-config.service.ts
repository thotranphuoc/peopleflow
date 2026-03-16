import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import type { AttendanceConfig } from '../models';

@Injectable({ providedIn: 'root' })
export class AttendanceConfigService {
  private readonly supabase = inject(SupabaseService);

  async get(): Promise<AttendanceConfig | null> {
    const { data, error } = await this.supabase.supabase
      .from('attendance_config')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as Record<string, unknown>;
    return {
      ...row,
      required_work_minutes_per_day: row['required_work_minutes_per_day'] != null ? Number(row['required_work_minutes_per_day']) : 480,
    } as AttendanceConfig;
  }

  async update(payload: {
    work_start_time?: string;
    work_end_time?: string;
    lunch_start_time?: string;
    lunch_end_time?: string;
    required_work_minutes_per_day?: number;
  }): Promise<string | null> {
    const { data: row } = await this.supabase.supabase
      .from('attendance_config')
      .select('id')
      .limit(1)
      .single();
    if (!row?.id) return 'Không tìm thấy cấu hình';
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (payload.work_start_time !== undefined) patch['work_start_time'] = payload.work_start_time;
    if (payload.work_end_time !== undefined) patch['work_end_time'] = payload.work_end_time;
    if (payload.lunch_start_time !== undefined) patch['lunch_start_time'] = payload.lunch_start_time;
    if (payload.lunch_end_time !== undefined) patch['lunch_end_time'] = payload.lunch_end_time;
    if (payload.required_work_minutes_per_day !== undefined) patch['required_work_minutes_per_day'] = payload.required_work_minutes_per_day;
    const { error } = await this.supabase.supabase
      .from('attendance_config')
      .update(patch)
      .eq('id', row.id);
    return error?.message ?? null;
  }

  /** Parse "08:00" or "08:00:00" to minutes since midnight. */
  timeToMinutes(t: string): number {
    const parts = t.trim().split(':');
    const h = parseInt(parts[0] ?? '0', 10);
    const m = parseInt(parts[1] ?? '0', 10);
    return h * 60 + m;
  }
}
