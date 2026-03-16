-- ============================================================
-- PeopleFlow — Xóa các bảng KHÔNG dùng (schema cũ)
-- Chạy trong Supabase SQL Editor.
-- Giữ lại: departments, employees, payroll_configs, leave_balances,
--          attendances, leave_requests, payrolls, audit_logs
-- ============================================================

DROP TABLE IF EXISTS evaluations CASCADE;
DROP TABLE IF EXISTS evaluation_periods CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS approval_settings CASCADE;
DROP TABLE IF EXISTS leaves CASCADE;
DROP TABLE IF EXISTS allowances CASCADE;
DROP TABLE IF EXISTS deductions CASCADE;
DROP TABLE IF EXISTS salary_grades CASCADE;
DROP TABLE IF EXISTS holidays CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS app_config CASCADE;
