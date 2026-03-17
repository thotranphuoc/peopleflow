import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { HolidayService } from './holiday.service';
import { AttendanceConfigService } from './attendance-config.service';

export interface AttendanceReportRow {
  employee_id: string;
  employee_code: string;
  full_name: string;
  department_code: string | null;
  /** Số ngày làm theo lịch (trong tháng, trừ T7/CN và ngày lễ). */
  working_days_in_month: number;
  /** Số ngày có chấm công. */
  work_days: number;
  /** Số ngày nghỉ (đơn đã duyệt) trong tháng. */
  leave_days: number;
  /** Tổng phút thiếu so với quy định (từ attendance_penalties). */
  total_shortfall_minutes: number;
}

/** Một dòng báo cáo chấm công theo ngày (chi tiết từng ca). */
export interface AttendanceDayRow {
  employee_id: string;
  employee_code: string;
  full_name: string;
  department_code: string | null;
  work_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  total_work_minutes: number | null;
  status: string;
  supplement_reason: string | null;
  approval_note: string | null;
  /** false = chấm công ngoài khu vực văn phòng (cần duyệt). */
  is_valid_location?: boolean;
  /** Tọa độ GPS check-in "lat,lng" (để mở Maps). */
  check_in_lat_lng?: string | null;
}

export interface LeaveReportRow {
  employee_id: string;
  employee_code: string;
  full_name: string;
  department_code: string | null;
  total_days: number;
  used_days: number;
  remaining_days: number;
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly supabase = inject(SupabaseService);
  private readonly holidayService = inject(HolidayService);
  private readonly attendanceConfig = inject(AttendanceConfigService);

