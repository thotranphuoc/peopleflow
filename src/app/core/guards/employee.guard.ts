import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { EmployeeService } from '../services/employee.service';

/** Đã đăng nhập nhưng chưa có bản ghi employees → chuyển sang /pending. */
export const employeeGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const employeeService = inject(EmployeeService);
  const router = inject(Router);
  const user = auth.user();
  if (!user) return true;
  await employeeService.loadCurrentEmployee(user.id);
  if (!employeeService.currentEmployee()) {
    return router.parseUrl('/pending');
  }
  return true;
};
