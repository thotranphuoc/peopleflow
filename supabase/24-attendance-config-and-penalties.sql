-- Cấu hình giờ làm (trưa 12:00-13:30), bậc phạt đi trễ, bảng ghi phạt từng ngày
CREATE TABLE IF NOT EXISTS attendance_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_start_time TIME NOT NULL DEFAULT '08:00',
  work_end_time TIME NOT NULL DEFAULT '17:30',
  lunch_start_time TIME NOT NULL DEFAULT '12:00',
  lunch_end_time TIME NOT NULL DEFAULT '13:30',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO attendance_config (work_start_time, work_end_time, lunch_start_time, lunch_end_time)
SELECT '08:00'::TIME, '17:30'::TIME, '12:00'::TIME, '13:30'::TIME
WHERE NOT EXISTS (SELECT 1 FROM attendance_config LIMIT 1);

CREATE TABLE IF NOT EXISTS late_penalty_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  threshold_minutes INT NOT NULL,
  penalty_amount DECIMAL(12, 0) NOT NULL DEFAULT 0,
  half_day_unpaid BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO late_penalty_rules (threshold_minutes, penalty_amount, half_day_unpaid, sort_order)
SELECT 10, 50000, false, 1 WHERE NOT EXISTS (SELECT 1 FROM late_penalty_rules WHERE threshold_minutes = 10);
INSERT INTO late_penalty_rules (threshold_minutes, penalty_amount, half_day_unpaid, sort_order)
SELECT 30, 100000, false, 2 WHERE NOT EXISTS (SELECT 1 FROM late_penalty_rules WHERE threshold_minutes = 30);
INSERT INTO late_penalty_rules (threshold_minutes, penalty_amount, half_day_unpaid, sort_order)
SELECT 60, 200000, false, 3 WHERE NOT EXISTS (SELECT 1 FROM late_penalty_rules WHERE threshold_minutes = 60);
INSERT INTO late_penalty_rules (threshold_minutes, penalty_amount, half_day_unpaid, sort_order)
SELECT 120, 0, true, 4 WHERE NOT EXISTS (SELECT 1 FROM late_penalty_rules WHERE threshold_minutes = 120);

CREATE TABLE IF NOT EXISTS attendance_penalties (
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
CREATE INDEX IF NOT EXISTS idx_attendance_penalties_employee_date ON attendance_penalties(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_penalties_work_date ON attendance_penalties(work_date);
