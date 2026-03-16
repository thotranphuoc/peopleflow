import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { HolidayService } from './holiday.service';
import { AuditLogService } from './audit-log.service';
import { NotificationService } from './notification.service';
import { AttendancePenaltyService } from './attendance-penalty.service';
import { deductsAnnualLeave, type LeaveRequest, type LeaveType } from '../models';

@Injectable({ providedIn: 'root' })
export class LeaveRequestService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly holidayService = inject(HolidayService);
  private readonly auditLog = inject(AuditLogService);
  private readonly notificationService = inject(NotificationService);
  private readonly attendancePenaltyService = inject(AttendancePenaltyService);

  private readonly _list = signal<LeaveRequest[]>([]);
  readonly list = this._list.asReadonly();
  private readonly _pendingForManager = signal<LeaveRequest[]>([]);
  readonly pendingForManager = this._pendingForManager.asReadonly();
  private readonly _balance = signal<{ total_minutes: number; used_minutes: number } | null>(null);
  readonly balance = this._balance.asReadonly();
  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();
  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  async loadMyRequests(): Promise<void> {
    const uid = this.auth.user()?.id;
    if (!uid) return;
    this._loading.set(true);
    this._error.set(null);
    const { data, error } = await this.supabase.supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', uid)
      .order('created_at', { ascending: false });
    this._loading.set(false);
    if (error) {
      this._error.set(error.message);
      this._list.set([]);
      return;
    }
    this._list.set((data ?? []) as LeaveRequest[]);
  }

  async loadPendingForManager(managerId: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    const { data, error } = await this.supabase.supabase
      .from('leave_requests')
      .select('*')
      .eq('manager_id', managerId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) {
      this._loading.set(false);
      this._error.set(error.message);
      this._pendingForManager.set([]);
      return;
    }
    const rows = (data ?? []) as LeaveRequest[];
    const empIds = [...new Set(rows.map((r) => r.employee_id))];
    let empMap = new Map<string, { employee_code: string; full_name: string; department_name: string }>();
    if (empIds.length > 0) {
      const { data: emps } = await this.supabase.supabase
        .from('employees')
        .select('id, employee_code, full_name, department_id')
        .in('id', empIds);
      const deptIds = [...new Set((emps ?? []).map((e: { department_id: string | null }) => e.department_id).filter(Boolean))] as string[];
      let deptMap = new Map<string, string>();
      if (deptIds.length > 0) {
        const { data: depts } = await this.supabase.supabase.from('departments').select('id, code, name').in('id', deptIds);
        deptMap = new Map((depts ?? []).map((d: { id: string; code: string; name: string }) => [d.id, `${d.code} — ${d.name}`]));
      }
      for (const e of emps ?? []) {
        const emp = e as { id: string; employee_code: string; full_name: string; department_id: string | null };
        empMap.set(emp.id, {
          employee_code: emp.employee_code,
          full_name: emp.full_name,
          department_name: emp.department_id ? deptMap.get(emp.department_id) ?? '' : '',
        });
      }
    }
    const merged = rows.map((r) => ({
      ...r,
      employee_code: empMap.get(r.employee_id)?.employee_code ?? '',
      full_name: empMap.get(r.employee_id)?.full_name ?? '',
      department_name: empMap.get(r.employee_id)?.department_name ?? '',
    }));
    this._loading.set(false);
    this._pendingForManager.set(merged);
  }

  async loadLeaveBalance(employeeId: string, year: number): Promise<void> {
    const { data } = await this.supabase.supabase
      .from('leave_balances')
      .select('total_minutes, extra_minutes, used_minutes')
      .eq('employee_id', employeeId)
      .eq('year', year)
      .maybeSingle();
    if (data) {
      const extra = (data as { extra_minutes?: number }).extra_minutes ?? 0;
      this._balance.set({
        total_minutes: data.total_minutes + extra,
        used_minutes: data.used_minutes,
      });
    } else {
      this._balance.set(null);
    }
  }

  async create(request: {
    leave_type: LeaveType;
    request_type: LeaveRequest['request_type'];
    start_time: string;
    end_time: string;
    total_minutes_requested: number;
    reason?: string;
    manager_id?: string | null;
    deduct_annual_leave?: boolean;
  }): Promise<{ error: string | null }> {
    const uid = this.auth.user()?.id;
    if (!uid) return { error: 'Chưa đăng nhập' };
    const { error } = await this.supabase.supabase.from('leave_requests').insert({
      employee_id: uid,
      manager_id: request.manager_id ?? null,
      leave_type: request.leave_type,
      request_type: request.request_type,
      deduct_annual_leave: request.deduct_annual_leave ?? false,
      start_time: request.start_time,
      end_time: request.end_time,
      total_minutes_requested: request.total_minutes_requested,
      reason: request.reason ?? null,
      status: 'pending',
    });
    if (error) return { error: error.message };
    await this.loadMyRequests();
    const balYear = new Date().getFullYear();
    await this.loadLeaveBalance(uid, balYear);
    return { error: null };
  }

  async approve(id: string, managerNote?: string): Promise<{ error: string | null }> {
    const { data: row } = await this.supabase.supabase
      .from('leave_requests')
      .select('employee_id, request_type, leave_type, deduct_annual_leave, start_time, end_time, total_minutes_requested')
      .eq('id', id)
      .single();
    const { error } = await this.supabase.supabase
      .from('leave_requests')
      .update({ status: 'approved', manager_note: managerNote ?? null, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { error: error.message };
    if (row?.employee_id && row?.start_time && row?.end_time) {
      const startDate = row.start_time.slice(0, 10);
      const endDate = row.end_time.slice(0, 10);
      await this.attendancePenaltyService.clearPenaltiesForLeave(row.employee_id, startDate, endDate);
    }
    const leaveType = (row?.leave_type ?? 'annual_leave') as LeaveType;
    const deductFlag = row?.deduct_annual_leave ?? false;
    if (row?.request_type === 'off_site_work' && row.employee_id && row.start_time && row.end_time) {
      const startDate = row.start_time.slice(0, 10);
      const endDate = row.end_time.slice(0, 10);
      await this.supabase.supabase
        .from('attendances')
        .update({ status: 'valid', is_valid_location: true })
        .eq('employee_id', row.employee_id)
        .gte('work_date', startDate)
        .lte('work_date', endDate);
    }
    if (row?.employee_id && deductsAnnualLeave(leaveType, deductFlag)) {
      const rt = row.request_type;
      const isDuration = rt === 'leave_full' || rt === 'leave_half' || rt === 'leave_hours';
      if (isDuration) {
        const startDate = row.start_time.slice(0, 10);
        const endDate = row.end_time.slice(0, 10);
        const holidaySet = await this.holidayService.getHolidayDatesInRange(startDate, endDate);
        const workingDates = this.datesInRange(startDate, endDate).filter((d) => !holidaySet.has(d));
        if (workingDates.length > 0) {
          const minutesPerDay = rt === 'leave_full' ? 480 : rt === 'leave_half' ? 240 : Math.round((row.total_minutes_requested ?? 0) / workingDates.length);
          const yearToMinutes = new Map<number, number>();
          for (const d of workingDates) {
            const y = parseInt(d.slice(0, 4), 10);
            yearToMinutes.set(y, (yearToMinutes.get(y) ?? 0) + minutesPerDay);
          }
          for (const [year, add] of yearToMinutes) {
            const err = await this.addUsedMinutes(row.employee_id, year, add);
            if (err) return { error: err };
          }
        }
      }
    }
    const uid = this.auth.user()?.id;
    if (uid) {
      await this.loadPendingForManager(uid);
      await this.loadMyRequests();
      await this.loadLeaveBalance(uid, new Date().getFullYear());
    }
    await this.auditLog.log({
      table_name: 'leave_requests',
      record_id: id,
      action: 'approve',
      new_value: { id, manager_note: managerNote ?? null },
    });
    if (row?.employee_id) {
      await this.notificationService.create(
        row.employee_id,
        'leave_approved',
        'Đơn nghỉ đã được duyệt',
        `Đơn nghỉ của bạn đã được phê duyệt.`
      );
    }
    return { error: null };
  }

  private datesInRange(start: string, end: string): string[] {
    const list: string[] = [];
    const d = new Date(start + 'T12:00:00Z');
    const endD = new Date(end + 'T12:00:00Z');
    while (d <= endD) {
      list.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return list;
  }

  private async addUsedMinutes(employeeId: string, year: number, add: number): Promise<string | null> {
    const { data: existing } = await this.supabase.supabase
      .from('leave_balances')
      .select('id, used_minutes')
      .eq('employee_id', employeeId)
      .eq('year', year)
      .maybeSingle();
    if (existing) {
      const { error } = await this.supabase.supabase
        .from('leave_balances')
        .update({ used_minutes: existing.used_minutes + add })
        .eq('id', existing.id);
      return error?.message ?? null;
    }
    const { error } = await this.supabase.supabase.from('leave_balances').insert({
      employee_id: employeeId,
      year,
      total_minutes: 5760,
      used_minutes: add,
    });
    return error?.message ?? null;
  }

  async reject(id: string, managerNote?: string): Promise<{ error: string | null }> {
    const { data: row } = await this.supabase.supabase
      .from('leave_requests')
      .select('employee_id')
      .eq('id', id)
      .single();
    const { error } = await this.supabase.supabase
      .from('leave_requests')
      .update({ status: 'rejected', manager_note: managerNote ?? null, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { error: error.message };
    const uid = this.auth.user()?.id;
    if (uid) {
      await this.loadPendingForManager(uid);
      await this.loadMyRequests();
    }
    await this.auditLog.log({
      table_name: 'leave_requests',
      record_id: id,
      action: 'reject',
      new_value: { id, manager_note: managerNote ?? null },
    });
    if (row?.employee_id) {
      await this.notificationService.create(
        row.employee_id,
        'leave_rejected',
        'Đơn nghỉ không được duyệt',
        managerNote ? `Lý do: ${managerNote}` : undefined
      );
    }
    return { error: null };
  }
}
