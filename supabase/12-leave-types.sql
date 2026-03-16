-- PeopleFlow — Thêm loại nghỉ phép (leave_type, deduct_annual_leave)
-- Chạy khi đã có bảng leave_requests. Migration cho DB cũ.

ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS leave_type VARCHAR(50) NOT NULL DEFAULT 'annual_leave',
  ADD COLUMN IF NOT EXISTS deduct_annual_leave BOOLEAN NOT NULL DEFAULT false;

-- Backfill: leave_type = annual_leave cho nghỉ phép; = request_type cho giải trình/OT/làm ngoài
UPDATE leave_requests
SET leave_type = CASE
  WHEN request_type IN ('leave_full', 'leave_half', 'leave_hours') THEN 'annual_leave'
  ELSE request_type
END;
