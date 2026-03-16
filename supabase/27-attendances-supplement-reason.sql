-- Lý do bổ sung chấm công do nhân viên nhập (Manager xem khi duyệt)
ALTER TABLE attendances
  ADD COLUMN IF NOT EXISTS supplement_reason TEXT;
