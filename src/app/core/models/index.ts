// Models theo schema Supabase PRD

export interface Department {
  id: string;
  code: string;
  name: string;
  created_at: string;
}

/** Bảng companies — mỗi nhân viên gán 1 công ty (company_id). */
export interface Company {
  id: string;
  company_name: string;
  short_name: string | null;
  logo_url: string | null;
  address: string | null;
  tax_code: string | null;
  phone: string | null;
  email: string | null;
  /** Vĩ độ văn phòng (check-in). Null = dùng env. */
  check_in_lat?: number | null;
  /** Kinh độ văn phòng. */
  check_in_lng?: number | null;
  /** Bán kính (m) cho phép check-in. */
  check_in_radius_meters?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  employee_id: string;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export type ContractType = 'indefinite' | 'fixed';
export type EmploymentType = 'official' | 'probation' | 'contractor' | 'intern';
export type EmployeeStatus = 'active' | 'left' | 'suspended';

export interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  phone: string | null;
  company_id: string | null;
  department_id: string | null;
  manager_id: string | null;
  role: 'employee' | 'manager' | 'hr' | 'admin';
  avatar_url: string | null;
  date_of_birth: string | null;
  id_number: string | null;
  id_issue_place: string | null;
  id_issue_date: string | null;
  address: string | null;
  bank_account: string | null;
  bank_name: string | null;
  start_date: string | null;
  tax_code: string | null;
  social_insurance_number: string | null;
  email: string | null;
  contract_type: ContractType | null;
  contract_end_date: string | null;
  employment_type: EmploymentType | null;
  dependents_count: number;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  gender: string | null;
  job_title: string | null;
  resignation_date: string | null;
  status: EmployeeStatus | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeDependent {
  id: string;
  employee_id: string;
  full_name: string;
  relationship: string;
  birth_year: number | null;
  id_number: string | null;
  note: string | null;
  created_at: string;
}

export interface SalaryGrade {
  id: string;
  name: string;
  p1_salary: number;
  p2_salary: number;
  p3_salary: number;
  created_at: string;
}

export interface Attendance {
  id: string;
  employee_id: string;
  work_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_photo_url: string | null;
  check_in_lat_lng: string | null;
  is_valid_location: boolean;
  status: 'valid' | 'pending' | 'violation';
  supplement_reason?: string | null;
  approval_note?: string | null;
  created_at: string;
}

/** Loại nghỉ / đơn: phép năm, việc riêng, ốm BHXH, ốm không BHXH, thai sản, con ốm, không lương, giải trình, OT, làm ngoài. */
export type LeaveType =
  | 'annual_leave'
  | 'personal_paid'
  | 'sick_bhxh'
  | 'sick_no_bhxh'
  | 'maternity'
  | 'child_sick'
  | 'unpaid'
  | 'late_explanation'
  | 'ot'
  | 'off_site_work';

/** Duration cho đơn nghỉ theo ngày: nguyên ngày / nửa ngày / theo giờ. */
export type LeaveDuration = 'leave_full' | 'leave_half' | 'leave_hours';

export interface LeaveRequest {
  id: string;
  employee_id: string;
  manager_id: string | null;
  request_type: LeaveDuration | 'late_explanation' | 'ot' | 'off_site_work';
  leave_type: LeaveType;
  deduct_annual_leave: boolean;
  start_time: string;
  end_time: string;
  total_minutes_requested: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  manager_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface AbsenceReport {
  id: string;
  reporter_id: string;
  manager_id: string | null;
  reason: string;
  location: string | null;
  start_time: string;
  end_time: string;
  contact_phone: string | null;
  note: string | null;
  created_at: string;
}

export interface AbsenceReportMember {
  id: string;
  absence_report_id: string;
  employee_id: string;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  is_recurring: boolean;
  created_at: string;
}

/** Cấu hình loại nghỉ phép (admin config). */
export interface LeaveTypeConfig {
  id: string;
  code: string;
  display_name: string;
  description: string | null;
  has_duration: boolean;
  deduct_annual_leave: boolean;
  sort_order: number;
  is_active: boolean;
  is_form_visible: boolean;
  created_at: string;
  updated_at: string;
}

/** Lịch làm việc: 5/7, 6/7, 5.5/7. Dùng tính tổng ngày làm trong tháng. */
export interface WorkSchedule {
  id: string;
  code: string;
  name: string;
  working_days_per_week: number;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  saturday_half_only: boolean;
  sunday: boolean;
  is_default: boolean;
  created_at: string;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  year: number;
  total_minutes: number;
  extra_minutes: number;
  used_minutes: number;
  created_at: string;
}

/** Bậc thuế TNCN lũy tiến (amount_from/amount_to: VND). */
export interface TaxBracket {
  id: string;
  sort_order: number;
  amount_from: number;
  amount_to: number | null;
  rate_percent: number;
  created_at: string;
}

/** Giảm trừ thuế (code: self | dependent). */
export interface TaxDeduction {
  id: string;
  code: string;
  name: string;
  amount_monthly: number;
  created_at: string;
}

export interface PayrollConfig {
  id: string;
  employee_id: string;
  salary_grade_id: string | null;
  p1_salary: number;
  p2_salary: number;
  p3_salary: number;
  dependents_count: number;
  insurance_rate: number;
  effective_date: string;
  created_at: string;
}

export interface Payroll {
  id: string;
  employee_id: string;
  month: number;
  year: number;
  p1_amount: number;
  p2_amount: number;
  p3_amount: number;
  penalty_amount: number;
  gross_salary: number;
  insurance_amount: number;
  tax_amount: number;
  net_salary: number;
  status: 'draft' | 'published';
  created_at: string;
}

/** Cấu hình giờ làm (1 bản ghi). */
export interface AttendanceConfig {
  id: string;
  work_start_time: string;
  work_end_time: string;
  lunch_start_time: string;
  lunch_end_time: string;
  /** Số phút làm bắt buộc mỗi ngày (vd 480 = 8h). Thiếu thì áp dụng bậc phạt thiếu giờ. */
  required_work_minutes_per_day: number;
  created_at: string;
  updated_at: string;
}

/** Bậc phạt thiếu giờ: thiếu >= threshold_minutes → penalty_amount, half_day_unpaid. */
export interface ShortfallPenaltyRule {
  id: string;
  threshold_minutes: number;
  penalty_amount: number;
  half_day_unpaid: boolean;
  sort_order: number;
  created_at: string;
}

/** Bậc phạt đi trễ (deprecated: chỉ dùng phạt thiếu giờ). */
export interface LatePenaltyRule {
  id: string;
  threshold_minutes: number;
  penalty_amount: number;
  half_day_unpaid: boolean;
  sort_order: number;
  created_at: string;
}

/** Ghi nhận phạt một ngày (1 row/employee/day). Phạt từ thiếu giờ (shortfall) hoặc cũ từ đi trễ. */
export interface AttendancePenalty {
  id: string;
  employee_id: string;
  work_date: string;
  attendance_id: string | null;
  late_minutes: number;
  /** Số phút thiếu so với required_work_minutes_per_day (phạt thiếu giờ). */
  shortfall_minutes: number | null;
  penalty_amount: number;
  half_day_unpaid: boolean;
  created_at: string;
}

export type AttendanceStatus = Attendance['status'];
export type LeaveRequestType = LeaveRequest['request_type'];
export type LeaveRequestStatus = LeaveRequest['status'];

/** Cấu hình hiển thị và quy tắc theo loại nghỉ (fallback khi chưa load DB) */
export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual_leave: 'Phép năm',
  personal_paid: 'Việc riêng có lương',
  sick_bhxh: 'Ốm đau (BHXH)',
  sick_no_bhxh: 'Ốm (không BHXH)',
  maternity: 'Thai sản / Khám thai',
  child_sick: 'Con ốm (dưới 7 tuổi)',
  unpaid: 'Không hưởng lương',
  late_explanation: 'Giải trình đi trễ',
  ot: 'Đăng ký OT',
  off_site_work: 'Làm ngoài văn phòng',
};

/** Loại nghỉ có chọn duration (nguyên/nửa ngày/theo giờ) */
export const LEAVE_TYPES_WITH_DURATION: LeaveType[] = [
  'annual_leave', 'personal_paid', 'sick_bhxh', 'sick_no_bhxh', 'maternity', 'child_sick', 'unpaid',
];

/** Loại nghỉ trừ phép năm: luôn (annual_leave) hoặc tùy chọn (sick_no_bhxh khi deduct_annual_leave) */
export function deductsAnnualLeave(leaveType: LeaveType, deductFlag: boolean): boolean {
  return leaveType === 'annual_leave' || (leaveType === 'sick_no_bhxh' && deductFlag);
}

export const DURATION_LABELS: Record<LeaveDuration, string> = {
  leave_full: 'Nghỉ nguyên ngày',
  leave_half: 'Nghỉ nửa ngày',
  leave_hours: 'Nghỉ theo giờ',
};

/** Nhãn cho request_type (duration + giải trình/OT/làm ngoài) */
export const REQUEST_TYPE_LABELS: Record<LeaveRequest['request_type'], string> = {
  leave_full: 'Nghỉ nguyên ngày',
  leave_half: 'Nghỉ nửa ngày',
  leave_hours: 'Nghỉ theo giờ',
  late_explanation: 'Giải trình đi trễ',
  ot: 'Đăng ký OT',
  off_site_work: 'Làm ngoài văn phòng',
};
