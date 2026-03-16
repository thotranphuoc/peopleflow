import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import type { AbsenceReport } from '../models';

export type AbsenceReportWithMembers = AbsenceReport & { member_employee_ids: string[] };

@Injectable({ providedIn: 'root' })
export class AbsenceReportService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  private readonly _myList = signal<AbsenceReportWithMembers[]>([]);
  readonly myList = this._myList.asReadonly();
  private readonly _managerList = signal<AbsenceReportWithMembers[]>([]);
  readonly managerList = this._managerList.asReadonly();
  private readonly _allList = signal<AbsenceReportWithMembers[]>([]);
  readonly allList = this._allList.asReadonly();
  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();
  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  private async attachMembers(reports: AbsenceReport[]): Promise<AbsenceReportWithMembers[]> {
    if (reports.length === 0) return [];
    const ids = reports.map((r) => r.id);
    const { data: members } = await this.supabase.supabase
      .from('absence_report_members')
      .select('absence_report_id, employee_id')
      .in('absence_report_id', ids);
    const map = new Map<string, string[]>();
    for (const r of reports) map.set(r.id, []);
    for (const m of members ?? []) {
      const arr = map.get(m.absence_report_id);
      if (arr) arr.push(m.employee_id);
    }
    return reports.map((r) => ({ ...r, member_employee_ids: map.get(r.id) ?? [] }));
  }

  async loadMyReports(): Promise<void> {
    const uid = this.auth.user()?.id;
    if (!uid) return;
    this._loading.set(true);
    this._error.set(null);
    const { data, error } = await this.supabase.supabase
      .from('absence_reports')
      .select('*')
      .eq('reporter_id', uid)
      .order('start_time', { ascending: false });
    this._loading.set(false);
    if (error) {
      this._error.set(error.message);
      this._myList.set([]);
      return;
    }
    const withMembers = await this.attachMembers((data ?? []) as AbsenceReport[]);
    this._myList.set(withMembers);
  }

  async loadForManager(managerId: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    const { data, error } = await this.supabase.supabase
      .from('absence_reports')
      .select('*')
      .eq('manager_id', managerId)
      .order('start_time', { ascending: false });
    this._loading.set(false);
    if (error) {
      this._error.set(error.message);
      this._managerList.set([]);
      return;
    }
    const withMembers = await this.attachMembers((data ?? []) as AbsenceReport[]);
    this._managerList.set(withMembers);
  }

  async loadAll(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    const { data, error } = await this.supabase.supabase
      .from('absence_reports')
      .select('*')
      .order('start_time', { ascending: false });
    this._loading.set(false);
    if (error) {
      this._error.set(error.message);
      this._allList.set([]);
      return;
    }
    const withMembers = await this.attachMembers((data ?? []) as AbsenceReport[]);
    this._allList.set(withMembers);
  }

  async create(payload: {
    reason: string;
    location?: string | null;
    start_time: string;
    end_time: string;
    member_employee_ids?: string[];
    contact_phone?: string | null;
    note?: string | null;
    manager_id?: string | null;
  }): Promise<{ error: string | null }> {
    const uid = this.auth.user()?.id;
    if (!uid) return { error: 'Chưa đăng nhập' };
    const { data: inserted, error: errReport } = await this.supabase.supabase
      .from('absence_reports')
      .insert({
        reporter_id: uid,
        manager_id: payload.manager_id ?? null,
        reason: payload.reason.trim(),
        location: payload.location?.trim() || null,
        start_time: payload.start_time,
        end_time: payload.end_time,
        contact_phone: payload.contact_phone?.trim() || null,
        note: payload.note?.trim() || null,
      })
      .select('id')
      .single();
    if (errReport || !inserted) return { error: errReport?.message ?? 'Lỗi tạo báo vắng' };
    const memberIds = payload.member_employee_ids?.filter((id) => id) ?? [];
    if (memberIds.length > 0) {
      const { error: errMembers } = await this.supabase.supabase.from('absence_report_members').insert(
        memberIds.map((employee_id) => ({ absence_report_id: inserted.id, employee_id }))
      );
      if (errMembers) {
        // Report already created; log but don't fail
        console.warn('AbsenceReportService: failed to insert members', errMembers);
      }
    }
    await this.loadMyReports();
    return { error: null };
  }
}
