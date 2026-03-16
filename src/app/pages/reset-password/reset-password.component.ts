import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
})
export class ResetPasswordComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly password = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal(false);
  protected readonly ready = signal(false);

  ngOnInit(): void {
    // Supabase xử lý hash từ link email; session sẽ có sau một tick
    setTimeout(() => this.ready.set(true), 100);
  }

  protected get canSubmit(): boolean {
    const p = this.password();
    const c = this.confirmPassword();
    return p.length >= 6 && p === c;
  }

  protected async onSubmit(): Promise<void> {
    if (!this.canSubmit) return;
    this.error.set(null);
    this.loading.set(true);
    const { error } = await this.auth.updatePassword(this.password());
    this.loading.set(false);
    if (error) {
      this.error.set(error.message ?? 'Đặt mật khẩu thất bại');
      return;
    }
    this.success.set(true);
    setTimeout(() => void this.router.navigate(['/login']), 2000);
  }
}
