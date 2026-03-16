-- Tên viết tắt công ty (vd: MS, NV) — hiển thị gọn trong form/dropdown
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS short_name VARCHAR(20);
