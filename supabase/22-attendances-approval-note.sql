-- Lý do được duyệt cho từng bản ghi chấm công (Quản trị xem trong báo cáo theo ngày)
ALTER TABLE attendances
  ADD COLUMN IF NOT EXISTS approval_note TEXT;
