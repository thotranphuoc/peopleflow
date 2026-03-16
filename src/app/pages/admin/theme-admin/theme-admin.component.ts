import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ThemeService } from '../../../core/services/theme.service';

const DAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

/** Gợi ý 7 màu đẹp cho năm 2026 */
const PRESET_2026 = [
  '#0d9488', // CN - Teal (bình yên)
  '#2563eb', // T2 - Royal blue (khởi đầu tuần)
  '#7c3aed', // T3 - Violet (sáng tạo)
  '#059669', // T4 - Emerald (phát triển)
  '#ea580c', // T5 - Amber (năng lượng)
  '#0284c7', // T6 - Sky blue (cuối tuần sắp tới)
  '#c026d3', // T7 - Fuchsia (thư giãn)
];

@Component({
  selector: 'app-theme-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './theme-admin.html',
  styleUrl: './theme-admin.scss',
})
export class ThemeAdminComponent implements OnInit {
  protected readonly themeService = inject(ThemeService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly message = signal<string | null>(null);

  protected readonly colors = signal<string[]>(['#0d9488', '#0d9488', '#0d9488', '#0d9488', '#0d9488', '#0d9488', '#0d9488']);

  protected readonly dayLabels = DAY_LABELS;

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    const row = await this.themeService.getTheme();
    if (row) {
      this.colors.set([
        row.color_0 || '#0d9488',
        row.color_1 || '#0d9488',
        row.color_2 || '#0d9488',
        row.color_3 || '#0d9488',
        row.color_4 || '#0d9488',
        row.color_5 || '#0d9488',
        row.color_6 || '#0d9488',
      ]);
    }
    this.loading.set(false);
  }

  protected setColor(index: number, value: string): void {
    let hex = value.trim();
    if (hex && !hex.startsWith('#')) hex = '#' + hex;
    this.colors.update((arr) => {
      const next = [...arr];
      next[index] = hex || arr[index];
      return next;
    });
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    this.message.set(null);
    const c = this.colors();
    const err = await this.themeService.updateTheme({
      color_0: c[0],
      color_1: c[1],
      color_2: c[2],
      color_3: c[3],
      color_4: c[4],
      color_5: c[5],
      color_6: c[6],
    });
    this.saving.set(false);
    if (err) {
      this.message.set('Lỗi: ' + err);
      return;
    }
    this.message.set('Đã lưu. Theme sẽ thay đổi theo ngày trong tuần.');
  }

  protected previewDay(index: number): void {
    this.themeService.applyForDay(index, this.colors()[index]);
  }

  protected applyPreset2026(): void {
    this.colors.set([...PRESET_2026]);
    this.message.set('Đã áp dụng gợi ý 7 màu 2026. Nhấn Lưu để ghi vào hệ thống.');
  }
}
