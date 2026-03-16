import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import type { LeaveTypeConfig } from '../../../core/models';

export interface LeaveTypeEditDialogData {
  row: LeaveTypeConfig;
}

export type LeaveTypeEditDialogResult =
  | {
      action: 'save';
      patch: {
        code: string;
        display_name: string;
        description: string | null;
        has_duration: boolean;
        deduct_annual_leave: boolean;
        is_active: boolean;
        is_form_visible: boolean;
      };
    }
  | { action: 'delete' }
  | undefined;

@Component({
  selector: 'app-leave-type-edit-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
  ],
  template: `
    <h2 mat-dialog-title>Cập nhật loại nghỉ phép</h2>
    <mat-dialog-content class="leave-type-edit-content">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Mã</mat-label>
        <input matInput [ngModel]="code()" (ngModelChange)="code.set($event)" />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Tên hiển thị</mat-label>
        <input matInput [ngModel]="displayName()" (ngModelChange)="displayName.set($event)" placeholder="VD: Phép năm" />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Ý nghĩa</mat-label>
        <input matInput [ngModel]="description()" (ngModelChange)="description.set($event)" placeholder="Giải thích ngắn gọn loại nghỉ này" />
      </mat-form-field>
      <mat-checkbox [ngModel]="hasDuration()" (ngModelChange)="hasDuration.set($event)">Có chọn hình thức (nguyên/nửa ngày/theo giờ)</mat-checkbox>
      <mat-checkbox [ngModel]="deductAnnual()" (ngModelChange)="deductAnnual.set($event)">Trừ phép năm</mat-checkbox>
      <mat-checkbox [ngModel]="isActive()" (ngModelChange)="isActive.set($event)">Đang dùng</mat-checkbox>
      <mat-checkbox [ngModel]="formVisible()" (ngModelChange)="formVisible.set($event)">Hiện trong form tạo đơn</mat-checkbox>
      @if (error()) {
        <p class="error-msg">{{ error() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Hủy</button>
      <button mat-button color="warn" (click)="delete()">Xóa</button>
      <button mat-flat-button color="primary" (click)="save()">Lưu</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .full-width { width: 100%; }
      .leave-type-edit-content {
        min-width: 380px;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .error-msg { font-size: 0.875rem; color: var(--ml-error); margin: 0; }
    `,
  ],
})
export class LeaveTypeEditDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<LeaveTypeEditDialogComponent, LeaveTypeEditDialogResult>);
  readonly data: LeaveTypeEditDialogData = inject(MAT_DIALOG_DATA);

  readonly code = signal(this.data.row.code);
  readonly displayName = signal(this.data.row.display_name);
  readonly description = signal(this.data.row.description ?? '');
  readonly hasDuration = signal(this.data.row.has_duration);
  readonly deductAnnual = signal(this.data.row.deduct_annual_leave);
  readonly isActive = signal(this.data.row.is_active);
  readonly formVisible = signal(this.data.row.is_form_visible);
  readonly error = signal<string | null>(null);

  save(): void {
    const dn = this.displayName().trim();
    if (!dn) {
      this.error.set('Vui lòng nhập tên hiển thị');
      return;
    }
    this.error.set(null);
    this.dialogRef.close({
      action: 'save',
      patch: {
        code: this.code().trim().toLowerCase().replace(/\s+/g, '_'),
        display_name: dn,
        description: this.description().trim() || null,
        has_duration: this.hasDuration(),
        deduct_annual_leave: this.deductAnnual(),
        is_active: this.isActive(),
        is_form_visible: this.formVisible(),
      },
    });
  }

  delete(): void {
    if (!confirm('Xóa loại nghỉ này? Các đơn nghỉ đã có vẫn giữ nguyên mã.')) return;
    this.dialogRef.close({ action: 'delete' });
  }
}
