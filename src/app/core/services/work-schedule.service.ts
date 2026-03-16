import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { HolidayService } from './holiday.service';
import type { WorkSchedule } from '../models';

@Injectable({ providedIn: 'root' })
export class WorkScheduleService {
  private readonly supabase = inject(SupabaseService);
  private readonly holidayService = inject(HolidayService);

  /** Lấy lịch làm việc mặc định (is_default = true). */
  async getDefault(): Promise<WorkSchedule | null> {
    const { data, error } = await this.supabase.supabase
      .from('work_schedule')
      .select('*')
      .eq('is_default', true)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as WorkSchedule;
  }

  /** Lấy tất cả lịch (cho admin). */
  async getAll(): Promise<WorkSchedule[]> {
    const { data, error } = await this.supabase.supabase
      .from('work_schedule')
      .select('*')
      .order('working_days_per_week');
    if (error) return [];
    return (data ?? []) as WorkSchedule[];
  }

  /** Đặt lịch làm mặc định (is_default). Trả về error message hoặc null. */
  async setDefault(id: string): Promise<string | null> {
    const { error: err1 } = await this.supabase.supabase
      .from('work_schedule')
      .update({ is_default: false })
      .eq('is_default', true);
    if (err1) return err1.message;
    const { error: err2 } = await this.supabase.supabase
      .from('work_schedule')
      .update({ is_default: true })
      .eq('id', id);
    if (err2) return err2.message;
    return null;
  }

  /**
   * Số ngày làm việc trong tháng (theo lịch mặc định, trừ ngày lễ).
   * Thứ 7 nửa ngày (saturday_half_only) tính 0.5.
   */
  async getWorkingDaysInMonth(year: number, month: number): Promise<number> {
    const schedule = await this.getDefault();
    if (!schedule) return 0;

    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const holidaySet = await this.holidayService.getHolidayDatesInRange(start, end);

    const dayToWork: Record<number, number> = {
      0: schedule.sunday ? 1 : 0,
      1: schedule.monday ? 1 : 0,
      2: schedule.tuesday ? 1 : 0,
      3: schedule.wednesday ? 1 : 0,
      4: schedule.thursday ? 1 : 0,
      5: schedule.friday ? 1 : 0,
      6: schedule.saturday ? (schedule.saturday_half_only ? 0.5 : 1) : 0,
    };

    let total = 0;
    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(year, month - 1, d);
      const dow = date.getDay();
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (!holidaySet.has(dateStr)) total += dayToWork[dow];
    }
    return Math.round(total * 10) / 10;
  }
}
