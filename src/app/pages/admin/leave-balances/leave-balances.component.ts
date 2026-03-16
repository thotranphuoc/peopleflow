import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { LeaveBalanceService } from '../../../core/services/leave-balance.service';
import type { LeaveBalanceRow } from '../../../core/services/leave-balance.service';

const MINUTES_PER_DAY = 480;

@Component({
  selector: 'app-leave-balances',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule],
  templateUrl: './leave-balances.html',
  styleUrl: './leave-balances.scss',
})
export class LeaveBalancesComponent implements OnInit {
  protected readonly balanceService = inject(LeaveBalanceService);

  protected readonly selectedYear = signal<number>(new Date().getFullYear());
  /** Local edits: employee_id -> "số ngày" (string) đang nhập cho Tổng. */
  protected readonly edits = signal<Record<string, string>>({});
  /** Local edits: employee_id -> "số ngày" (string) đang nhập cho Bổ sung. */
  protected readonly extraEdits = signal<Record<string, string>>({});
  protected readonly saving = signal(false);
  protected readonly grantBusy = signal(false);
  protected readonly message = signal<string | null>(null);

  protected readonly years = (() => {
    const y = new Date().getFullYear();
    return [y + 1, y, y - 1];
  })();

  protected readonly hasDirty = computed(
    () => Object.keys(this.edits()).length > 0 || Object.keys(this.extraEdits()).length > 0
  );

  ngOnInit(): void {
    this.loadYear(this.selectedYear());
  }

  protected loadYear(year: number): void {
    this.selectedYear.set(year);
    this.edits.set({});
    this.extraEdits.set({});
    this.message.set(null);
    this.balanceService.loadForYear(year);
  }

  protected async grantForYear(): Promise<void> {
    const year = this.selectedYear();
    this.grantBusy.set(true);
    this.message.set(null);
    const { error, granted } = await this.balanceService.grantForYear(year);
    this.grantBusy.set(false);
    if (error) {
      this.message.set('Lỗi: ' + error);
      return;
    }
    this.message.set(granted > 0 ? `Đã cấp quỹ phép cho ${granted} nhân viên.` : 'Tất cả nhân viên đã có quỹ phép năm này.');
  }

  protected setEdit(employeeId: string, value: string): void {
    this.edits.update((prev) => ({ ...prev, [employeeId]: value }));
  }

  protected setExtraEdit(employeeId: string, value: string): void {
    this.extraEdits.update((prev) => ({ ...prev, [employeeId]: value }));
  }

  /** Giá trị hiển thị trong ô input Tổng: đang sửa hoặc từ dữ liệu gốc. */
  protected inputValue(row: LeaveBalanceRow): string {
    const e = this.edits()[row.employee_id];
    if (e !== undefined) return e;
    if (row.total_minutes > 0) return (row.total_minutes / MINUTES_PER_DAY).toFixed(1);
    return '';
  }

  /** Giá trị hiển thị trong ô input Bổ sung. */
  protected extraInputValue(row: LeaveBalanceRow): string {
    const e = this.extraEdits()[row.employee_id];
    if (e !== undefined) return e;
    if (row.extra_minutes > 0) return (row.extra_minutes / MINUTES_PER_DAY).toFixed(1);
    return '';
  }

  /** Số ngày còn lại (dùng giá trị đang nhập nếu có). */
  protected remainingDays(row: LeaveBalanceRow): string {
    const totalMinutes = this.effectiveTotalMinutes(row);
    const rem = Math.max(0, totalMinutes - row.used_minutes);
    return (rem / MINUTES_PER_DAY).toFixed(1);
  }

  /** Tổng cộng (ngày) = Tổng + Bổ sung. */
  protected totalDays(row: LeaveBalanceRow): string {
    return (this.effectiveTotalMinutes(row) / MINUTES_PER_DAY).toFixed(1);
  }

  private effectiveTotalMinutes(row: LeaveBalanceRow): number {
    let base = row.total_minutes;
    const str = this.edits()[row.employee_id];
    if (str !== undefined && str !== '') {
      const days = parseFloat(String(str).trim().replace(',', '.'));
      if (!isNaN(days) && days >= 0) base = Math.round(days * MINUTES_PER_DAY);
    }
    let extra = row.extra_minutes;
    const strExtra = this.extraEdits()[row.employee_id];
    if (strExtra !== undefined && strExtra !== '') {
      const days = parseFloat(String(strExtra).trim().replace(',', '.'));
      if (!isNaN(days) && days >= 0) extra = Math.round(days * MINUTES_PER_DAY);
    }
    return base + extra;
  }

  protected async saveAll(): Promise<void> {
    const year = this.selectedYear();
    const rows = this.balanceService.rows();
    const updateMap = new Map<string, { total_minutes?: number; extra_minutes?: number }>();
    for (const [employeeId, str] of Object.entries(this.edits())) {
      const days = parseFloat(String(str).trim().replace(',', '.'));
      if (isNaN(days) || days < 0) continue;
      const totalMinutes = Math.round(days * MINUTES_PER_DAY);
      const row = rows.find((r) => r.employee_id === employeeId);
      if (row && row.total_minutes === totalMinutes) continue;
      const u = updateMap.get(employeeId) ?? {};
      u.total_minutes = totalMinutes;
      updateMap.set(employeeId, u);
    }
    for (const [employeeId, str] of Object.entries(this.extraEdits())) {
      const days = parseFloat(String(str).trim().replace(',', '.'));
      if (isNaN(days) || days < 0) continue;
      const extraMinutes = Math.round(days * MINUTES_PER_DAY);
      const row = rows.find((r) => r.employee_id === employeeId);
      if (row && row.extra_minutes === extraMinutes) continue;
      const u = updateMap.get(employeeId) ?? {};
      u.extra_minutes = extraMinutes;
      updateMap.set(employeeId, u);
    }
    const updates = Array.from(updateMap.entries()).map(([employee_id, patch]) => ({
      employee_id,
      ...patch,
    }));
    if (updates.length === 0) {
      this.edits.set({});
      this.extraEdits.set({});
      this.message.set(null);
      return;
    }
    this.saving.set(true);
    this.message.set(null);
    const error = await this.balanceService.saveBatch(year, updates);
    this.saving.set(false);
    if (error) {
      this.message.set('Lỗi: ' + error);
      return;
    }
    this.edits.set({});
    this.extraEdits.set({});
    this.message.set('Đã lưu ' + updates.length + ' thay đổi.');
  }

  protected days(totalMinutes: number): string {
    return (totalMinutes / MINUTES_PER_DAY).toFixed(1);
  }

  protected hasNoBalance(row: LeaveBalanceRow): boolean {
    return row.balance_id == null;
  }
}
