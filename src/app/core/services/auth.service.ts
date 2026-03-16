import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import { AuthError, Session } from '@supabase/supabase-js';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _session = signal<Session | null>(null);

  readonly session = this._session.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed(() => !!this._session());

  constructor(
    private readonly supabase: SupabaseService,
    private readonly router: Router
  ) {
    void this.supabase.supabase.auth.getSession().then(({ data: { session } }) => {
      this._session.set(session);
    });
    this.supabase.supabase.auth.onAuthStateChange((_event, session) => {
      this._session.set(session);
    });
  }

  async signIn(email: string, password: string): Promise<{ error: AuthError | null }> {
    const { error } = await this.supabase.supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error ?? null };
  }

  async signUp(email: string, password: string): Promise<{ error: AuthError | null }> {
    const { error } = await this.supabase.supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: undefined },
    });
    return { error: error ?? null };
  }

  async signOut(): Promise<void> {
    await this.supabase.supabase.auth.signOut();
    this._session.set(null);
    void this.router.navigate(['/login']);
  }

  /** Gửi email đặt lại mật khẩu. redirectTo: URL app (vd: origin + /reset-password). */
  async resetPasswordForEmail(
    email: string,
    redirectTo?: string
  ): Promise<{ error: AuthError | null }> {
    const { error } = await this.supabase.supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: redirectTo ?? `${typeof window !== 'undefined' ? window.location.origin : ''}/reset-password` }
    );
    return { error: error ?? null };
  }

  /** Đặt lại mật khẩu (sau khi user vào từ link trong email). */
  async updatePassword(newPassword: string): Promise<{ error: AuthError | null }> {
    const { error } = await this.supabase.supabase.auth.updateUser({ password: newPassword });
    return { error: error ?? null };
  }
}
