import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { AttendanceDayRow } from '../../../core/services/report.service';

export interface AttendanceApprovalDialogData {
  row: AttendanceDayRow;
}

export interface AttendanceApprovalDialogResult {
  action: 'approve' | 'reject';
  note: string | null;
}

@Component({
  selector: 'app-attendance-approval-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Xử lý chấm công bổ sung</h2>
    <mat-dialog-content>
      <p class="dialog-info">
        <strong>{{ data.row.employee_code }}</strong> — {{ data.row.full_name }}<br />
        Ngày {{ data.row.work_date }}
      </p>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Lý do / Ghi chú</mat-label>
        <textarea matInput [ngModel]="note()" (ngModelChange)="note.set($event)" rows="3" placeholder="Tùy chọn khi duyệt hoặc từ chối"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Hủy</button>
      <button mat-button color="warn" [disabled]="submitting()" (click)="submit('reject')">
        {{ submitting() ? '...' : 'Từ chối' }}
      </button>
      <button mat-flat-button color="primary" [disabled]="submitting()" (click)="submit('approve')">
        {{ submitting() ? '...' : 'Duyệt' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-info { font-size: 0.9rem; margin-bottom: 1rem; color: var(--ml-text, #333); }
      .full-width { width: 100%; }
      mat-dialog-content { min-width: 320px; }
    `,
  ],
})
export class AttendanceApprovalDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<AttendanceApprovalDialogComponent, AttendanceApprovalDialogResult | undefined>);
  readonly data: AttendanceApprovalDialogData = inject(MAT_DIALOG_DATA);

  readonly note = signal('');
  readonly submitting = signal(false);

  submit(action: 'approve' | 'reject'): void {
    this.submitting.set(true);
    const noteVal = this.note().trim() || null;
    this.dialogRef.close({ action, note: noteVal });
  }
}
