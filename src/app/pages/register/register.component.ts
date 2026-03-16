import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected get passwordsMatch(): boolean {
    return this.password() === this.confirmPassword() && this.password().length >= 6;
  }

  protected async onSubmit(): Promise<void> {
    this.error.set(null);
    if (this.password() !== this.confirmPassword()) {
      this.error.set('Mật khẩu xác nhận không trùng.');
      return;
    }
    if (this.password().length < 6) {
      this.error.set('Mật khẩu ít nhất 6 ký tự.');
      return;
    }
    this.loading.set(true);
    const { error } = await this.auth.signUp(this.email(), this.password());
    this.loading.set(false);
    if (error) {
      this.error.set(error.message ?? 'Đăng ký thất bại');
      return;
    }
    void this.router.navigate(['/pending']);
  }
}
