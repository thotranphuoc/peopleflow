import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import type { Company } from '../models';

@Injectable({ providedIn: 'root' })
export class CompaniesService {
  private readonly supabase = inject(SupabaseService);

  async list(): Promise<Company[]> {
    const { data, error } = await this.supabase.supabase
      .from('companies')
      .select('*')
      .order('company_name');
    if (error) return [];
    return (data ?? []) as Company[];
  }

  async get(id: string): Promise<Company | null> {
    const { data, error } = await this.supabase.supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data as Company;
  }

  async create(payload: {
    company_name: string;
    short_name?: string | null;
    logo_url?: string | null;
    address?: string | null;
    tax_code?: string | null;
    phone?: string | null;
    email?: string | null;
    check_in_lat?: number | null;
    check_in_lng?: number | null;
    check_in_radius_meters?: number | null;
  }): Promise<string | null> {
    const row: Record<string, unknown> = {
      company_name: payload.company_name.trim() || 'Công ty',
      short_name: payload.short_name?.trim() || null,
      logo_url: payload.logo_url ?? null,
      address: payload.address ?? null,
      tax_code: payload.tax_code ?? null,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
    };
    if (payload.check_in_lat !== undefined) row['check_in_lat'] = payload.check_in_lat;
    if (payload.check_in_lng !== undefined) row['check_in_lng'] = payload.check_in_lng;
    if (payload.check_in_radius_meters !== undefined) row['check_in_radius_meters'] = payload.check_in_radius_meters;
    const { error } = await this.supabase.supabase.from('companies').insert(row as Record<string, unknown>);
    return error?.message ?? null;
  }

  async update(
    id: string,
    payload: {
      company_name?: string;
      short_name?: string | null;
      logo_url?: string | null;
      address?: string | null;
      tax_code?: string | null;
      phone?: string | null;
      email?: string | null;
      check_in_lat?: number | null;
      check_in_lng?: number | null;
      check_in_radius_meters?: number | null;
    }
  ): Promise<string | null> {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (payload.company_name !== undefined) patch['company_name'] = payload.company_name;
    if (payload.short_name !== undefined) patch['short_name'] = payload.short_name?.trim() || null;
    if (payload.logo_url !== undefined) patch['logo_url'] = payload.logo_url;
    if (payload.address !== undefined) patch['address'] = payload.address;
    if (payload.tax_code !== undefined) patch['tax_code'] = payload.tax_code;
    if (payload.phone !== undefined) patch['phone'] = payload.phone;
    if (payload.email !== undefined) patch['email'] = payload.email;
    if (payload.check_in_lat !== undefined) patch['check_in_lat'] = payload.check_in_lat;
    if (payload.check_in_lng !== undefined) patch['check_in_lng'] = payload.check_in_lng;
    if (payload.check_in_radius_meters !== undefined) patch['check_in_radius_meters'] = payload.check_in_radius_meters;
    const { error } = await this.supabase.supabase.from('companies').update(patch).eq('id', id);
    return error?.message ?? null;
  }

  async delete(id: string): Promise<string | null> {
    const { error } = await this.supabase.supabase.from('companies').delete().eq('id', id);
    return error?.message ?? null;
  }
}
