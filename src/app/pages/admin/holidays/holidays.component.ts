import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { HolidayService } from '../../../core/services/holiday.service';
import type { Holiday } from '../../../core/models';

@Component({
  selector: 'app-holidays',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatIconModule,
  ],
  templateUrl: './holidays.html',
  styleUrl: './holidays.scss',
})
export class HolidaysComponent implements OnInit {
  protected readonly holidayService = inject(HolidayService);

  protected readonly yearFilter = signal<number | null>(null);
  protected readonly showCreateForm = signal(false);
  protected readonly createDate = signal<Date>(new Date());
  protected readonly createName = signal('');
  protected readonly createIsRecurring = signal(false);
  protected readonly createSubmitting = signal(false);
  protected readonly createError = signal<string | null>(null);

  protected readonly editId = signal<string | null>(null);
  protected readonly editDate = signal<Date>(new Date());
  protected readonly editName = signal('');
  protected readonly editIsRecurring = signal(false);

  protected readonly list = this.holidayService.list;
  protected readonly loading = this.holidayService.loading;

  protected readonly years = computed(() => {
    const y = new Date().getFullYear();
    return [y + 1, y, y - 1, y - 2];
  });

  /** List sorted by calendar date (1/1 → 31/12). Recurring shown with year = filter or current. */
  protected readonly sortedList = computed(() => {
    const raw = this.list();
    const year = this.yearFilter() ?? new Date().getFullYear();
    return raw
      .map((h) => {
        const d = h.date.slice(0, 10);
        const effective = h.is_recurring ? `${year}-${d.slice(5, 10)}` : d;
        const [yyyy, mm, dd] = effective.split('-');
        const displayDateFormatted = `${dd}/${mm}/${yyyy}`;
        return { h, displayDateFormatted, effective };
      })
      .sort((a, b) => a.effective.localeCompare(b.effective));
  });

  ngOnInit(): void {
    this.holidayService.loadAll();
  }

  filterByYear(year: number | null): void {
    this.yearFilter.set(year);
    if (year == null) this.holidayService.loadAll();
    else this.holidayService.loadForYear(year);
  }

  openCreate(): void {
    this.createDate.set(new Date());
    this.createName.set('');
    this.createIsRecurring.set(false);
    this.createError.set(null);
    this.showCreateForm.set(true);
  }

  closeCreate(): void {
    this.showCreateForm.set(false);
  }

  async submitCreate(): Promise<void> {
    const name = this.createName().trim();
    if (!name) {
      this.createError.set('Vui lòng nhập tên ngày lễ');
      return;
    }
    this.createSubmitting.set(true);
    this.createError.set(null);
    const d = this.createDate();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const { error } = await this.holidayService.create({
      date: dateStr,
      name,
      is_recurring: this.createIsRecurring(),
    });
    this.createSubmitting.set(false);
    if (error) {
      this.createError.set(error);
      return;
    }
    this.closeCreate();
    const y = this.yearFilter();
    if (y != null) await this.holidayService.loadForYear(y);
    else await this.holidayService.loadAll();
  }

  openEdit(h: Holiday): void {
    const dateStr = h.date.slice(0, 10);
    const [y, m, d] = dateStr.split('-').map(Number);
    this.editId.set(h.id);
    this.editDate.set(new Date(y, m - 1, d));
    this.editName.set(h.name);
    this.editIsRecurring.set(h.is_recurring);
  }

  cancelEdit(): void {
    this.editId.set(null);
  }

  async submitEdit(): Promise<void> {
    const id = this.editId();
    if (!id) return;
    const name = this.editName().trim();
    if (!name) return;
    const d = this.editDate();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const { error } = await this.holidayService.update(id, {
      date: dateStr,
      name,
      is_recurring: this.editIsRecurring(),
    });
    if (error) return;
    this.editId.set(null);
    const y = this.yearFilter();
    if (y != null) await this.holidayService.loadForYear(y);
    else await this.holidayService.loadAll();
  }

  async deleteHoliday(id: string): Promise<void> {
    if (!confirm('Xóa ngày lễ này?')) return;
    await this.holidayService.delete(id);
    const y = this.yearFilter();
    if (y != null) await this.holidayService.loadForYear(y);
    else await this.holidayService.loadAll();
  }

}
