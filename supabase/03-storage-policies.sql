-- ============================================================
-- PeopleFlow — RLS policies cho Storage (check-in-photos)
-- Chạy SAU 02-schema-extras.sql (bucket đã tồn tại)
-- ============================================================

DROP POLICY IF EXISTS "Authenticated read check-in-photos" ON storage.objects;
CREATE POLICY "Authenticated read check-in-photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'check-in-photos');

DROP POLICY IF EXISTS "Authenticated upload check-in-photos" ON storage.objects;
CREATE POLICY "Authenticated upload check-in-photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'check-in-photos');

DROP POLICY IF EXISTS "Authenticated update check-in-photos" ON storage.objects;
CREATE POLICY "Authenticated update check-in-photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'check-in-photos')
WITH CHECK (bucket_id = 'check-in-photos');
