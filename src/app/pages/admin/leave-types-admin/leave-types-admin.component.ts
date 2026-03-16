import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragHandle, CdkDropList, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { LeaveTypeService } from '../../../core/services/leave-type.service';
import type { LeaveTypeConfig } from '../../../core/models';
import {
  LeaveTypeEditDialogComponent,
  type LeaveTypeEditDialogData,
  type LeaveTypeEditDialogResult,
} from './leave-type-edit-dialog.component';

@Component({
  selector: 'app-leave-types-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormsModule,
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatIconModule,
    MatDialogModule,
  ],
  templateUrl: './leave-types-admin.html',
  styleUrl: './leave-types-admin.scss',
})
export class LeaveTypesAdminComponent implements OnInit {
  protected readonly leaveTypeService = inject(LeaveTypeService);
  private readonly dialog = inject(MatDialog);

  protected readonly showCreateForm = signal(false);
  protected readonly createCode = signal('');
  protected readonly createDisplayName = signal('');
  protected readonly createDescription = signal('');
  protected readonly createHasDuration = signal(true);
  protected readonly createDeductAnnual = signal(false);
  protected readonly createIsActive = signal(true);
  protected readonly createFormVisible = signal(true);
  protected readonly createSubmitting = signal(false);
  protected readonly createError = signal<string | null>(null);

  protected readonly list = this.leaveTypeService.list;
  protected readonly loading = this.leaveTypeService.loading;

  ngOnInit(): void {
    this.leaveTypeService.loadAll();
  }

  openCreate(): void {
    this.createCode.set('');
    this.createDisplayName.set('');
    this.createDescription.set('');
    this.createHasDuration.set(true);
    this.createDeductAnnual.set(false);
    this.createIsActive.set(true);
    this.createFormVisible.set(true);
    this.createError.set(null);
    this.showCreateForm.set(true);
  }

  closeCreate(): void {
    this.showCreateForm.set(false);
  }

  async submitCreate(): Promise<void> {
    const code = this.createCode().trim();
    const displayName = this.createDisplayName().trim();
    if (!code || !displayName) {
      this.createError.set('Vui lòng nhập mã và tên hiển thị');
      return;
    }
    const safeCode = code.toLowerCase().replace(/\s+/g, '_');
    this.createSubmitting.set(true);
    this.createError.set(null);
    const { error } = await this.leaveTypeService.create({
      code: safeCode,
      display_name: displayName,
      description: this.createDescription().trim() || null,
      has_duration: this.createHasDuration(),
      deduct_annual_leave: this.createDeductAnnual(),
      is_active: this.createIsActive(),
      is_form_visible: this.createFormVisible(),
    });
    this.createSubmitting.set(false);
    if (error) {
      this.createError.set(error);
      return;
    }
    this.closeCreate();
  }

  openEdit(row: LeaveTypeConfig): void {
    const ref = this.dialog.open<
      LeaveTypeEditDialogComponent,
      LeaveTypeEditDialogData,
      LeaveTypeEditDialogResult
    >(LeaveTypeEditDialogComponent, {
      data: { row },
      width: '420px',
    });
    ref.afterClosed().subscribe(async (result) => {
      if (!result || !row.id) return;
      if (result.action === 'save') {
        await this.leaveTypeService.update(row.id, result.patch);
      } else if (result.action === 'delete') {
        await this.leaveTypeService.delete(row.id);
      }
    });
  }

  async drop(event: CdkDragDrop<LeaveTypeConfig[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) return;
    const items = [...this.leaveTypeService.list()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    const ids = items.map((i) => i.id);
    await this.leaveTypeService.reorder(ids);
  }
}
