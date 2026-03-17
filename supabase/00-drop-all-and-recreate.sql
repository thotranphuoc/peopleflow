-- ============================================================
-- PeopleFlow — XÓA HẾT VÀ TẠO LẠI TỪ ĐẦU
-- Chạy 1 file này trong Supabase SQL Editor là đủ.
-- Cảnh báo: Mọi dữ liệu trong các bảng dưới sẽ mất.
-- ============================================================

-- ----- PHẦN 1: XÓA (đúng thứ tự, tránh lỗi khóa ngoại) -----

-- Storage: Supabase không cho DELETE trực tiếp bảng storage.
-- Chỉ xóa policy (để tạo lại ở dưới). Bucket và file cũ giữ nguyên;
-- nếu muốn xóa sạch bucket/file thì vào Dashboard > Storage > check-in-photos > xóa thủ công.
DROP POLICY IF EXISTS "Authenticated read check-in-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload check-in-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update check-in-photos" ON storage.objects;

-- Bảng app (bảng con trước, bảng cha sau)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS absence_report_members CASCADE;
DROP TABLE IF EXISTS absence_reports CASCADE;
DROP TABLE IF EXISTS payrolls CASCADE;
DROP TABLE IF EXISTS leave_requests CASCADE;
DROP TABLE IF EXISTS leave_types CASCADE;
DROP TABLE IF EXISTS attendance_penalties CASCADE;
DROP TABLE IF EXISTS attendances CASCADE;
DROP TABLE IF EXISTS late_penalty_rules CASCADE;
DROP TABLE IF EXISTS attendance_config CASCADE;
DROP TABLE IF EXISTS leave_balances CASCADE;
DROP TABLE IF EXISTS payroll_configs CASCADE;
DROP TABLE IF EXISTS salary_grades CASCADE;
DROP TABLE IF EXISTS employee_dependents CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS tax_brackets CASCADE;
DROP TABLE IF EXISTS tax_deductions CASCADE;
DROP TABLE IF EXISTS work_schedule CASCADE;
DROP TABLE IF EXISTS holidays CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

-- ----- PHẦN 2: TẠO LẠI TOÀN BỘ -----

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. CÔNG TY (nhiều bản ghi; mỗi nhân viên gán 1 công ty)
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL DEFAULT 'Công ty',
    short_name VARCHAR(20),
    logo_url TEXT,
    address TEXT,
    tax_code VARCHAR(50),
    phone VARCHAR(50),
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO companies (company_name) VALUES ('Công ty');

-- 1. PHÒNG BAN
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1b. NGÀY LỄ (Admin/HR cập nhật; is_recurring = lặp cố định hàng năm như 1/1, 30/4)
CREATE TABLE holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    name TEXT NOT NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_holidays_date ON holidays(date);
CREATE INDEX idx_holidays_recurring ON holidays(is_recurring) WHERE is_recurring = true;

-- 1c. LỊCH LÀM VIỆC (số ngày/tuần: 5/7, 6/7, 5.5/7; dùng tính tổng ngày làm trong tháng)
CREATE TABLE work_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    working_days_per_week DECIMAL(3,1) NOT NULL,
    monday BOOLEAN NOT NULL DEFAULT true,
    tuesday BOOLEAN NOT NULL DEFAULT true,
    wednesday BOOLEAN NOT NULL DEFAULT true,
    thursday BOOLEAN NOT NULL DEFAULT true,
    friday BOOLEAN NOT NULL DEFAULT true,
    saturday BOOLEAN NOT NULL DEFAULT false,
    saturday_half_only BOOLEAN NOT NULL DEFAULT false,
    sunday BOOLEAN NOT NULL DEFAULT false,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_work_schedule_default ON work_schedule(is_default) WHERE is_default = true;

