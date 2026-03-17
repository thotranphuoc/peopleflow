import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
  effect,
  OnDestroy,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface CameraCaptureDialogData {
  title: string;
}

export type CameraCaptureResult = Blob | null;

@Component({
  selector: 'app-camera-capture-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ data().title }}</h2>
    <mat-dialog-content>
      @if (error()) {
        <div class="camera-error">
          <mat-icon>videocam_off</mat-icon>
          <p>{{ error() }}</p>
          <p class="hint">Đảm bảo bạn truy cập qua HTTPS hoặc localhost và đã cấp quyền camera.</p>
        </div>
      } @else if (previewUrl()) {
        <div class="photo-preview-wrap">
          <img [src]="previewUrl()!" alt="Ảnh vừa chụp" class="photo-preview" />
          <p class="preview-hint">Kiểm tra ảnh. Click "Chụp lại" nếu chưa ổn.</p>
        </div>
      } @else {
        <div class="camera-preview-wrap">
          <video
            #videoEl
            class="camera-preview"
            [class.hidden]="loading()"
            autoplay
            playsinline
            muted
          ></video>
          @if (loading()) {
            <div class="camera-loading-overlay">
              <mat-icon class="spinner">sync</mat-icon>
              <p>Đang mở camera...</p>
            </div>
          }
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (error()) {
        <button mat-flat-button mat-dialog-close>Đóng</button>
      } @else if (previewUrl()) {
        <button mat-button (click)="retake()">
          <mat-icon>camera_alt</mat-icon>
          Chụp lại
        </button>
        <button mat-flat-button color="primary" (click)="confirm()">
          <mat-icon>check</mat-icon>
          Xác nhận
        </button>
      } @else {
        <button mat-button mat-dialog-close>Hủy</button>
        <button
          mat-flat-button
          color="primary"
          [disabled]="loading() || !!error()"
          (click)="capture()"
        >
          <mat-icon>camera_alt</mat-icon>
          Chụp ảnh
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [
    `
      .camera-preview-wrap {
        min-width: 320px;
        min-height: 240px;
        max-width: 100%;
        background: #000;
        border-radius: 8px;
        overflow: hidden;
        position: relative;
      }
      .camera-preview {
        width: 100%;
        height: auto;
        display: block;
        max-height: 70vh;
      }
      .camera-preview.hidden {
        visibility: hidden;
        position: absolute;
      }
      .photo-preview-wrap {
        min-width: 320px;
        min-height: 240px;
        max-width: 100%;
        background: #000;
        border-radius: 8px;
        overflow: hidden;
      }
      .photo-preview {
        width: 100%;
        height: auto;
        display: block;
        max-height: 70vh;
      }
      .preview-hint {
        margin: 0.5rem 0 0;
        font-size: 0.875rem;
        color: var(--ml-text-muted);
      }
      .camera-loading-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        background: #111;
        color: #fff;
      }
      .camera-loading-overlay .spinner {
        animation: spin 1s linear infinite;
      }
      .camera-error {
        min-width: 320px;
        min-height: 200px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 1.5rem;
        text-align: center;
      }
      .camera-error mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--ml-error, #ef4444);
      }
      .camera-error .hint {
        font-size: 0.875rem;
        color: var(--ml-text-muted);
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      mat-dialog-actions button mat-icon {
        margin-right: 4px;
        vertical-align: middle;
      }
    `,
  ],
})
export class CameraCaptureDialogComponent implements OnDestroy {
  readonly dialogRef = inject(MatDialogRef<CameraCaptureDialogComponent, CameraCaptureResult>);
  readonly data = signal<CameraCaptureDialogData>(
    inject(MAT_DIALOG_DATA, { optional: true }) ?? { title: 'Chụp ảnh check-in' }
  );

  protected readonly videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoEl');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly previewUrl = signal<string | null>(null);

  private stream: MediaStream | null = null;
  private capturedBlob: Blob | null = null;

  /** Init is done when video element is available - use effect to start stream */
  private initEffect = effect(() => {
    if (this.previewUrl()) return;
    const el = this.videoEl();
    const video = el?.nativeElement;
    if (!video) return;
    void this.startCamera(video);
  });

  private async startCamera(video: HTMLVideoElement): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ camera. Vui lòng dùng Chrome, Safari hoặc Firefox.');
      }

      // Check secure context (HTTPS or localhost)
      if (!window.isSecureContext) {
        throw new Error(
          'Camera chỉ hoạt động trên HTTPS hoặc localhost. Bạn đang truy cập qua HTTP.'
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });

      this.stream = stream;
      video.srcObject = stream;
      await video.play();
      this.loading.set(false);
    } catch (e) {
      this.loading.set(false);
      this.stream = null;
      const err = e instanceof Error ? e : new Error(String(e));
      const msg = this.getErrorMessage(err);
      this.error.set(msg);
    }
  }

  private getErrorMessage(err: Error): string {
    const name = (err as Error & { name?: string }).name;
    switch (name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Bạn đã từ chối quyền camera. Vui lòng bật quyền camera trong cài đặt trình duyệt.';
      case 'NotFoundError':
        return 'Không tìm thấy camera. Kiểm tra thiết bị có camera và chưa bị ứng dụng khác sử dụng.';
      case 'NotReadableError':
        return 'Camera đang được sử dụng bởi ứng dụng khác. Đóng ứng dụng đó và thử lại.';
      case 'OverconstrainedError':
        return 'Camera không đáp ứng yêu cầu. Thử trình duyệt khác.';
      case 'SecurityError':
        return 'Camera bị chặn vì lý do bảo mật. Truy cập qua HTTPS hoặc localhost.';
      default:
        return err.message || 'Không thể mở camera. Cho phép quyền camera và thử lại.';
    }
  }

  protected capture(): void {
    const video = this.videoEl()?.nativeElement;
    if (!video || !video.videoWidth || this.loading() || this.error()) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        this.cleanup();
        this.capturedBlob = blob;
        this.previewUrl.set(URL.createObjectURL(blob));
      },
      'image/jpeg',
      0.9
    );
  }

  protected retake(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set(null);
    this.capturedBlob = null;
    this.loading.set(true);
  }

  protected confirm(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.cleanup();
    this.dialogRef.close(this.capturedBlob ?? null);
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  ngOnDestroy(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.cleanup();
  }
}
