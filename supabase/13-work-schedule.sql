-- PeopleFlow — Lịch làm việc (Cách B: bảng riêng)
-- Chạy khi đã có schema chính. Dùng tính tổng ngày làm trong tháng (trừ ngày lễ).

CREATE TABLE IF NOT EXISTS work_schedule (
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
CREATE INDEX IF NOT EXISTS idx_work_schedule_default ON work_schedule(is_default) WHERE is_default = true;

-- Migrate old codes to international (run once on existing DB)
UPDATE work_schedule SET code = 'mon_fri', name = 'Monday – Friday' WHERE code = '5/7';
UPDATE work_schedule SET code = 'mon_sat', name = 'Monday – Saturday' WHERE code = '6/7';
UPDATE work_schedule SET code = 'mon_sat_half', name = 'Mon–Fri + Sat AM' WHERE code = '5.5/7';

-- Seed: mon_fri, mon_sat, mon_sat_half (default: mon_fri)
INSERT INTO work_schedule (code, name, working_days_per_week, monday, tuesday, wednesday, thursday, friday, saturday, saturday_half_only, sunday, is_default)
VALUES
    ('mon_fri', 'Monday – Friday', 5, true, true, true, true, true, false, false, false, true),
    ('mon_sat', 'Monday – Saturday', 6, true, true, true, true, true, true, false, false, false),
    ('mon_sat_half', 'Mon–Fri + Sat AM', 5.5, true, true, true, true, true, true, true, false, false)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    working_days_per_week = EXCLUDED.working_days_per_week,
    monday = EXCLUDED.monday,
    tuesday = EXCLUDED.tuesday,
    wednesday = EXCLUDED.wednesday,
    thursday = EXCLUDED.thursday,
    friday = EXCLUDED.friday,
    saturday = EXCLUDED.saturday,
    saturday_half_only = EXCLUDED.saturday_half_only,
    sunday = EXCLUDED.sunday;
