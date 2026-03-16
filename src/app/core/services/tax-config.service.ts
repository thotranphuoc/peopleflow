import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import type { TaxBracket, TaxDeduction } from '../models';

@Injectable({ providedIn: 'root' })
export class TaxConfigService {
  private readonly supabase = inject(SupabaseService);

  async getBrackets(): Promise<TaxBracket[]> {
    const { data, error } = await this.supabase.supabase
      .from('tax_brackets')
      .select('*')
      .order('sort_order');
    if (error) return [];
    return (data ?? []) as TaxBracket[];
  }

  async getDeductions(): Promise<TaxDeduction[]> {
    const { data, error } = await this.supabase.supabase
      .from('tax_deductions')
      .select('*')
      .order('code');
    if (error) return [];
    return (data ?? []) as TaxDeduction[];
  }

  /** Thu nhập chịu thuế = gross - insurance - giảm trừ bản thân - (số người phụ thuộc × giảm trừ/người). */
  calculateTaxSync(
    brackets: TaxBracket[],
    deductions: TaxDeduction[],
    grossSalary: number,
    insuranceAmount: number,
    dependentsCount: number
  ): number {
    const selfDed = deductions.find((d) => d.code === 'self')?.amount_monthly ?? 11_000_000;
    const depDed = deductions.find((d) => d.code === 'dependent')?.amount_monthly ?? 4_400_000;
    const taxable = grossSalary - insuranceAmount - selfDed - dependentsCount * depDed;
    if (taxable <= 0) return 0;
    let tax = 0;
    const sorted = [...brackets].sort((a, b) => a.sort_order - b.sort_order);
    for (const b of sorted) {
      const from = Number(b.amount_from);
      const to = b.amount_to == null ? 1e12 : Number(b.amount_to);
      const rate = Number(b.rate_percent) / 100;
      if (taxable <= from) break;
      const sliceEnd = Math.min(taxable, to);
      const sliceStart = Math.max(from, 0);
      const band = Math.max(0, sliceEnd - sliceStart);
      tax += Math.round(band * rate);
    }
    return tax;
  }

  /** Phân bổ thu nhập chịu thuế vào từng bậc, trả về chi tiết từng bậc và tổng thuế (để hiển thị trực quan). */
  getBracketBreakdown(
    brackets: TaxBracket[],
    taxableIncome: number
  ): { bracket: TaxBracket; incomeInBracket: number; taxInBracket: number }[] {
    const result: { bracket: TaxBracket; incomeInBracket: number; taxInBracket: number }[] = [];
    if (taxableIncome <= 0) return result;
    const sorted = [...brackets].sort((a, b) => a.sort_order - b.sort_order);
    for (const b of sorted) {
      const from = Number(b.amount_from);
      const to = b.amount_to == null ? 1e12 : Number(b.amount_to);
      const rate = Number(b.rate_percent) / 100;
      const sliceEnd = Math.min(taxableIncome, to);
      const sliceStart = Math.max(from, 0);
      const incomeInBracket = Math.max(0, sliceEnd - sliceStart);
      const taxInBracket = Math.round(incomeInBracket * rate);
      result.push({ bracket: b, incomeInBracket, taxInBracket });
      if (taxableIncome <= to) break;
    }
    return result;
  }

  async createBracket(payload: { sort_order: number; amount_from: number; amount_to: number | null; rate_percent: number }): Promise<string | null> {
    const { error } = await this.supabase.supabase.from('tax_brackets').insert({
      sort_order: payload.sort_order,
      amount_from: payload.amount_from,
      amount_to: payload.amount_to,
      rate_percent: payload.rate_percent,
    });
    return error?.message ?? null;
  }

  async updateBracket(id: string, payload: { sort_order?: number; amount_from?: number; amount_to?: number | null; rate_percent?: number }): Promise<string | null> {
    const patch: Record<string, unknown> = {};
    if (payload['sort_order'] !== undefined) patch['sort_order'] = payload['sort_order'];
    if (payload['amount_from'] !== undefined) patch['amount_from'] = payload['amount_from'];
    if (payload['amount_to'] !== undefined) patch['amount_to'] = payload['amount_to'];
    if (payload['rate_percent'] !== undefined) patch['rate_percent'] = payload['rate_percent'];
    const { error } = await this.supabase.supabase.from('tax_brackets').update(patch).eq('id', id);
    return error?.message ?? null;
  }

  async deleteBracket(id: string): Promise<string | null> {
    const { error } = await this.supabase.supabase.from('tax_brackets').delete().eq('id', id);
    return error?.message ?? null;
  }

  async updateDeduction(id: string, payload: { name?: string; amount_monthly?: number }): Promise<string | null> {
    const patch: Record<string, unknown> = {};
    if (payload['name'] !== undefined) patch['name'] = payload['name'];
    if (payload['amount_monthly'] !== undefined) patch['amount_monthly'] = payload['amount_monthly'];
    const { error } = await this.supabase.supabase.from('tax_deductions').update(patch).eq('id', id);
    return error?.message ?? null;
  }
}
