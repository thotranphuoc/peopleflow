-- Thêm cột ảnh check-out (hiển thị như check-in)
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS check_out_photo_url TEXT;
