import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import type { Attendance } from '../../../core/models';

export interface AttendanceEditDialogData {
  row: Attendance;
  employees: { id: string; employee_code: string; full_name: string }[];
}

export type AttendanceEditDialogResult =
  | {
      action: 'save';
      patch: {
        employee_id: string;
        work_date: string;
        check_in_time: string | null;
        check_out_time: string | null;
        is_valid_location: boolean;
        status: 'valid' | 'pending' | 'violation';
        supplement_reason: string | null;
        approval_note: string | null;
      };
    }
  | { action: 'delete' }
  | undefined;

function parseIsoToDateAndTime(iso: string | null): { date: Date; time: string } {
  if (!iso) return { date: new Date(), time: '08:00' };
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return { date: d, time: `${h}:${min}` };
}
function toIso(date: Date, time: string): string {
  const [h, m] = (time || '00:00').split(':').map(Number);
  const d = new Date(date);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toISOString();
}
function toWorkDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Component({
  selector: 'app-attendance-edit-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDatepickerModule,
  ],
  template: `
    <h2 mat-dialog-title>Chấm công</h2>
    <mat-dialog-content class="attendance-edit-content">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Nhân viên</mat-label>
        <mat-select [ngModel]="employeeId()" (ngModelChange)="employeeId.set($event)">
          @for (e of data.employees; track e.id) {
            <mat-option [value]="e.id">{{ e.employee_code }} — {{ e.full_name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Ngày làm</mat-label>
        <input matInput [matDatepicker]="pickerWork" [ngModel]="workDate()" (ngModelChange)="workDate.set($event)" />
        <mat-datepicker-toggle matIconSuffix [for]="pickerWork"></mat-datepicker-toggle>
        <mat-datepicker #pickerWork></mat-datepicker>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Ngày giờ vào</mat-label>
        <input matInput [matDatepicker]="pickerIn" [ngModel]="checkInDate()" (ngModelChange)="checkInDate.set($event)" />
        <mat-datepicker-toggle matIconSuffix [for]="pickerIn"></mat-datepicker-toggle>
        <mat-datepicker #pickerIn></mat-datepicker>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Giờ vào</mat-label>
        <input matInput type="time" [ngModel]="checkInTime()" (ngModelChange)="checkInTime.set($event)" />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Ngày giờ ra</mat-label>
        <input matInput [matDatepicker]="pickerOut" [ngModel]="checkOutDate()" (ngModelChange)="checkOutDate.set($event)" />
        <mat-datepicker-toggle matIconSuffix [for]="pickerOut"></mat-datepicker-toggle>
        <mat-datepicker #pickerOut></mat-datepicker>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Giờ ra</mat-label>
        <input matInput type="time" [ngModel]="checkOutTime()" (ngModelChange)="checkOutTime.set($event)" />
      </mat-form-field>
      <mat-checkbox [ngModel]="isValidLocation()" (ngModelChange)="isValidLocation.set($event)" class="full-width">
        Vị trí hợp lệ
      </mat-checkbox>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Trạng thái</mat-label>
        <mat-select [ngModel]="status()" (ngModelChange)="status.set($event)">
          <mat-option value="valid">Hợp lệ</mat-option>
          <mat-option value="pending">Chờ duyệt</mat-option>
          <mat-option value="violation">Vi phạm</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Lý do bổ sung (NV)</mat-label>
        <textarea matInput [ngModel]="supplementReason()" (ngModelChange)="supplementReason.set($event)" rows="2"></textarea>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Ghi chú duyệt (QL)</mat-label>
        <textarea matInput [ngModel]="approvalNote()" (ngModelChange)="approvalNote.set($event)" rows="2"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Hủy</button>
      <button mat-button color="warn" (click)="delete()">Xoá</button>
      <button mat-flat-button color="primary" (click)="save()">Lưu</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .full-width { width: 100%; }
      .attendance-edit-content {
        min-width: 400px;
        max-height: 70vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
    `,
  ],
})
export class AttendanceEditDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<AttendanceEditDialogComponent, AttendanceEditDialogResult>);
  readonly data: AttendanceEditDialogData = inject(MAT_DIALOG_DATA);

  private readonly _workDateParsed = new Date(this.data.row.work_date + 'T12:00:00');
  private readonly _checkInParsed = parseIsoToDateAndTime(this.data.row.check_in_time);
  private readonly _checkOutParsed = parseIsoToDateAndTime(this.data.row.check_out_time);

  readonly employeeId = signal(this.data.row.employee_id);
  readonly workDate = signal<Date>(this._workDateParsed);
  readonly checkInDate = signal<Date>(this._checkInParsed.date);
  readonly checkInTime = signal(this._checkInParsed.time);
  readonly checkOutDate = signal<Date>(this._checkOutParsed.date);
  readonly checkOutTime = signal(this._checkOutParsed.time);
  readonly isValidLocation = signal(this.data.row.is_valid_location);
  readonly status = signal<'valid' | 'pending' | 'violation'>(this.data.row.status);
  readonly supplementReason = signal(this.data.row.supplement_reason ?? '');
  readonly approvalNote = signal((this.data.row as any).approval_note ?? '');

  save(): void {
    const checkInIso = toIso(this.checkInDate(), this.checkInTime());
    const checkOutIso = toIso(this.checkOutDate(), this.checkOutTime());
    this.dialogRef.close({
      action: 'save',
      patch: {
        employee_id: this.employeeId(),
        work_date: toWorkDate(this.workDate()),
        check_in_time: checkInIso,
        check_out_time: checkOutIso,
        is_valid_location: this.isValidLocation(),
        status: this.status(),
        supplement_reason: this.supplementReason().trim() || null,
        approval_note: this.approvalNote().trim() || null,
      },
    });
  }

  delete(): void {
    if (!confirm('Xoá chấm công này? Hành động không thể hoàn tác.')) return;
    this.dialogRef.close({ action: 'delete' });
  }
}
