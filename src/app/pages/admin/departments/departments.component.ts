import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { EmployeeService } from '../../../core/services/employee.service';
import type { Department } from '../../../core/models';

@Component({
  selector: 'app-departments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './departments.html',
  styleUrl: './departments.scss',
})
export class DepartmentsComponent implements OnInit {
  protected readonly employeeService = inject(EmployeeService);

  protected readonly list = signal<Department[]>([]);
  protected readonly loading = signal(true);
  protected readonly message = signal<string | null>(null);

  protected readonly showAddForm = signal(false);
  protected readonly addCode = signal('');
  protected readonly addName = signal('');
  protected readonly addSubmitting = signal(false);
  protected readonly addError = signal<string | null>(null);

  protected readonly editId = signal<string | null>(null);
  protected readonly editCode = signal('');
  protected readonly editName = signal('');
  protected readonly editSubmitting = signal(false);
  protected readonly editError = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.message.set(null);
    const data = await this.employeeService.getDepartments();
    this.list.set(data);
    this.loading.set(false);
  }

  protected openAdd(): void {
    this.addCode.set('');
    this.addName.set('');
    this.addError.set(null);
    this.showAddForm.set(true);
  }

  protected closeAdd(): void {
    this.showAddForm.set(false);
  }

  protected async submitAdd(): Promise<void> {
    const code = this.addCode().trim();
    const name = this.addName().trim();
    if (!code || !name) {
      this.addError.set('Mã và tên phòng ban không để trống.');
      return;
    }
    this.addSubmitting.set(true);
    this.addError.set(null);
    const err = await this.employeeService.createDepartment({ code, name });
    this.addSubmitting.set(false);
    if (err) {
      this.addError.set(err);
      return;
    }
    this.closeAdd();
    await this.load();
  }

  protected openEdit(d: Department): void {
    this.editId.set(d.id);
    this.editCode.set(d.code);
    this.editName.set(d.name);
    this.editError.set(null);
  }

  protected cancelEdit(): void {
    this.editId.set(null);
  }

  protected async submitEdit(): Promise<void> {
    const id = this.editId();
    if (!id) return;
    const code = this.editCode().trim();
    const name = this.editName().trim();
    if (!code || !name) {
      this.editError.set('Mã và tên phòng ban không để trống.');
      return;
    }
    this.editSubmitting.set(true);
    this.editError.set(null);
    const err = await this.employeeService.updateDepartment(id, { code, name });
    this.editSubmitting.set(false);
    if (err) {
      this.editError.set(err);
      return;
    }
    this.editId.set(null);
    await this.load();
  }

  protected async deleteDept(d: Department): Promise<void> {
    if (!confirm(`Xóa phòng ban "${d.name}" (${d.code})? Nhân viên thuộc phòng sẽ bỏ gán phòng.`)) return;
    const err = await this.employeeService.deleteDepartment(d.id);
    if (err) this.message.set('Lỗi: ' + err);
    else await this.load();
  }
}
