import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import type { Holiday } from '../models';

/** Map date string (YYYY-MM-DD) -> holiday name(s). Multiple holidays same day joined. */
export type HolidayMap = Map<string, string>;

@Injectable({ providedIn: 'root' })
export class HolidayService {
  private readonly supabase = inject(SupabaseService);

  private readonly _byMonth = signal<HolidayMap>(new Map());
  readonly holidayMapForMonth = this._byMonth.asReadonly();

  private readonly _list = signal<Holiday[]>([]);
  readonly list = this._list.asReadonly();
  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  /**
   * Returns the set of date strings (YYYY-MM-DD) that are holidays within [start, end].
   * Used when approving leave to exclude those days from deducting annual leave.
   */
  async getHolidayDatesInRange(start: string, end: string): Promise<Set<string>> {
    const startDate = start.slice(0, 10);
    const endDate = end.slice(0, 10);
    const out = new Set<string>();

    const { data: nonRecurring } = await this.supabase.supabase
      .from('holidays')
      .select('date')
      .eq('is_recurring', false)
      .gte('date', startDate)
      .lte('date', endDate);
    for (const row of nonRecurring ?? []) {
      out.add((row.date as string).slice(0, 10));
    }

    const { data: recurring } = await this.supabase.supabase
      .from('holidays')
      .select('date')
      .eq('is_recurring', true);
    const startYear = parseInt(startDate.slice(0, 4), 10);
    const endYear = parseInt(endDate.slice(0, 4), 10);
    for (const row of recurring ?? []) {
      const stored = (row.date as string).slice(0, 10);
      const [, mm, dd] = stored.split('-');
      for (let y = startYear; y <= endYear; y++) {
        const d = `${y}-${mm}-${dd}`;
        if (d >= startDate && d <= endDate) out.add(d);
      }
    }
    return out;
  }

  /**
   * Load holidays for a given month and year for calendar display.
   * Recurring: stored with year 2000, we project (month, day) to the requested year.
   * Non-recurring: date in that month.
   */
  async loadForMonth(year: number, month: number): Promise<void> {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const { data: nonRecurring } = await this.supabase.supabase
      .from('holidays')
      .select('date, name')
      .eq('is_recurring', false)
      .gte('date', start)
      .lte('date', end);

    const { data: recurring } = await this.supabase.supabase
      .from('holidays')
      .select('date, name')
      .eq('is_recurring', true);

    const map = new Map<string, string>();
    for (const row of nonRecurring ?? []) {
      const d = (row.date as string).slice(0, 10);
      map.set(d, row.name as string);
    }
    for (const row of recurring ?? []) {
      const stored = (row.date as string).slice(0, 10);
      const [, mm, dd] = stored.split('-');
      const d = `${year}-${mm}-${dd}`;
      if (Number(mm) === month) {
        const existing = map.get(d);
        map.set(d, existing ? `${existing}; ${row.name}` : (row.name as string));
      }
    }
    this._byMonth.set(map);
  }

  /** Load holidays for admin list. When year is set: non-recurring in that year + all recurring. */
  async loadForYear(year?: number): Promise<void> {
    this._loading.set(true);
    if (year == null) {
      const { data, error } = await this.supabase.supabase.from('holidays').select('*');
      this._loading.set(false);
      if (error) {
        this._list.set([]);
        return;
      }
      const arr = (data ?? []) as Holiday[];
      arr.sort((a, b) => {
        const ma = a.date.slice(5, 10);
        const mb = b.date.slice(5, 10);
        return ma.localeCompare(mb) || a.date.localeCompare(b.date);
      });
      this._list.set(arr);
      return;
    }
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const { data: nonRecurring } = await this.supabase.supabase
      .from('holidays')
      .select('*')
      .eq('is_recurring', false)
      .gte('date', start)
      .lte('date', end)
      .order('date');
    const { data: recurring } = await this.supabase.supabase
      .from('holidays')
      .select('*')
      .eq('is_recurring', true)
      .order('date');
    this._loading.set(false);
    const combined = [...(recurring ?? []), ...(nonRecurring ?? [])] as Holiday[];
    const sortKey = (h: Holiday) =>
      h.is_recurring ? `${year}-${h.date.slice(5, 10)}` : h.date;
    combined.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    this._list.set(combined);
  }

  /** Load all holidays (no year filter) for admin. */
  async loadAll(): Promise<void> {
    this._loading.set(true);
    const { data, error } = await this.supabase.supabase
      .from('holidays')
      .select('*')
      .order('date');
    this._loading.set(false);
    if (error) {
      this._list.set([]);
      return;
    }
    this._list.set((data ?? []) as Holiday[]);
  }

  async create(payload: { date: string; name: string; is_recurring: boolean }): Promise<{ error: string | null }> {
    let date = payload.date.slice(0, 10);
    if (payload.is_recurring) {
      date = `2000-${date.slice(5, 7)}-${date.slice(8, 10)}`;
    }
    const { error } = await this.supabase.supabase.from('holidays').insert({
      date: date,
      name: payload.name.trim(),
      is_recurring: payload.is_recurring,
    });
    if (error) return { error: error.message };
    return { error: null };
  }

  async update(id: string, payload: { date?: string; name?: string; is_recurring?: boolean }): Promise<{ error: string | null }> {
    const patch: { date?: string; name?: string; is_recurring?: boolean } = {};
    if (payload.name !== undefined) patch.name = payload.name.trim();
    if (payload.is_recurring !== undefined) patch.is_recurring = payload.is_recurring;
    if (payload.date !== undefined) {
      const d = payload.date.slice(0, 10);
      patch.date = payload.is_recurring ? `2000-${d.slice(5, 7)}-${d.slice(8, 10)}` : d;
    }
    const { error } = await this.supabase.supabase.from('holidays').update(patch).eq('id', id);
    if (error) return { error: error.message };
    return { error: null };
  }

  async delete(id: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase.supabase.from('holidays').delete().eq('id', id);
    if (error) return { error: error.message };
    return { error: null };
  }

  /** Display date for a holiday (for recurring, show as MM-DD "mỗi năm"). */
  displayDate(h: Holiday): string {
    const d = h.date.slice(0, 10);
    if (h.is_recurring) return `${d.slice(8, 10)}/${d.slice(5, 7)} (lặp hàng năm)`;
    return d;
  }
}
