import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { SalaryGradeService } from '../../../core/services/salary-grade.service';
import type { SalaryGrade } from '../../../core/models';

@Component({
  selector: 'app-salary-grades',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    DecimalPipe,
  ],
  templateUrl: './salary-grades.html',
  styleUrl: './salary-grades.scss',
})
export class SalaryGradesComponent implements OnInit {
  protected readonly gradeService = inject(SalaryGradeService);

  protected readonly list = signal<SalaryGrade[]>([]);
  protected readonly loading = signal(true);
  protected readonly message = signal<string | null>(null);

  protected readonly showAddForm = signal(false);
  protected readonly addName = signal('');
  protected readonly addP1 = signal<number>(0);
  protected readonly addP2 = signal<number>(0);
  protected readonly addP3 = signal<number>(0);
  protected readonly addSubmitting = signal(false);
  protected readonly addError = signal<string | null>(null);

  protected readonly editId = signal<string | null>(null);
  protected readonly editName = signal('');
  protected readonly editP1 = signal<number>(0);
  protected readonly editP2 = signal<number>(0);
  protected readonly editP3 = signal<number>(0);
  protected readonly editSubmitting = signal(false);
  protected readonly editError = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.message.set(null);
    const data = await this.gradeService.getAll();
    this.list.set(data);
    this.loading.set(false);
  }

  protected openAdd(): void {
    this.addName.set('');
    this.addP1.set(0);
    this.addP2.set(0);
    this.addP3.set(0);
    this.addError.set(null);
    this.showAddForm.set(true);
  }

  protected closeAdd(): void {
    this.showAddForm.set(false);
  }

  protected async submitAdd(): Promise<void> {
    const name = this.addName().trim();
    if (!name) {
      this.addError.set('Nhập tên mức lương');
      return;
    }
    this.addSubmitting.set(true);
    this.addError.set(null);
    const err = await this.gradeService.create({
      name,
      p1_salary: this.addP1(),
      p2_salary: this.addP2(),
      p3_salary: this.addP3(),
    });
    this.addSubmitting.set(false);
    if (err) {
      this.addError.set(err);
      return;
    }
    this.closeAdd();
    await this.load();
  }

  protected openEdit(row: SalaryGrade): void {
    this.editId.set(row.id);
    this.editName.set(row.name);
    this.editP1.set(row.p1_salary);
    this.editP2.set(row.p2_salary);
    this.editP3.set(row.p3_salary ?? 0);
    this.editError.set(null);
  }

  protected cancelEdit(): void {
    this.editId.set(null);
  }

  protected async submitEdit(): Promise<void> {
    const id = this.editId();
    if (!id) return;
    const name = this.editName().trim();
    if (!name) {
      this.editError.set('Nhập tên mức lương');
      return;
    }
    this.editSubmitting.set(true);
    this.editError.set(null);
    const err = await this.gradeService.update(id, {
      name,
      p1_salary: this.editP1(),
      p2_salary: this.editP2(),
      p3_salary: this.editP3(),
    });
    this.editSubmitting.set(false);
    if (err) {
      this.editError.set(err);
      return;
    }
    this.editId.set(null);
    await this.load();
  }

  protected async deleteGrade(row: SalaryGrade): Promise<void> {
    if (!confirm(`Xóa mức lương "${row.name}"? Cấu hình lương đang dùng mức này sẽ bỏ tham chiếu.`)) return;
    const err = await this.gradeService.delete(row.id);
    if (err) this.message.set('Lỗi: ' + err);
    else await this.load();
  }
}
