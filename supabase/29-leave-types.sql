-- PeopleFlow — Cấu hình loại nghỉ phép (admin có thể thêm/sửa/xóa)
-- Chạy khi đã có schema chính. Bảng độc lập, leave_requests.leave_type tham chiếu code.

CREATE TABLE IF NOT EXISTS leave_types (
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

CREATE INDEX IF NOT EXISTS idx_leave_types_active ON leave_types(is_active) WHERE is_active = true;

-- Seed dữ liệu mặc định (bỏ qua nếu code đã tồn tại)
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
  ('off_site_work', 'Làm ngoài văn phòng', 'Giải trình làm việc ngoài khu vực văn phòng', false, false, 10, false)
ON CONFLICT (code) DO NOTHING;
