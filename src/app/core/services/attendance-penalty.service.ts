import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AttendanceConfigService } from './attendance-config.service';
import { ShortfallPenaltyRulesService } from './shortfall-penalty-rules.service';

/** Tính phút làm thực tế (trừ nghỉ trưa) theo config. */
function effectiveMinutes(
  checkInIso: string,
  checkOutIso: string,
  lunchStartMinutes: number,
  lunchEndMinutes: number
): number {
  const start = new Date(checkInIso);
  const end = new Date(checkOutIso);
  let startM = start.getHours() * 60 + start.getMinutes() + start.getSeconds() / 60;
  let endM = end.getHours() * 60 + end.getMinutes() + end.getSeconds() / 60;
  if (start.getDate() !== end.getDate()) endM += 24 * 60;
  let work = endM - startM;
  const overlapStart = Math.max(startM, lunchStartMinutes);
  const overlapEnd = Math.min(endM, lunchEndMinutes);
  if (overlapEnd > overlapStart) work -= overlapEnd - overlapStart;
  return Math.round(Math.max(0, work));
}

@Injectable({ providedIn: 'root' })
export class AttendancePenaltyService {
  private readonly supabase = inject(SupabaseService);
  private readonly configService = inject(AttendanceConfigService);
  private readonly shortfallRulesService = inject(ShortfallPenaltyRulesService);

  /** Kiểm tra ngày có nằm trong đơn nghỉ đã duyệt không. */
  private async isDateOnApprovedLeave(employeeId: string, dateStr: string): Promise<boolean> {
    const start = dateStr + 'T00:00:00';
    const end = dateStr + 'T23:59:59';
    const { data } = await this.supabase.supabase
      .from('leave_requests')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('status', 'approved')
      .lte('start_time', end)
      .gte('end_time', start)
      .limit(1);
    return (data?.length ?? 0) > 0;
  }

  /**
   * Áp dụng phạt thiếu giờ cho một ngày (gọi sau khi check-out).
   * Nếu ngày thuộc đơn nghỉ đã duyệt → xóa phạt (clear). Ngược lại tính shortfall và upsert.
   */
  async applyShortfallForDay(employeeId: string, workDate: string): Promise<string | null> {
    const config = await this.configService.get();
    const required = config?.required_work_minutes_per_day ?? 480;
    const onLeave = await this.isDateOnApprovedLeave(employeeId, workDate);
    if (onLeave) {
      await this.supabase.supabase
        .from('attendance_penalties')
        .delete()
        .eq('employee_id', employeeId)
        .eq('work_date', workDate);
      return null;
    }
    const { data: att } = await this.supabase.supabase
      .from('attendances')
      .select('id, check_in_time, check_out_time')
      .eq('employee_id', employeeId)
      .eq('work_date', workDate)
      .maybeSingle();
    let effective = 0;
    let attendanceId: string | null = null;
    if (att?.check_in_time && att?.check_out_time && config) {
      const lunchStart = this.configService.timeToMinutes(config.lunch_start_time);
      const lunchEnd = this.configService.timeToMinutes(config.lunch_end_time);
      effective = effectiveMinutes(att.check_in_time, att.check_out_time, lunchStart, lunchEnd);
      attendanceId = att.id;
    }
    const shortfall = Math.max(0, required - effective);
    const rules = await this.shortfallRulesService.list();
    const rule = this.shortfallRulesService.getApplicableRule(rules, shortfall);
    if (!rule) {
      if (shortfall > 0) {
        await this.supabase.supabase.from('attendance_penalties').delete().eq('employee_id', employeeId).eq('work_date', workDate);
      }
      return null;
    }
    const { error } = await this.supabase.supabase.from('attendance_penalties').upsert(
      {
        employee_id: employeeId,
        work_date: workDate,
        attendance_id: attendanceId,
        late_minutes: 0,
        shortfall_minutes: shortfall,
        penalty_amount: rule.penalty_amount,
        half_day_unpaid: rule.half_day_unpaid,
      },
      { onConflict: 'employee_id,work_date' }
    );
    return error?.message ?? null;
  }

  /** Xóa phạt cho các ngày trong khoảng đơn nghỉ (gọi khi duyệt đơn). */
  async clearPenaltiesForLeave(employeeId: string, startDate: string, endDate: string): Promise<void> {
    const dates: string[] = [];
    const d = new Date(startDate + 'T12:00:00');
    const endD = new Date(endDate + 'T12:00:00');
    while (d <= endD) {
      dates.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    if (dates.length === 0) return;
    await this.supabase.supabase
      .from('attendance_penalties')
      .delete()
      .eq('employee_id', employeeId)
      .in('work_date', dates);
  }

  /** Tổng tiền phạt của nhân viên trong tháng (dùng cho phiếu lương). */
  async getTotalPenaltyForMonth(employeeId: string, month: number, year: number): Promise<number> {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const { data, error } = await this.supabase.supabase
      .from('attendance_penalties')
      .select('penalty_amount')
      .eq('employee_id', employeeId)
      .gte('work_date', start)
      .lte('work_date', end);
    if (error) return 0;
    return (data ?? []).reduce((sum: number, r: { penalty_amount: number }) => sum + Number(r.penalty_amount), 0);
  }

  /** Số nửa ngày không lương trong tháng (trừ vào ngày làm việc). */
  async getHalfDayUnpaidCountForMonth(employeeId: string, month: number, year: number): Promise<number> {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const { data, error } = await this.supabase.supabase
      .from('attendance_penalties')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('half_day_unpaid', true)
      .gte('work_date', start)
      .lte('work_date', end);
    if (error) return 0;
    return (data ?? []).length;
  }
}
