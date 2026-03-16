import { ChangeDetectionStrategy, Component, inject, signal, OnInit, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { AuditLogService, type AuditLogEntry } from '../../../core/services/audit-log.service';
import { EmployeeService } from '../../../core/services/employee.service';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, MatFormFieldModule, MatSelectModule, MatInputModule, MatButtonModule],
  templateUrl: './audit-logs.html',
  styleUrl: './audit-logs.scss',
})
export class AuditLogsComponent implements OnInit {
  protected readonly auditService = inject(AuditLogService);
  protected readonly employeeService = inject(EmployeeService);

  protected readonly rows = signal<AuditLogEntry[]>([]);
  protected readonly employees = signal<{ id: string; full_name: string; employee_code: string }[]>([]);
  protected readonly actorNameMap = computed(() => {
    const emps = this.employees();
    const m: Record<string, string> = {};
    for (const e of emps) m[e.id] = `${e.full_name} (${e.employee_code})`;
    return m;
  });
  protected readonly loading = signal(false);
  protected readonly tableFilter = signal<string>('');
  protected readonly actionFilter = signal<string>('');
  protected readonly fromDate = signal<string>('');
  protected readonly toDate = signal<string>('');

  protected readonly tableOptions = [
    { value: '', label: 'Tất cả bảng' },
    { value: 'payrolls', label: 'payrolls' },
    { value: 'payroll_configs', label: 'payroll_configs' },
    { value: 'leave_requests', label: 'leave_requests' },
    { value: 'employees', label: 'employees' },
  ];
  protected readonly actionOptions = [
    { value: '', label: 'Tất cả thao tác' },
    { value: 'save_batch', label: 'save_batch (Lưu phiếu lương)' },
    { value: 'publish_batch', label: 'publish_batch (Công bố phiếu lương)' },
    { value: 'unpublish_batch', label: 'unpublish_batch (Bỏ công bố phiếu lương)' },
    { value: 'publish_one', label: 'publish_one (Công bố 1 phiếu)' },
    { value: 'unpublish_one', label: 'unpublish_one (Bỏ công bố 1 phiếu)' },
    { value: 'approve', label: 'approve (Duyệt đơn)' },
    { value: 'reject', label: 'reject (Từ chối đơn)' },
    { value: 'create', label: 'create (Thêm cấu hình lương)' },
    { value: 'update', label: 'update (Cập nhật cấu hình lương)' },
    { value: 'delete', label: 'delete (Xóa cấu hình lương)' },
  ];

  async ngOnInit(): Promise<void> {
    const emps = await this.employeeService.getEmployees();
    this.employees.set(emps.map((e) => ({ id: e.id, full_name: e.full_name, employee_code: e.employee_code })));
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    const from = this.fromDate() || undefined;
    const to = this.toDate() || undefined;
    const data = await this.auditService.getList({
      table_name: this.tableFilter() || undefined,
      action: this.actionFilter() || undefined,
      from_date: from ? from + 'T00:00:00.000Z' : undefined,
      to_date: to ? to + 'T23:59:59.999Z' : undefined,
      limit: 200,
    });
    this.rows.set(data);
    this.loading.set(false);
  }

  protected formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('vi-VN');
  }

  protected jsonPreview(obj: unknown, maxLen = 120): string {
    if (obj == null) return '—';
    try {
      const s = JSON.stringify(obj);
      return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
    } catch {
      return String(obj);
    }
  }

  protected actorLabel(actorId: string | null): string {
    if (!actorId) return '—';
    return this.actorNameMap()[actorId] ?? actorId.slice(0, 8) + '…';
  }
}
