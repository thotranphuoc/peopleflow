import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import type { SalaryGrade } from '../models';

@Injectable({ providedIn: 'root' })
export class SalaryGradeService {
  private readonly supabase = inject(SupabaseService);

  async getAll(): Promise<SalaryGrade[]> {
    const { data, error } = await this.supabase.supabase
      .from('salary_grades')
      .select('*')
      .order('name');
    if (error) return [];
    return (data ?? []) as SalaryGrade[];
  }

  async getById(id: string): Promise<SalaryGrade | null> {
    const { data, error } = await this.supabase.supabase
      .from('salary_grades')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data as SalaryGrade;
  }

  async create(payload: { name: string; p1_salary: number; p2_salary: number; p3_salary?: number }): Promise<string | null> {
    const { error } = await this.supabase.supabase.from('salary_grades').insert({
      name: payload.name,
      p1_salary: payload.p1_salary,
      p2_salary: payload.p2_salary ?? 0,
      p3_salary: payload.p3_salary ?? 0,
    });
    return error?.message ?? null;
  }

  async update(
    id: string,
    payload: { name?: string; p1_salary?: number; p2_salary?: number; p3_salary?: number }
  ): Promise<string | null> {
    const patch: Record<string, unknown> = {};
    if (payload['name'] !== undefined) patch['name'] = payload['name'];
    if (payload['p1_salary'] !== undefined) patch['p1_salary'] = payload['p1_salary'];
    if (payload['p2_salary'] !== undefined) patch['p2_salary'] = payload['p2_salary'];
    if (payload['p3_salary'] !== undefined) patch['p3_salary'] = payload['p3_salary'];
    const { error } = await this.supabase.supabase.from('salary_grades').update(patch).eq('id', id);
    return error?.message ?? null;
  }

  async delete(id: string): Promise<string | null> {
    const { error } = await this.supabase.supabase.from('salary_grades').delete().eq('id', id);
    return error?.message ?? null;
  }
}
