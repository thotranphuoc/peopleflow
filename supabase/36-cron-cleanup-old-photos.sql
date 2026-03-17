-- ============================================================
-- Xóa ảnh check-in/check-out cũ hơn 60 ngày (chạy mỗi ngày lúc 3h sáng)
-- ============================================================
-- Bước 1: Deploy Edge Function
--   cd people-flow && supabase functions deploy cleanup-old-checkin-photos
--
-- Bước 2: Bật extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Bước 3: Lưu secrets (thay YOUR_PROJECT_REF và YOUR_ANON_KEY)
-- SELECT vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
-- SELECT vault.create_secret('YOUR_ANON_KEY', 'anon_key');

-- Bước 4: Tạo cron job (chạy SAU khi đã create_secret)
-- SELECT cron.schedule(
--   'cleanup-old-checkin-photos',
--   '0 3 * * *',
--   $$
--   SELECT net.http_post(
--     url:= (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/cleanup-old-checkin-photos',
--     headers:= jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
--     ),
--     body:= '{}'::jsonb
--   ) AS request_id;
--   $$
-- );

-- Cách khác: Dùng cron-job.org hoặc GitHub Actions gọi URL:
-- POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-old-checkin-photos
-- Header: Authorization: Bearer YOUR_ANON_KEY
