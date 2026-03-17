import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
  effect,
  inject,
} from '@angular/core';
import { AttendanceService } from '../../core/services/attendance.service';

@Component({
  selector: 'app-check-in-photo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (signedUrl()) {
      <button type="button" class="photo-btn" (click)="onClick()" [title]="title()">
        <img [src]="signedUrl()!" [alt]="alt()" [class]="imgClass()" />
      </button>
    } @else if (loading()) {
      <span class="photo-loading">{{ loadingLabel() }}</span>
    }
  `,
  styles: [
    `
      .photo-btn {
        padding: 0;
        border: none;
        background: none;
        cursor: pointer;
        border-radius: 6px;
        overflow: hidden;
        display: inline-flex;
        transition: transform 0.2s ease;
      }
      .photo-btn:hover {
        transform: scale(1.05);
      }
      .photo-btn img {
        vertical-align: middle;
      }
      .photo-btn img.check-photo-thumb {
        width: 36px;
        height: 36px;
        object-fit: cover;
        border-radius: 6px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      }
      .photo-btn img.photo-thumb {
        max-width: 100%;
        max-height: 180px;
        display: block;
        border-radius: 8px;
        border: 1px solid rgba(0, 0, 0, 0.06);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        transition: box-shadow 0.2s ease;
      }
      .photo-btn:hover img.photo-thumb {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
      .photo-loading {
        font-size: 0.75rem;
        color: var(--ml-text-muted);
      }
    `,
  ],
})
export class CheckInPhotoComponent {
  private readonly attendanceService = inject(AttendanceService);

  /** Path hoặc URL cũ (sẽ extract path). */
  readonly pathOrUrl = input.required<string>();
  /** Thay đổi để ép re-fetch (khi vừa upload ảnh mới, path giống nhưng nội dung đổi). */
  readonly refreshTrigger = input<number | string>(0);
  readonly imgClass = input<string>('');
  readonly title = input<string>('Xem ảnh');
  readonly alt = input<string>('Ảnh chấm công');
  readonly loadingLabel = input<string>('Đang tải...');

  readonly photoClick = output<string>();

  protected readonly signedUrl = signal<string | null>(null);
  protected readonly loading = signal(true);

  constructor() {
    effect(() => {
      const path = this.pathOrUrl();
      void this.refreshTrigger();
      if (!path) {
        this.loading.set(false);
        return;
      }
      this.loading.set(true);
      this.attendanceService.getSignedPhotoUrl(path).then((url) => {
        this.signedUrl.set(url);
        this.loading.set(false);
      });
    });
  }

  protected onClick(): void {
    const url = this.signedUrl();
    if (url) this.photoClick.emit(url);
  }
}
