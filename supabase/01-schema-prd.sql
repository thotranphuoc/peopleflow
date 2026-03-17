-- ============================================================
-- PeopleFlow — Schema chính (theo PEOPLEFLOW.PRD)
-- Chạy file này TRƯỚC trong Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BẢNG PHÒNG BAN (Departments)
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BẢNG NHÂN VIÊN (Employees - Mở rộng từ Supabase Auth)
-- id = auth.users(id). Mỗi user đăng nhập cần 1 dòng ở đây.
-- manager_id = sếp trực tiếp (người duyệt đơn).
CREATE TABLE employees (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    role VARCHAR(50) DEFAULT 'employee',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. HỢP ĐỒNG & LƯƠNG CƠ BẢN (Payroll_Configs)
CREATE TABLE payroll_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    p1_salary DECIMAL(15, 2) NOT NULL DEFAULT 0,
    p2_salary DECIMAL(15, 2) NOT NULL DEFAULT 0,
    dependents_count INT DEFAULT 0,
    insurance_rate DECIMAL(5, 2) DEFAULT 10.5,
    effective_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. QUỸ PHÉP NĂM (Leave_Balances) — đơn vị: phút
CREATE TABLE leave_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    year INT NOT NULL,
    total_minutes INT NOT NULL DEFAULT 5760,
    used_minutes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, year)
);

-- 5. CHẤM CÔNG (Attendances)
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, work_date)
);

-- 6. ĐƠN TỪ / GIẢI TRÌNH (Leave_Requests)
-- request_type: leave_full, leave_half, leave_hours, late_explanation, ot
CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    request_type VARCHAR(50) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    total_minutes_requested INT NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    manager_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. LƯƠNG THÁNG (Payrolls)
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
