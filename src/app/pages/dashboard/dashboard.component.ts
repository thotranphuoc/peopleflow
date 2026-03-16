import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { EmployeeService } from '../../core/services/employee.service';
import { LeaveRequestService } from '../../core/services/leave-request.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly employeeService = inject(EmployeeService);
  protected readonly leaveService = inject(LeaveRequestService);

  protected readonly pendingCount = this.leaveService.pendingForManager;
  protected readonly balance = this.leaveService.balance;
  protected readonly isManager = this.employeeService.isManager;

  async ngOnInit(): Promise<void> {
    const uid = this.auth.user()?.id;
    if (!uid) return;
    await this.employeeService.loadCurrentEmployee(uid);
    const emp = this.employeeService.currentEmployee();
    if (emp) {
      if (this.employeeService.isManager()) {
        this.leaveService.loadPendingForManager(emp.id);
      }
      this.leaveService.loadLeaveBalance(emp.id, new Date().getFullYear());
    }
  }

  protected balanceSummary(): string {
    const b = this.balance();
    if (!b) return '—';
    const rem = Math.max(0, b.total_minutes - b.used_minutes);
    const days = (rem / 480).toFixed(1);
    return `${days} ngày còn lại`;
  }

  protected readonly currentYear = new Date().getFullYear();

  protected currentMonthLabel(): string {
    const d = new Date();
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    return `Tháng ${m}/${y}`;
  }

  protected greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  }

  protected displayName(): string {
    const emp = this.employeeService.currentEmployee();
    return emp?.full_name ?? emp?.employee_code ?? this.auth.user()?.email ?? 'Nhân viên';
  }
}
