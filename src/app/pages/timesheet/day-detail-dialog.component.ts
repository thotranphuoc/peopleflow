import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface DayDetailDialogData {
  date: string;
  leaveLabel?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  durationLabel?: string | null;
  holidayName?: string | null;
}

@Component({
  selector: 'app-day-detail-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Chi tiết ngày {{ formatDate(data.date) }}</h2>
    <mat-dialog-content>
      @if (data.leaveLabel) {
        <p class="detail-row"><strong>Loại nghỉ:</strong> {{ data.leaveLabel }}</p>
      }
      @if (data.holidayName) {
        <p class="detail-row"><strong>Ngày lễ:</strong> {{ data.holidayName }}</p>
      }
      @if (data.checkInTime || data.checkOutTime) {
        <p class="detail-row">
          <strong>Chấm công:</strong>
          {{ data.checkInTime ? formatTime(data.checkInTime) : '—' }}
          →
          {{ data.checkOutTime ? formatTime(data.checkOutTime) : '—' }}
        </p>
        @if (data.durationLabel) {
          <p class="detail-row"><strong>Tổng giờ làm:</strong> {{ data.durationLabel }}</p>
        }
      }
      @if (!data.leaveLabel && !data.holidayName && !data.checkInTime && !data.checkOutTime) {
        <p class="detail-row muted">Chưa có thông tin chấm công.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Đóng</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .detail-row { margin: 0 0 0.5rem; font-size: 0.9375rem; }
      .detail-row:last-child { margin-bottom: 0; }
      .detail-row.muted { color: var(--ml-text-muted); }
      mat-dialog-content { min-width: 280px; }
    `,
  ],
})
export class DayDetailDialogComponent {
  readonly data: DayDetailDialogData = inject(MAT_DIALOG_DATA);

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  formatTime(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}
