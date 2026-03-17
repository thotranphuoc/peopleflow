import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface PhotoViewerDialogData {
  photoUrl: string;
  title?: string;
  /** Hiện nút Đóng (sau check-in/check-out) */
  showSuccess?: boolean;
}

@Component({
  selector: 'app-photo-viewer-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title ?? 'Ảnh chấm công' }}</h2>
    <mat-dialog-content>
      <img [src]="data.photoUrl" alt="Ảnh chấm công" class="photo-full" />
    </mat-dialog-content>
    @if (data.showSuccess) {
      <mat-dialog-actions align="end">
        <button mat-flat-button color="primary" mat-dialog-close>Đóng</button>
      </mat-dialog-actions>
    }
  `,
  styles: [
    `
      mat-dialog-content {
        padding: 0;
        overflow: hidden;
      }
      .photo-full {
        max-width: 90vw;
        max-height: 80vh;
        display: block;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
      }
    `,
  ],
})
export class PhotoViewerDialogComponent {
  readonly data: PhotoViewerDialogData = inject(MAT_DIALOG_DATA);
}
