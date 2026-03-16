import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AttendanceService } from '../../core/services/attendance.service';

export interface SupplementFormDialogData {
  date: string;
  checkIn?: string;
  checkOut?: string;
}

@Component({
  selector: 'app-supplement-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Bổ sung chấm công</h2>
    <mat-dialog-content>
      <p class="dialog-hint">Điền giờ vào/ra cho ngày quên chấm. Không cần ảnh hay GPS. Sau khi gửi, Quản lý sẽ xem xét và duyệt.</p>
      <p class="dialog-hint dialog-note">Mọi thay đổi đều được ghi nhận. Vui lòng sử dụng đúng mục đích, không lạm dụng.</p>
      <p class="dialog-date"><strong>Ngày:</strong> {{ data.date }}</p>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Giờ vào</mat-label>
        <input matInput type="time" [ngModel]="checkIn()" (ngModelChange)="checkIn.set($event)" />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Giờ ra</mat-label>
        <input matInput type="time" [ngModel]="checkOut()" (ngModelChange)="checkOut.set($event)" />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Lý do (để Manager xem xét)</mat-label>
        <textarea matInput [ngModel]="reason()" (ngModelChange)="reason.set($event)" rows="2" placeholder="VD: Quên check-out do họp kéo dài"></textarea>
      </mat-form-field>
      @if (error()) {
        <p class="error-msg">{{ error() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Hủy</button>
      <button mat-flat-button color="primary" [disabled]="submitting()" (click)="submit()">
        {{ submitting() ? 'Đang gửi...' : 'Gửi bổ sung' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-hint { font-size: 0.875rem; color: var(--ml-text-muted); margin-bottom: 0.5rem; }
      .dialog-note { margin-bottom: 1rem; }
      .dialog-date { margin-bottom: 1rem; }
      .full-width { width: 100%; }
      .error-msg { color: var(--ml-error); font-size: 0.875rem; margin-top: 0.5rem; }
      mat-dialog-content { min-width: 280px; }
    `,
  ],
})
export class SupplementFormDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<SupplementFormDialogComponent>);
  readonly data: SupplementFormDialogData = inject(MAT_DIALOG_DATA);
  private readonly attendanceService = inject(AttendanceService);

  readonly checkIn = signal(this.data.checkIn ?? '08:00');
  readonly checkOut = signal(this.data.checkOut ?? '17:30');
  readonly reason = signal('');
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    const date = this.data.date;
    const checkIn = this.checkIn();
    const checkOut = this.checkOut();
    if (!checkIn || !checkOut) {
      this.error.set('Vui lòng nhập đủ giờ vào và giờ ra.');
      return;
    }
    const [inH, inM] = checkIn.split(':').map(Number);
    const [outH, outM] = checkOut.split(':').map(Number);
    const inMin = (inH ?? 0) * 60 + (inM ?? 0);
    const outMin = (outH ?? 0) * 60 + (outM ?? 0);
    if (outMin <= inMin) {
      this.error.set('Giờ ra phải sau giờ vào.');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    const reasonVal = this.reason().trim() || null;
    const { error } = await this.attendanceService.submitManualAttendance(date, checkIn, checkOut, reasonVal);
    this.submitting.set(false);
    if (error) {
      this.error.set(error);
      return;
    }
    this.dialogRef.close(true);
  }
}
