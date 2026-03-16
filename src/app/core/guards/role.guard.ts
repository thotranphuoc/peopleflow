import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { EmployeeService } from '../services/employee.service';

export function roleGuard(allowedRoles: ('employee' | 'manager' | 'hr' | 'admin')[]): CanActivateFn {
  return () => {
    const employeeService = inject(EmployeeService);
    const router = inject(Router);
    const emp = employeeService.currentEmployee();
    if (!emp) {
      void router.navigate(['/dashboard']);
      return false;
    }
    if (allowedRoles.includes(emp.role)) return true;
    void router.navigate(['/dashboard']);
    return false;
  };
}
