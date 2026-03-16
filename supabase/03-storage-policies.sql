-- ============================================================
-- PeopleFlow — RLS policies cho Storage (check-in-photos)
-- Chạy SAU 02-schema-extras.sql (bucket đã tồn tại)
-- ============================================================

-- Cho phép user đã đăng nhập đọc file trong bucket
CREATE POLICY "Authenticated read check-in-photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'check-in-photos');

-- Cho phép user đã đăng nhập upload (ghi) file
CREATE POLICY "Authenticated upload check-in-photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'check-in-photos');

-- (Tùy chọn) Cho phép user cập nhật/xóa file của mình nếu cần
-- CREATE POLICY "Authenticated update check-in-photos"
-- ON storage.objects FOR UPDATE TO authenticated
-- USING (bucket_id = 'check-in-photos');
-- CREATE POLICY "Authenticated delete check-in-photos"
-- ON storage.objects FOR DELETE TO authenticated
-- USING (bucket_id = 'check-in-photos');
