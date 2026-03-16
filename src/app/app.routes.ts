import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { employeeGuard } from './core/guards/employee.guard';
import { roleGuard } from './core/guards/role.guard';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent) },
  { path: 'pending', loadComponent: () => import('./pages/pending/pending.component').then(m => m.PendingComponent) },
  { path: 'forgot-password', loadComponent: () => import('./pages/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent) },
  { path: 'reset-password', loadComponent: () => import('./pages/reset-password/reset-password.component').then(m => m.ResetPasswordComponent) },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard, employeeGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'timesheet', loadComponent: () => import('./pages/timesheet/timesheet.component').then(m => m.TimesheetComponent) },
      { path: 'annual-leave', redirectTo: 'leave', pathMatch: 'full' },
      { path: 'leave', loadComponent: () => import('./pages/leave/leave.component').then(m => m.LeaveComponent) },
      { path: 'absence', loadComponent: () => import('./pages/absence/absence.component').then(m => m.AbsenceComponent) },
      { path: 'profile', loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent) },
      { path: 'payslip', loadComponent: () => import('./pages/payslip/payslip.component').then(m => m.PayslipComponent) },
      { path: 'notifications', loadComponent: () => import('./pages/notifications/notifications.component').then(m => m.NotificationsComponent) },
      { path: 'attendance-heatmap', loadComponent: () => import('./pages/attendance-heatmap/attendance-heatmap.component').then(m => m.AttendanceHeatmapComponent) },
      {
        path: 'admin',
        canActivate: [roleGuard(['manager', 'hr', 'admin'])],
        children: [
          { path: '', loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent) },
          { path: 'dashboard', loadComponent: () => import('./pages/admin/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent) },
          { path: 'pending-users', loadComponent: () => import('./pages/admin/pending-users/pending-users.component').then(m => m.PendingUsersComponent) },
          { path: 'departments', loadComponent: () => import('./pages/admin/departments/departments.component').then(m => m.DepartmentsComponent) },
          { path: 'employees', loadComponent: () => import('./pages/admin/employees/employees.component').then(m => m.EmployeesComponent) },
          { path: 'holidays', loadComponent: () => import('./pages/admin/holidays/holidays.component').then(m => m.HolidaysComponent) },
          { path: 'leave-types', loadComponent: () => import('./pages/admin/leave-types-admin/leave-types-admin.component').then(m => m.LeaveTypesAdminComponent) },
          { path: 'work-schedule', loadComponent: () => import('./pages/admin/work-schedule/work-schedule.component').then(m => m.WorkScheduleComponent) },
          { path: 'attendance-penalty-config', loadComponent: () => import('./pages/admin/attendance-penalty-config/attendance-penalty-config.component').then(m => m.AttendancePenaltyConfigComponent) },
          { path: 'tax-config', loadComponent: () => import('./pages/admin/tax-config/tax-config.component').then(m => m.TaxConfigComponent) },
          { path: 'leave-balances', loadComponent: () => import('./pages/admin/leave-balances/leave-balances.component').then(m => m.LeaveBalancesComponent) },
          { path: 'payrolls', loadComponent: () => import('./pages/admin/payroll-admin/payroll-admin.component').then(m => m.PayrollAdminComponent) },
          { path: 'salary-grades', loadComponent: () => import('./pages/admin/salary-grades/salary-grades.component').then(m => m.SalaryGradesComponent) },
          { path: 'payroll-config', loadComponent: () => import('./pages/admin/payroll-config/payroll-config.component').then(m => m.PayrollConfigComponent) },
          { path: 'reports/attendance', loadComponent: () => import('./pages/admin/reports/attendance-report.component').then(m => m.AttendanceReportComponent) },
          { path: 'reports/attendance-heatmap', loadComponent: () => import('./pages/admin/reports/attendance-heatmap-admin.component').then(m => m.AttendanceHeatmapAdminComponent) },
          { path: 'reports/leave', loadComponent: () => import('./pages/admin/reports/leave-report.component').then(m => m.LeaveReportComponent) },
          { path: 'attendances-admin', loadComponent: () => import('./pages/admin/attendances-admin/attendances-admin.component').then(m => m.AttendancesAdminComponent) },
          { path: 'leave-requests-admin', loadComponent: () => import('./pages/admin/leave-requests-admin/leave-requests-admin.component').then(m => m.LeaveRequestsAdminComponent) },
          { path: 'companies', loadComponent: () => import('./pages/admin/companies/companies.component').then(m => m.CompaniesComponent) },
          { path: 'theme', loadComponent: () => import('./pages/admin/theme-admin/theme-admin.component').then(m => m.ThemeAdminComponent) },
          { path: 'audit-logs', loadComponent: () => import('./pages/admin/audit-logs/audit-logs.component').then(m => m.AuditLogsComponent) },
        ],
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
