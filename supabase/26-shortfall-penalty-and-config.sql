-- Bỏ phạt đi trễ; chỉ phạt thiếu giờ. Cấu hình số phút làm/ngày + bậc phạt thiếu giờ.
-- Chạy sau 24-attendance-config-and-penalties.sql

-- 1. Cấu hình: thêm số phút làm bắt buộc mỗi ngày (vd 480 = 8h)
ALTER TABLE attendance_config
  ADD COLUMN IF NOT EXISTS required_work_minutes_per_day INT NOT NULL DEFAULT 480;
COMMENT ON COLUMN attendance_config.required_work_minutes_per_day IS 'Số phút làm tối thiểu mỗi ngày (vd 480 = 8h). Thiếu so với số này sẽ áp dụng bậc phạt thiếu giờ.';

-- 2. Bảng bậc phạt thiếu giờ (threshold = phút thiếu tối thiểu để áp dụng bậc này)
CREATE TABLE IF NOT EXISTS shortfall_penalty_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  threshold_minutes INT NOT NULL,
  penalty_amount DECIMAL(12, 0) NOT NULL DEFAULT 0,
  half_day_unpaid BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE shortfall_penalty_rules IS 'Bậc phạt khi làm thiếu giờ: thiếu >= threshold_minutes thì áp dụng penalty_amount và/hoặc half_day_unpaid.';

INSERT INTO shortfall_penalty_rules (threshold_minutes, penalty_amount, half_day_unpaid, sort_order)
SELECT 0,  0,      false, 0 WHERE NOT EXISTS (SELECT 1 FROM shortfall_penalty_rules WHERE threshold_minutes = 0);
INSERT INTO shortfall_penalty_rules (threshold_minutes, penalty_amount, half_day_unpaid, sort_order)
SELECT 10, 50000,  false, 1 WHERE NOT EXISTS (SELECT 1 FROM shortfall_penalty_rules WHERE threshold_minutes = 10);
INSERT INTO shortfall_penalty_rules (threshold_minutes, penalty_amount, half_day_unpaid, sort_order)
SELECT 20, 100000, false, 2 WHERE NOT EXISTS (SELECT 1 FROM shortfall_penalty_rules WHERE threshold_minutes = 20);
INSERT INTO shortfall_penalty_rules (threshold_minutes, penalty_amount, half_day_unpaid, sort_order)
SELECT 30, 200000, false, 3 WHERE NOT EXISTS (SELECT 1 FROM shortfall_penalty_rules WHERE threshold_minutes = 30);
INSERT INTO shortfall_penalty_rules (threshold_minutes, penalty_amount, half_day_unpaid, sort_order)
SELECT 60, 300000, false, 4 WHERE NOT EXISTS (SELECT 1 FROM shortfall_penalty_rules WHERE threshold_minutes = 60);
INSERT INTO shortfall_penalty_rules (threshold_minutes, penalty_amount, half_day_unpaid, sort_order)
SELECT 120, 0, true, 5 WHERE NOT EXISTS (SELECT 1 FROM shortfall_penalty_rules WHERE threshold_minutes = 120);

-- 3. Ghi nhận phạt theo ngày: thêm cột thiếu giờ (phạt đi trễ không dùng nữa nhưng giữ cột late_minutes)
ALTER TABLE attendance_penalties
  ADD COLUMN IF NOT EXISTS shortfall_minutes INT;
COMMENT ON COLUMN attendance_penalties.shortfall_minutes IS 'Số phút thiếu so với required_work_minutes_per_day. Dùng để áp dụng bậc phạt thiếu giờ.';