-- 1d. CẤU HÌNH THUẾ TNCN (bậc thuế + giảm trừ; Admin chỉnh trên UI)
CREATE TABLE tax_brackets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sort_order INT NOT NULL,
    amount_from DECIMAL(15, 0) NOT NULL,
    amount_to DECIMAL(15, 0),
    rate_percent DECIMAL(5, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE tax_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    amount_monthly DECIMAL(15, 0) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO tax_deductions (code, name, amount_monthly) VALUES ('self', 'Giảm trừ bản thân', 11000000), ('dependent', 'Giảm trừ người phụ thuộc', 4400000);
INSERT INTO tax_brackets (sort_order, amount_from, amount_to, rate_percent) VALUES
(1, 0, 5000000, 5), (2, 5000000, 10000000, 10), (3, 10000000, 18000000, 15),
(4, 18000000, 32000000, 20), (5, 32000000, 52000000, 25), (6, 52000000, 80000000, 30), (7, 80000000, NULL, 35);

-- 2. NHÂN VIÊN (id = auth.users.id) — single source of truth cho Payroll và các module khác
CREATE TABLE employees (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    role VARCHAR(50) DEFAULT 'employee',
    avatar_url TEXT,
    date_of_birth DATE,
    id_number VARCHAR(50),
    id_issue_place VARCHAR(255),
    id_issue_date DATE,
    address TEXT,
    bank_account VARCHAR(50),
    bank_name VARCHAR(100),
    start_date DATE,
    tax_code VARCHAR(20),
    social_insurance_number VARCHAR(50),
    email VARCHAR(255),
    contract_type VARCHAR(20) DEFAULT 'indefinite',
    contract_end_date DATE,
    employment_type VARCHAR(30) DEFAULT 'official',
    dependents_count INT DEFAULT 0,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    gender VARCHAR(10),
    job_title VARCHAR(100),
    resignation_date DATE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2a. NGƯỜI PHỤ THUỘC (thuộc hồ sơ nhân viên)
CREATE TABLE employee_dependents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    relationship VARCHAR(50) NOT NULL,
    birth_year INT,
    id_number VARCHAR(50),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_employee_dependents_employee ON employee_dependents(employee_id);

-- 2a2. THÔNG BÁO TRONG APP
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_employee ON notifications(employee_id);
CREATE INDEX idx_notifications_employee_read ON notifications(employee_id, read_at);

-- 2b. MỨC LƯƠNG (bậc lương P1, P2, P3 — HR định nghĩa, gắn với cấu hình lương)
CREATE TABLE salary_grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    p1_salary DECIMAL(15, 2) NOT NULL DEFAULT 0,
    p2_salary DECIMAL(15, 2) NOT NULL DEFAULT 0,
    p3_salary DECIMAL(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. HỢP ĐỒNG & LƯƠNG CƠ BẢN
CREATE TABLE payroll_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    salary_grade_id UUID REFERENCES salary_grades(id) ON DELETE SET NULL,
    p1_salary DECIMAL(15, 2) NOT NULL DEFAULT 0,
    p2_salary DECIMAL(15, 2) NOT NULL DEFAULT 0,
    p3_salary DECIMAL(15, 2) NOT NULL DEFAULT 0,
    dependents_count INT DEFAULT 0,
    insurance_rate DECIMAL(5, 2) DEFAULT 10.5,
    effective_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. QUỸ PHÉP NĂM
CREATE TABLE leave_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    year INT NOT NULL,
    total_minutes INT NOT NULL DEFAULT 5760,
    used_minutes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, year)
);

-- 5. CHẤM CÔNG
CREATE TABLE attendances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    check_in_photo_url TEXT,
    check_out_photo_url TEXT,
    check_in_lat_lng VARCHAR(100),
    is_valid_location BOOLEAN DEFAULT TRUE,
    status VARCHAR(50) DEFAULT 'pending',
    approval_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, work_date)
);

-- 5b. CẤU HÌNH CHẤM CÔNG + PHẠT ĐI TRỄ
CREATE TABLE attendance_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_start_time TIME NOT NULL DEFAULT '08:00',
    work_end_time TIME NOT NULL DEFAULT '17:30',
    lunch_start_time TIME NOT NULL DEFAULT '12:00',
    lunch_end_time TIME NOT NULL DEFAULT '13:30',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO attendance_config (work_start_time, work_end_time, lunch_start_time, lunch_end_time)
VALUES ('08:00', '17:30', '12:00', '13:30');

CREATE TABLE late_penalty_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threshold_minutes INT NOT NULL,
    penalty_amount DECIMAL(12, 0) NOT NULL DEFAULT 0,
    half_day_unpaid BOOLEAN NOT NULL DEFAULT false,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_late_penalty_rules_threshold ON late_penalty_rules(threshold_minutes);
INSERT INTO late_penalty_rules (threshold_minutes, penalty_amount, half_day_unpaid, sort_order)
VALUES (10, 50000, false, 1), (30, 100000, false, 2), (60, 200000, false, 3), (120, 0, true, 4);

CREATE TABLE attendance_penalties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    attendance_id UUID REFERENCES attendances(id) ON DELETE SET NULL,
    late_minutes INT NOT NULL DEFAULT 0,
    penalty_amount DECIMAL(12, 0) NOT NULL DEFAULT 0,
    half_day_unpaid BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, work_date)
);
CREATE INDEX idx_attendance_penalties_employee_date ON attendance_penalties(employee_id, work_date);

