import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { DecimalPipe } from '@angular/common';
import { EmployeeService } from '../../../core/services/employee.service';
import { ReportService } from '../../../core/services/report.service';
import { ExportCsvService } from '../../../core/services/export-csv.service';
import type { LeaveReportRow } from '../../../core/services/report.service';
import type { Department } from '../../../core/models';

@Component({
  selector: 'app-leave-report',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, MatFormFieldModule, MatSelectModule, MatButtonModule, DecimalPipe],
  templateUrl: './leave-report.html',
  styleUrl: './leave-report.scss',
})
export class LeaveReportComponent implements OnInit {
  protected readonly employeeService = inject(EmployeeService);
  protected readonly reportService = inject(ReportService);
  protected readonly exportCsv = inject(ExportCsvService);

  protected readonly year = signal<number>(new Date().getFullYear());
  protected readonly departmentId = signal<string | null>(null);
  protected readonly rows = signal<LeaveReportRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly departments = signal<Department[]>([]);

  protected readonly years = (() => {
    const y = new Date().getFullYear();
    return [y, y - 1];
  })();

  async ngOnInit(): Promise<void> {
    const depts = await this.employeeService.getDepartments();
    this.departments.set(depts);
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    const data = await this.reportService.getLeaveReport(this.year(), this.departmentId());
    this.rows.set(data);
    this.loading.set(false);
  }

  protected exportCsvReport(): void {
    const data = this.rows().map((r) => ({
      employee_code: r.employee_code,
      full_name: r.full_name,
      department_code: r.department_code ?? '',
      total_days: r.total_days.toFixed(1),
      used_days: r.used_days.toFixed(1),
      remaining_days: r.remaining_days.toFixed(1),
    }));
    this.exportCsv.download(data, `bao-cao-nghi-phep-${this.year()}.csv`);
  }
}
