import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { LeaveTypeService } from '../../../core/services/leave-type.service';
import { REQUEST_TYPE_LABELS, type LeaveRequest, type LeaveType, type LeaveRequestType } from '../../../core/models';

export interface LeaveRequestEditDialogData {
  row: LeaveRequest;
  employees: { id: string; employee_code: string; full_name: string }[];
}

export type LeaveRequestEditDialogResult =
  | {
      action: 'save';
      patch: {
        employee_id: string;
        manager_id: string | null;
        request_type: LeaveRequestType;
        leave_type: LeaveType;
        deduct_annual_leave: boolean;
        start_time: string;
        end_time: string;
        total_minutes_requested: number;
        reason: string | null;
        status: 'pending' | 'approved' | 'rejected';
        manager_note: string | null;
      };
    }
  | { action: 'delete' }
  | undefined;

function parseIsoToDateAndTime(iso: string): { date: Date; time: string } {
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

@Component({
  selector: 'app-leave-request-edit-dialog',
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
    <h2 mat-dialog-title>Đơn nghỉ phép</h2>
    <mat-dialog-content class="leave-edit-content">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Nhân viên</mat-label>
        <mat-select [ngModel]="employeeId()" (ngModelChange)="employeeId.set($event)">
          @for (e of data.employees; track e.id) {
            <mat-option [value]="e.id">{{ e.employee_code }} — {{ e.full_name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Người duyệt</mat-label>
        <mat-select [ngModel]="managerIdOrEmpty()" (ngModelChange)="onManagerIdChange($event)">
          <mat-option value="">— Không chọn —</mat-option>
          @for (e of data.employees; track e.id) {
            <mat-option [value]="e.id">{{ e.employee_code }} — {{ e.full_name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Loại đơn</mat-label>
        <mat-select [ngModel]="requestType()" (ngModelChange)="requestType.set($event)">
          @for (opt of requestTypeOptions; track opt) {
            <mat-option [value]="opt">{{ requestTypeLabels[opt] }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Loại nghỉ</mat-label>
        <mat-select [ngModel]="leaveType()" (ngModelChange)="leaveType.set($event)">
          @for (opt of leaveTypeOptions(); track opt) {
            <mat-option [value]="opt">{{ leaveTypeLabels()[opt] }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-checkbox [ngModel]="deductAnnualLeave()" (ngModelChange)="deductAnnualLeave.set($event)" class="full-width">
        Trừ phép năm
      </mat-checkbox>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Từ ngày</mat-label>
        <input matInput [matDatepicker]="pickerStart" [ngModel]="startDate()" (ngModelChange)="startDate.set($event)" />
        <mat-datepicker-toggle matIconSuffix [for]="pickerStart"></mat-datepicker-toggle>
        <mat-datepicker #pickerStart></mat-datepicker>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Từ giờ</mat-label>
        <input matInput type="time" [ngModel]="startTime()" (ngModelChange)="startTime.set($event)" />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Đến ngày</mat-label>
        <input matInput [matDatepicker]="pickerEnd" [ngModel]="endDate()" (ngModelChange)="endDate.set($event)" />
        <mat-datepicker-toggle matIconSuffix [for]="pickerEnd"></mat-datepicker-toggle>
        <mat-datepicker #pickerEnd></mat-datepicker>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Đến giờ</mat-label>
        <input matInput type="time" [ngModel]="endTime()" (ngModelChange)="endTime.set($event)" />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Phút yêu cầu</mat-label>
        <input matInput type="number" [ngModel]="totalMinutes()" (ngModelChange)="totalMinutes.set($event)" min="0" />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Lý do (nhân viên)</mat-label>
        <textarea matInput [ngModel]="reason()" (ngModelChange)="reason.set($event)" rows="2"></textarea>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Trạng thái</mat-label>
        <mat-select [ngModel]="status()" (ngModelChange)="status.set($event)">
          <mat-option value="pending">Chờ duyệt</mat-option>
          <mat-option value="approved">Đã duyệt</mat-option>
          <mat-option value="rejected">Từ chối</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Ghi chú quản lý</mat-label>
        <textarea matInput [ngModel]="managerNote()" (ngModelChange)="managerNote.set($event)" rows="3"></textarea>
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
      .leave-edit-content {
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
export class LeaveRequestEditDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<LeaveRequestEditDialogComponent, LeaveRequestEditDialogResult>);
  readonly data: LeaveRequestEditDialogData = inject(MAT_DIALOG_DATA);
  private readonly leaveTypeService = inject(LeaveTypeService);

  readonly requestTypeLabels = REQUEST_TYPE_LABELS;
  readonly leaveTypeLabels = this.leaveTypeService.labelsMap;
  readonly requestTypeOptions = Object.keys(REQUEST_TYPE_LABELS) as LeaveRequestType[];
  readonly leaveTypeOptions = this.leaveTypeService.allCodes;

  readonly employeeId = signal(this.data.row.employee_id);
  readonly managerId = signal<string | null>(this.data.row.manager_id);
  readonly managerIdOrEmpty = computed(() => this.managerId() ?? '');
  protected onManagerIdChange(v: string): void {
    this.managerId.set(v || null);
  }
  readonly requestType = signal<LeaveRequestType>(this.data.row.request_type);
  readonly leaveType = signal<LeaveType>(this.data.row.leave_type);
  readonly deductAnnualLeave = signal(this.data.row.deduct_annual_leave);
  private readonly _startParsed = parseIsoToDateAndTime(this.data.row.start_time);
  private readonly _endParsed = parseIsoToDateAndTime(this.data.row.end_time);
  readonly startDate = signal<Date>(this._startParsed.date);
  readonly startTime = signal(this._startParsed.time);
  readonly endDate = signal<Date>(this._endParsed.date);
  readonly endTime = signal(this._endParsed.time);
  readonly totalMinutes = signal(this.data.row.total_minutes_requested);
  readonly reason = signal(this.data.row.reason ?? '');
  readonly status = signal<'pending' | 'approved' | 'rejected'>(this.data.row.status);
  readonly managerNote = signal(this.data.row.manager_note ?? '');

  save(): void {
    const startIso = toIso(this.startDate(), this.startTime());
    const endIso = toIso(this.endDate(), this.endTime());
    const mins = Number(this.totalMinutes()) || 0;
    this.dialogRef.close({
      action: 'save',
      patch: {
        employee_id: this.employeeId(),
        manager_id: this.managerId(),
        request_type: this.requestType(),
        leave_type: this.leaveType(),
        deduct_annual_leave: this.deductAnnualLeave(),
        start_time: startIso,
        end_time: endIso,
        total_minutes_requested: mins,
        reason: this.reason().trim() || null,
        status: this.status(),
        manager_note: this.managerNote().trim() || null,
      },
    });
  }

  delete(): void {
    if (!confirm('Xoá đơn nghỉ này? Hành động không thể hoàn tác.')) return;
    this.dialogRef.close({ action: 'delete' });
  }
}
