-- Vị trí Check-in theo công ty (mỗi công ty có vị trí văn phòng riêng)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS check_in_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS check_in_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS check_in_radius_meters INT DEFAULT 50;

COMMENT ON COLUMN companies.check_in_lat IS 'Vĩ độ văn phòng (check-in). Null = dùng giá trị mặc định từ env.';
COMMENT ON COLUMN companies.check_in_lng IS 'Kinh độ văn phòng.';
COMMENT ON COLUMN companies.check_in_radius_meters IS 'Bán kính (m) cho phép check-in. Mặc định 50.';
