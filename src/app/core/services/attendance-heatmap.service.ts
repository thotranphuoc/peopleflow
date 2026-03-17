import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AttendanceConfigService } from './attendance-config.service';
import { LeaveTypeService } from './leave-type.service';
import { DURATION_LABELS } from '../models';
import type { LeaveType, LeaveDuration } from '../models';

export interface HeatMapDay {
  date: string;
  effectiveMinutes: number | null;
  isLeave: boolean;
  /** Loại nghỉ (hiển thị trên ô), null nếu không nghỉ phép. */
  leaveTypeLabel: string | null;
  /** Tiền phạt đi trễ ngày đó (đồng). */
  penaltyAmount: number;
  check_in_time: string | null;
  check_out_time: string | null;
}

const LUNCH_START = 12 * 60;
const LUNCH_END = 13 * 60 + 30;
const LUNCH_MINUTES = 90;

/** Trừ nghỉ trưa 12:00-13:30 khỏi khoảng check_in - check_out, trả về phút làm thực tế. */
export function effectiveWorkMinutes(
  checkInIso: string,
  checkOutIso: string
): number {
  const start = new Date(checkInIso);
  const end = new Date(checkOutIso);
  let startM = start.getHours() * 60 + start.getMinutes() + start.getSeconds() / 60;
  let endM = end.getHours() * 60 + end.getMinutes() + end.getSeconds() / 60;
  if (start.getDate() !== end.getDate()) {
    endM += 24 * 60;
  }
  let work = endM - startM;
  const lunchOverlapStart = Math.max(startM, LUNCH_START);
  const lunchOverlapEnd = Math.min(endM, LUNCH_END);
  if (lunchOverlapEnd > lunchOverlapStart) {
    work -= lunchOverlapEnd - lunchOverlapStart;
  }
  return Math.round(Math.max(0, work));
}

@Injectable({ providedIn: 'root' })
export class AttendanceHeatmapService {
  private readonly supabase = inject(SupabaseService);
  private readonly configService = inject(AttendanceConfigService);
  private readonly leaveTypeService = inject(LeaveTypeService);

  /**
   * Dữ liệu heat map: từng ngày có effectiveMinutes (trừ trưa), isLeave.
   * Nếu month: trả về các ngày trong tháng. Nếu chỉ year: trả về tất cả ngày trong năm (cho lưới 7x52).
   */
  async getHeatMapData(
    employeeId: string,
    year: number,
    month?: number
  ): Promise<HeatMapDay[]> {
    const start =
      month != null
        ? `${year}-${String(month).padStart(2, '0')}-01`
        : `${year}-01-01`;
    const end =
      month != null
        ? `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`
        : `${year}-12-31`;

    const [attendancesRes, leaveRes, penaltiesRes, config] = await Promise.all([
      this.supabase.supabase
        .from('attendances')
        .select('work_date, check_in_time, check_out_time')
        .eq('employee_id', employeeId)
        .gte('work_date', start)
        .lte('work_date', end)
        .order('work_date'),
      this.supabase.supabase
        .from('leave_requests')
        .select('start_time, end_time, request_type, leave_type')
        .eq('employee_id', employeeId)
        .eq('status', 'approved')
        .lte('start_time', end + 'T23:59:59')
        .gte('end_time', start + 'T00:00:00'),
      this.supabase.supabase
        .from('attendance_penalties')
        .select('work_date, penalty_amount')
        .eq('employee_id', employeeId)
        .gte('work_date', start)
        .lte('work_date', end),
      this.configService.get(),
    ]);

    const attByDate = new Map<string, { check_in_time: string; check_out_time: string }>();
    for (const a of attendancesRes.data ?? []) {
      const row = a as { work_date: string; check_in_time: string | null; check_out_time: string | null };
      if (row.check_in_time && row.check_out_time) {
        attByDate.set(row.work_date, {
          check_in_time: row.check_in_time,
          check_out_time: row.check_out_time,
        });
      }
    }

    const labels = this.leaveTypeService.labelsMap();
    const leaveTypeLabel = (row: { leave_type?: string; request_type?: string }): string => {
      const lt = (row.leave_type ?? 'annual_leave') as LeaveType;
      const rt = row.request_type as LeaveDuration | string | undefined;
      const typeName = labels[lt] ?? row.leave_type ?? 'Nghỉ phép';
      if (rt && (rt === 'leave_full' || rt === 'leave_half' || rt === 'leave_hours')) {
        const dur = DURATION_LABELS[rt as LeaveDuration];
        return `${typeName} (${dur})`;
      }
      return typeName;
    };

    const leaveRanges = (leaveRes.data ?? []).map((r) => {
      const row = r as { start_time: string; end_time: string; request_type?: string; leave_type?: string };
      return {
        start: new Date(row.start_time).getTime(),
        end: new Date(row.end_time).getTime(),
        label: leaveTypeLabel(row),
      };
    });

    const penaltyByDate = new Map<string, number>();
    for (const p of penaltiesRes.data ?? []) {
      const row = p as { work_date: string; penalty_amount: number };
      const amt = Number(row.penalty_amount) || 0;
      penaltyByDate.set(row.work_date, (penaltyByDate.get(row.work_date) ?? 0) + amt);
    }

    function getLeaveLabelForDate(dateStr: string): string | null {
      const t = new Date(dateStr + 'T12:00:00').getTime();
      const range = leaveRanges.find((r) => t >= r.start && t <= r.end);
      return range?.label ?? null;
    }

    const maxMinutesPerDay = config?.required_work_minutes_per_day ?? 480;
    const result: HeatMapDay[] = [];
    const d = new Date(start);
    const endDate = new Date(end);
    while (d <= endDate) {
      const dateStr = d.toISOString().slice(0, 10);
      const att = attByDate.get(dateStr);
      const leaveLabel = getLeaveLabelForDate(dateStr);
      const isLeave = leaveLabel != null;
      let effectiveMinutes: number | null = null;
      if (att) {
        const raw = effectiveWorkMinutes(att.check_in_time, att.check_out_time);
        effectiveMinutes = Math.min(maxMinutesPerDay, raw);
      }
      result.push({
        date: dateStr,
        effectiveMinutes,
        isLeave,
        leaveTypeLabel: leaveLabel ?? null,
        penaltyAmount: penaltyByDate.get(dateStr) ?? 0,
        check_in_time: att?.check_in_time ?? null,
        check_out_time: att?.check_out_time ?? null,
      });
      d.setDate(d.getDate() + 1);
    }
    return result;
  }

  /** Màu ô theo phút: >= 480 xanh, < 360 đỏ, giữa vàng/cam. Leave = xám. */
  getDayColor(day: HeatMapDay): string {
    if (day.isLeave) return 'var(--ml-heat-leave, #e2e8f0)';
    if (day.effectiveMinutes == null) return 'var(--ml-heat-empty, #f1f5f9)';
    if (day.effectiveMinutes >= 480) return 'var(--ml-heat-ok, #22c55e)';
    if (day.effectiveMinutes < 360) return 'var(--ml-heat-bad, #ef4444)';
    return 'var(--ml-heat-mid, #eab308)';
  }
}