  /** Phút làm thực tế (trừ nghỉ trưa) cho một ca làm việc. */
  private effectiveMinutes(
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

  async getAttendanceReport(month: number, year: number, departmentId?: string | null, employeeId?: string | null): Promise<AttendanceReportRow[]> {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const holidaySet = await this.holidayService.getHolidayDatesInRange(start, end);
    let workingDaysInMonth = 0;
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, d).getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) workingDaysInMonth += 1;
    }

    let employeeQuery = this.supabase.supabase
      .from('employees')
      .select('id, employee_code, full_name, department_id')
      .order('employee_code');
    if (employeeId) {
      employeeQuery = employeeQuery.eq('id', employeeId);
    } else if (departmentId) {
      employeeQuery = employeeQuery.eq('department_id', departmentId);
    }
    const { data: employees } = await employeeQuery;
    if (!employees?.length) return [];

    const empIds = (employees as { id: string }[]).map((e) => e.id);

    const [attendancesRes, leaveRes, config] = await Promise.all([
      this.supabase.supabase
        .from('attendances')
        .select('employee_id, work_date, check_in_time, check_out_time')
        .in('employee_id', empIds)
        .gte('work_date', start)
        .lte('work_date', end),
      this.supabase.supabase
        .from('leave_requests')
        .select('employee_id, start_time, end_time')
        .in('employee_id', empIds)
        .eq('status', 'approved')
        .lte('start_time', end + 'T23:59:59')
        .gte('end_time', start + 'T00:00:00'),
      this.attendanceConfig.get(),
    ]);

    const requiredMinutesPerDay = config?.required_work_minutes_per_day ?? 480;
    const lunchStartMinutes =
      config?.lunch_start_time != null ? this.attendanceConfig.timeToMinutes(config.lunch_start_time) : 720; // 12:00
    const lunchEndMinutes =
      config?.lunch_end_time != null ? this.attendanceConfig.timeToMinutes(config.lunch_end_time) : 810; // 13:30

    const byEmployee = new Map<
      string,
      {
        work_days: number;
        effective_minutes: number;
        leave_days: number;
      }
    >();
    for (const id of empIds) {
      byEmployee.set(id, {
        work_days: 0,
        effective_minutes: 0,
        leave_days: 0,
      });
    }

    for (const r of attendancesRes.data ?? []) {
      const row = r as {
        employee_id: string;
        check_in_time: string | null;
        check_out_time: string | null;
      };
      const cur = byEmployee.get(row.employee_id);
      if (cur) {
        cur.work_days += 1;
        if (row.check_in_time && row.check_out_time) {
          const raw = this.effectiveMinutes(
            row.check_in_time,
            row.check_out_time,
            lunchStartMinutes,
            lunchEndMinutes
          );
          cur.effective_minutes += Math.min(requiredMinutesPerDay, raw);
        }
      }
    }

    const leaveDaysByEmp = new Map<string, Set<string>>();
    for (const id of empIds) leaveDaysByEmp.set(id, new Set());
    for (const lr of leaveRes.data ?? []) {
      const row = lr as { employee_id: string; start_time: string; end_time: string };
      const leaveStart = row.start_time.slice(0, 10);
      const leaveEnd = row.end_time.slice(0, 10);
      for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (dateStr >= leaveStart && dateStr <= leaveEnd) {
          leaveDaysByEmp.get(row.employee_id)?.add(dateStr);
        }
      }
    }
    for (const [empId, set] of leaveDaysByEmp) {
      const cur = byEmployee.get(empId);
      if (cur) cur.leave_days = set.size;
    }

    const deptIds = [...new Set((employees ?? []).map((e: { department_id: string | null }) => e.department_id).filter(Boolean))] as string[];
    let departments: { id: string; code: string }[] = [];
    if (deptIds.length > 0) {
      const { data: depts } = await this.supabase.supabase.from('departments').select('id, code').in('id', deptIds);
      departments = (depts ?? []) as { id: string; code: string }[];
    }
    const deptCodeById = new Map(departments.map((d) => [d.id, d.code]));

    const result: AttendanceReportRow[] = [];
    for (const e of employees) {
      const emp = e as { id: string; employee_code: string; full_name: string; department_id: string | null };
      const agg = byEmployee.get(emp.id) ?? {
        work_days: 0,
        effective_minutes: 0,
        leave_days: 0,
      };

      const expectedMinutes = (workingDaysInMonth - agg.leave_days) * requiredMinutesPerDay;
      const shortfallMinutes = Math.max(0, expectedMinutes - agg.effective_minutes);
      result.push({
        employee_id: emp.id,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        department_code: emp.department_id ? deptCodeById.get(emp.department_id) ?? null : null,
        working_days_in_month: workingDaysInMonth,
        work_days: agg.work_days,
        leave_days: agg.leave_days,
        total_shortfall_minutes: shortfallMinutes,
      });
    }
    result.sort((a, b) => a.employee_code.localeCompare(b.employee_code));
    return result;
  }

  /** Danh sách chấm công chờ duyệt (bổ sung). Có thể lọc theo phòng ban, tháng/năm, nhân viên. */
  async getPendingAttendances(departmentId?: string | null, month?: number, year?: number, employeeId?: string | null): Promise<AttendanceDayRow[]> {
    let empQuery = this.supabase.supabase
      .from('employees')
      .select('id, employee_code, full_name, department_id')
      .order('employee_code');
    if (employeeId) empQuery = empQuery.eq('id', employeeId);
    else if (departmentId) empQuery = empQuery.eq('department_id', departmentId);
    const { data: employees } = await empQuery;
    if (!employees?.length) return [];

    const empIds = (employees as { id: string }[]).map((e) => e.id);

    let attQuery = this.supabase.supabase
      .from('attendances')
      .select(
        'employee_id, work_date, check_in_time, check_out_time, status, supplement_reason, approval_note, is_valid_location, check_in_lat_lng'
      )
      .eq('status', 'pending')
      .in('employee_id', empIds);
    if (month != null && year != null) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      attQuery = attQuery.gte('work_date', start).lte('work_date', end);
    }
    const { data: rows } = await attQuery.order('work_date', { ascending: false });

    const config = await this.attendanceConfig.get();
    const lunchStartMinutes =
      config?.lunch_start_time != null ? this.attendanceConfig.timeToMinutes(config.lunch_start_time) : 720;
    const lunchEndMinutes =
      config?.lunch_end_time != null ? this.attendanceConfig.timeToMinutes(config.lunch_end_time) : 810;
    const requiredMinutesPerDay = config?.required_work_minutes_per_day ?? 480;

    const empById = new Map(
      (employees ?? []).map((e: { id: string; employee_code: string; full_name: string; department_id: string | null }) => [
        e.id,
        { employee_code: e.employee_code, full_name: e.full_name, department_id: e.department_id },
      ])
    );
    const deptIds = [...new Set((employees ?? []).map((e: { department_id: string | null }) => e.department_id).filter(Boolean))] as string[];
    const { data: depts } = await this.supabase.supabase.from('departments').select('id, code').in('id', deptIds);
    const deptCodeById = new Map((depts ?? []).map((d: { id: string; code: string }) => [d.id, d.code]));

    const result: AttendanceDayRow[] = [];
    for (const r of rows ?? []) {
      const row = r as {
        employee_id: string;
        work_date: string;
        check_in_time: string | null;
        check_out_time: string | null;
        status: string;
        supplement_reason: string | null;
        approval_note: string | null;
        is_valid_location?: boolean;
        check_in_lat_lng?: string | null;
      };
      const emp = empById.get(row.employee_id);
      if (!emp) continue;
      let totalWorkMinutes: number | null = null;
      if (row.check_in_time && row.check_out_time) {
        const raw = this.effectiveMinutes(
          row.check_in_time,
          row.check_out_time,
          lunchStartMinutes,
          lunchEndMinutes
        );
        totalWorkMinutes = Math.min(requiredMinutesPerDay, raw);
      }
      result.push({
        employee_id: row.employee_id,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        department_code: emp.department_id ? deptCodeById.get(emp.department_id) ?? null : null,
        work_date: row.work_date,
        check_in_time: row.check_in_time,
        check_out_time: row.check_out_time,
        total_work_minutes: totalWorkMinutes,
        status: row.status ?? 'pending',
        supplement_reason: row.supplement_reason ?? null,
        approval_note: row.approval_note ?? null,
        is_valid_location: row.is_valid_location ?? true,
        check_in_lat_lng: row.check_in_lat_lng ?? null,
      });
    }
    result.sort((a, b) => b.work_date.localeCompare(a.work_date) || a.employee_code.localeCompare(b.employee_code));
    return result;
  }

  async getAttendanceReportByDay(
    date: string,
    departmentId?: string | null,
    endDate?: string | null,
    employeeId?: string | null
  ): Promise<AttendanceDayRow[]> {
    let employeeQuery = this.supabase.supabase
      .from('employees')
      .select('id, employee_code, full_name, department_id')
      .order('employee_code');
    if (employeeId) {
      employeeQuery = employeeQuery.eq('id', employeeId);
    } else if (departmentId) {
      employeeQuery = employeeQuery.eq('department_id', departmentId);
    }
    const { data: employees } = await employeeQuery;
    if (!employees?.length) return [];

    const empIds = (employees as { id: string }[]).map((e) => e.id);
    let attQuery = this.supabase.supabase
      .from('attendances')
      .select(
        'employee_id, work_date, check_in_time, check_out_time, status, supplement_reason, approval_note, is_valid_location, check_in_lat_lng'
      )
      .in('employee_id', empIds);
    if (endDate) {
      attQuery = attQuery.gte('work_date', date).lte('work_date', endDate);
    } else {
      attQuery = attQuery.eq('work_date', date);
    }
    const [rowsRes, config] = await Promise.all([attQuery, this.attendanceConfig.get()]);
    const { data: rows } = rowsRes;
    const lunchStartMinutes =
      config?.lunch_start_time != null ? this.attendanceConfig.timeToMinutes(config.lunch_start_time) : 720;
    const lunchEndMinutes =
      config?.lunch_end_time != null ? this.attendanceConfig.timeToMinutes(config.lunch_end_time) : 810;
    const requiredMinutesPerDay = config?.required_work_minutes_per_day ?? 480;

    const deptIds = [
      ...new Set(
        (employees ?? []).map((e: { department_id: string | null }) => e.department_id).filter(Boolean)
      ),
    ] as string[];
    let departments: { id: string; code: string }[] = [];
    if (deptIds.length > 0) {
      const { data: depts } = await this.supabase.supabase
        .from('departments')
        .select('id, code')
        .in('id', deptIds);
      departments = (depts ?? []) as { id: string; code: string }[];
    }
    const deptCodeById = new Map(departments.map((d) => [d.id, d.code]));
    const empById = new Map(
      (employees ?? []).map((e: { id: string; employee_code: string; full_name: string; department_id: string | null }) => [
        e.id,
        { employee_code: e.employee_code, full_name: e.full_name, department_id: e.department_id },
      ])
    );

    const result: AttendanceDayRow[] = [];
    for (const r of rows ?? []) {
      const row = r as {
        employee_id: string;
        work_date: string;
        check_in_time: string | null;
        check_out_time: string | null;
        status: string;
        supplement_reason: string | null;
        approval_note: string | null;
        is_valid_location?: boolean;
        check_in_lat_lng?: string | null;
      };
      const emp = empById.get(row.employee_id);
      if (!emp) continue;
      let totalWorkMinutes: number | null = null;
      if (row.check_in_time && row.check_out_time) {
        const raw = this.effectiveMinutes(
          row.check_in_time,
          row.check_out_time,
          lunchStartMinutes,
          lunchEndMinutes
        );
        totalWorkMinutes = Math.min(requiredMinutesPerDay, raw);
      }
      result.push({
        employee_id: row.employee_id,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        department_code: emp.department_id ? deptCodeById.get(emp.department_id) ?? null : null,
        work_date: row.work_date,
        check_in_time: row.check_in_time,
        check_out_time: row.check_out_time,
        total_work_minutes: totalWorkMinutes,
        status: row.status ?? 'pending',
        supplement_reason: row.supplement_reason ?? null,
        approval_note: row.approval_note ?? null,
        is_valid_location: row.is_valid_location ?? true,
        check_in_lat_lng: row.check_in_lat_lng ?? null,
      });
    }
    result.sort((a, b) => a.employee_code.localeCompare(b.employee_code));
    return result;
  }

  /** Manager/Admin duyệt hoặc từ chối chấm công (bổ sung). Trả về error message hoặc null. */
  async updateAttendanceStatus(
    employeeId: string,
    workDate: string,
    status: 'valid' | 'violation',
    approvalNote?: string | null
  ): Promise<string | null> {
    const { error } = await this.supabase.supabase
      .from('attendances')
      .update({
        status,
        approval_note: approvalNote ?? null,
      })
      .eq('employee_id', employeeId)
      .eq('work_date', workDate);
    return error?.message ?? null;
  }

  async getLeaveReport(year: number, departmentId?: string | null): Promise<LeaveReportRow[]> {
    let empQuery = this.supabase.supabase
      .from('employees')
      .select('id, employee_code, full_name, department_id')
      .order('employee_code');
    if (departmentId) {
      empQuery = empQuery.eq('department_id', departmentId);
    }
    const { data: employees } = await empQuery;
    const empIds = (employees ?? []).map((e: { id: string }) => e.id);
    if (empIds.length === 0) return [];

    const { data: balances } = await this.supabase.supabase
      .from('leave_balances')
      .select('employee_id, total_minutes, extra_minutes, used_minutes')
      .eq('year', year)
      .in('employee_id', empIds);
    const balanceByEmp = new Map<string, { total_minutes: number; used_minutes: number }>();
    for (const b of balances ?? []) {
      const row = b as { employee_id: string; total_minutes: number; extra_minutes?: number; used_minutes: number };
      const extra = row.extra_minutes ?? 0;
      balanceByEmp.set(row.employee_id, {
        total_minutes: row.total_minutes + extra,
        used_minutes: row.used_minutes,
      });
    }

    const deptIds = [...new Set((employees ?? []).map((e: { department_id: string | null }) => e.department_id).filter(Boolean))] as string[];
    let departments: { id: string; code: string }[] = [];
    if (deptIds.length > 0) {
      const { data: depts } = await this.supabase.supabase.from('departments').select('id, code').in('id', deptIds);
      departments = (depts ?? []) as { id: string; code: string }[];
    }
    const deptCodeById = new Map(departments.map((d) => [d.id, d.code]));

    const result: LeaveReportRow[] = [];
    for (const e of employees ?? []) {
      const emp = e as { id: string; employee_code: string; full_name: string; department_id: string | null };
      const bal = balanceByEmp.get(emp.id) ?? { total_minutes: 0, used_minutes: 0 };
      const totalDays = bal.total_minutes / 480;
      const usedDays = bal.used_minutes / 480;
      const remainingDays = Math.max(0, totalDays - usedDays);
      result.push({
        employee_id: emp.id,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        department_code: emp.department_id ? deptCodeById.get(emp.department_id) ?? null : null,
        total_days: totalDays,
        used_days: usedDays,
        remaining_days: remainingDays,
      });
    }
    return result;
  }
}
