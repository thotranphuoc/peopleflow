-- Xoá cột late_minutes và early_minutes khỏi bảng attendances
ALTER TABLE attendances
  DROP COLUMN IF EXISTS late_minutes,
  DROP COLUMN IF EXISTS early_minutes;
