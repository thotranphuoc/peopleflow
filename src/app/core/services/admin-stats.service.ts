import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface AdminStats {
  employeeCount: number;
  departmentCount: number;
  pendingLeaveCount: number;
  payrollDraftCountThisMonth: number;
  payrollPublishedCountThisMonth: number;
}

@Injectable({ providedIn: 'root' })
export class AdminStatsService {
  private readonly supabase = inject(SupabaseService);

  async getStats(): Promise<AdminStats> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [empRes, deptRes, leaveRes, payrollDraftRes, payrollPublishedRes] = await Promise.all([
      this.supabase.supabase.from('employees').select('id', { count: 'exact', head: true }),
      this.supabase.supabase.from('departments').select('id', { count: 'exact', head: true }),
      this.supabase.supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      this.supabase.supabase
        .from('payrolls')
        .select('id', { count: 'exact', head: true })
        .eq('month', month)
        .eq('year', year)
        .eq('status', 'draft'),
      this.supabase.supabase
        .from('payrolls')
        .select('id', { count: 'exact', head: true })
        .eq('month', month)
        .eq('year', year)
        .eq('status', 'published'),
    ]);

    return {
      employeeCount: empRes.count ?? 0,
      departmentCount: deptRes.count ?? 0,
      pendingLeaveCount: leaveRes.count ?? 0,
      payrollDraftCountThisMonth: payrollDraftRes.count ?? 0,
      payrollPublishedCountThisMonth: payrollPublishedRes.count ?? 0,
    };
  }
}
