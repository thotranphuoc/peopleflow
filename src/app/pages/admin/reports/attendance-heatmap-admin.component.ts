import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmployeeService } from '../../../core/services/employee.service';
import { AttendanceHeatmapComponent } from '../../attendance-heatmap/attendance-heatmap.component';
import type { Employee } from '../../../core/models';

@Component({
  selector: 'app-attendance-heatmap-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AttendanceHeatmapComponent],
  templateUrl: './attendance-heatmap-admin.html',
  styleUrl: './attendance-heatmap-admin.scss',
})
export class AttendanceHeatmapAdminComponent implements OnInit {
  protected readonly employeeService = inject(EmployeeService);

  protected readonly employees = signal<Employee[]>([]);
  protected readonly selectedEmployeeId = signal<string | null>(null);
  protected readonly loading = signal(true);

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    const list = await this.employeeService.getEmployees();
    this.employees.set(list);
    if (list.length > 0 && !this.selectedEmployeeId()) {
      this.selectedEmployeeId.set(list[0].id);
    }
    this.loading.set(false);
  }

  protected selectEmployee(id: string): void {
    this.selectedEmployeeId.set(id);
  }
}