-- 6. ĐƠN TỪ / GIẢI TRÌNH
CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    request_type VARCHAR(50) NOT NULL,
    leave_type VARCHAR(50) NOT NULL DEFAULT 'annual_leave',
    deduct_annual_leave BOOLEAN NOT NULL DEFAULT false,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    total_minutes_requested INT NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    manager_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6a. CẤU HÌNH LOẠI NGHỈ PHÉP
CREATE TABLE leave_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  has_duration BOOLEAN NOT NULL DEFAULT true,
  deduct_annual_leave BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_form_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO leave_types (code, display_name, description, has_duration, deduct_annual_leave, sort_order, is_form_visible)
VALUES
  ('annual_leave', 'Phép năm', 'Phép năm - trừ số ngày phép năm', true, true, 1, true),
  ('personal_paid', 'Việc riêng có lương', 'Nghỉ việc riêng có hưởng lương (Hiếu, Hỉ, Tang...)', true, false, 2, true),
  ('sick_bhxh', 'Ốm đau (BHXH)', 'Nghỉ ốm đau có giấy BHXH', true, false, 3, true),
  ('sick_no_bhxh', 'Ốm (không BHXH)', 'Nghỉ bệnh không có giấy BHXH', true, false, 4, true),
  ('maternity', 'Thai sản / Khám thai', 'Nghỉ thai sản hoặc khám thai', true, false, 5, true),
  ('child_sick', 'Con ốm (dưới 7 tuổi)', 'Nghỉ chăm con ốm dưới 7 tuổi', true, false, 6, true),
  ('unpaid', 'Không hưởng lương', 'Nghỉ không hưởng lương', true, false, 7, true),
  ('late_explanation', 'Giải trình đi trễ', 'Giải trình đi trễ hoặc về sớm', false, false, 8, false),
  ('ot', 'Đăng ký OT', 'Đăng ký làm thêm giờ', false, false, 9, false),
  ('off_site_work', 'Làm ngoài văn phòng', 'Giải trình làm việc ngoài khu vực văn phòng', false, false, 10, false);

-- 6b. BÁO VẮNG (thông báo ra ngoài, không duyệt)
CREATE TABLE absence_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    location TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    contact_phone TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE absence_report_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    absence_report_id UUID NOT NULL REFERENCES absence_reports(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(absence_report_id, employee_id)
);
CREATE INDEX idx_absence_reports_reporter ON absence_reports(reporter_id);
CREATE INDEX idx_absence_reports_manager ON absence_reports(manager_id);
CREATE INDEX idx_absence_reports_start_time ON absence_reports(start_time);
CREATE INDEX idx_absence_report_members_report ON absence_report_members(absence_report_id);

-- 7. LƯƠNG THÁNG
CREATE TABLE payrolls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    month INT NOT NULL,
    year INT NOT NULL,
    p1_amount DECIMAL(15, 2) DEFAULT 0,
    p2_amount DECIMAL(15, 2) DEFAULT 0,
    p3_amount DECIMAL(15, 2) DEFAULT 0,
    penalty_amount DECIMAL(15, 2) DEFAULT 0,
    gross_salary DECIMAL(15, 2) DEFAULT 0,
    insurance_amount DECIMAL(15, 2) DEFAULT 0,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    net_salary DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, month, year)
);

-- 8. AUDIT LOG
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    action VARCHAR(50) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    action_by UUID REFERENCES auth.users(id),
    action_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_action_at ON audit_logs(action_at);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated insert audit_logs"
ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow manager hr admin read audit_logs"
ON audit_logs FOR SELECT TO authenticated
USING (auth.uid() IN (SELECT id FROM employees WHERE role IN ('manager', 'hr', 'admin')));

-- 9. BUCKET + POLICIES (Storage)
INSERT INTO storage.buckets (id, name, public)
VALUES ('check-in-photos', 'check-in-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated read check-in-photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'check-in-photos');

CREATE POLICY "Authenticated upload check-in-photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'check-in-photos');

CREATE POLICY "Authenticated update check-in-photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'check-in-photos')
WITH CHECK (bucket_id = 'check-in-photos');

-- ============================================================
-- Xong. Tiếp theo: tạo user trong Authentication, rồi insert
-- vào departments và employees (xem 04-seed-example.sql).
-- ============================================================
