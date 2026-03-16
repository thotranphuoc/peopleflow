import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SupabaseService } from './supabase.service';

export interface AppThemeRow {
  id: string;
  color_0: string;
  color_1: string;
  color_2: string;
  color_3: string;
  color_4: string;
  color_5: string;
  color_6: string;
  updated_at: string;
}

const DEFAULT_PRIMARY = '#0d9488';

/** Darken hex color by reducing RGB values. */
function darkenHex(hex: string, percent: number = 8): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const r = Math.max(0, parseInt(m[1], 16) - Math.round(255 * (percent / 100)));
  const g = Math.max(0, parseInt(m[2], 16) - Math.round(255 * (percent / 100)));
  const b = Math.max(0, parseInt(m[3], 16) - Math.round(255 * (percent / 100)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly supabase = inject(SupabaseService);
  private readonly platformId = inject(PLATFORM_ID);

  /** dayOfWeek: 0=Sunday, 1=Monday, ..., 6=Saturday */
  applyForDay(dayOfWeek: number, primaryHex: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const primary = primaryHex || DEFAULT_PRIMARY;
    const primaryDark = darkenHex(primary, 8);
    const root = document.documentElement;
    root.style.setProperty('--ml-primary', primary);
    root.style.setProperty('--ml-primary-dark', primaryDark);
    root.style.setProperty('--mat-sys-primary', primary);
    root.style.setProperty('--mat-sys-surface-tint', primary);
    root.style.setProperty('--mat-sys-on-primary', '#ffffff');
  }

  /** Apply theme for current day of week. */
  async loadAndApply(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const row = await this.getTheme();
    const day = new Date().getDay();
    const colors = [row?.color_0, row?.color_1, row?.color_2, row?.color_3, row?.color_4, row?.color_5, row?.color_6];
    const primary = colors[day] || DEFAULT_PRIMARY;
    this.applyForDay(day, primary);
  }

  async getTheme(): Promise<AppThemeRow | null> {
    const { data, error } = await this.supabase.supabase
      .from('app_theme')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as AppThemeRow;
  }

  async updateTheme(colors: { color_0: string; color_1: string; color_2: string; color_3: string; color_4: string; color_5: string; color_6: string }): Promise<string | null> {
    const { data: row } = await this.supabase.supabase.from('app_theme').select('id').limit(1).single();
    if (!row?.id) return 'Không tìm thấy cấu hình theme';
    const { error } = await this.supabase.supabase
      .from('app_theme')
      .update({
        ...colors,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (error) return error.message;
    await this.loadAndApply();
    return null;
  }
}
