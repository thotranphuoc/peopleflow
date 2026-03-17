-- Fix 400 Bad Request khi upload với upsert: true
-- Chạy trong Supabase SQL Editor nếu upload ảnh check-in/check-out bị lỗi 400

DROP POLICY IF EXISTS "Authenticated update check-in-photos" ON storage.objects;

CREATE POLICY "Authenticated update check-in-photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'check-in-photos')
WITH CHECK (bucket_id = 'check-in-photos');
