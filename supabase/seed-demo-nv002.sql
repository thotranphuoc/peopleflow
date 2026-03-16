-- ============================================================
-- PeopleFlow — Giả lập data đầy đủ cho NV002 (Vibe Code)
-- Chạy trong Supabase SQL Editor (sau khi đã có schema + user này trong employees).
-- Employee: 10447138-9627-4a70-be4e-bb98aeca6acd | Manager: b943bca3-9523-466d-bda4-7e73e14465e4
-- ============================================================

SET client_min_messages TO WARNING;

DO $$
DECLARE
  v_emp_id UUID := '10447138-9627-4a70-be4e-bb98aeca6acd';
  v_mgr_id UUID := 'b943bca3-9523-466d-bda4-7e73e14465e4';
  v_work_date DATE;
  v_days INT;
BEGIN
  -- 1. Quỹ phép năm 2025, 2026 (5760 phút = 12 ngày; đã dùng 1 ngày 2025, 0 2026)
  INSERT INTO leave_balances (employee_id, year, total_minutes, used_minutes)
  VALUES
    (v_emp_id, 2025, 5760, 480),
    (v_emp_id, 2026, 5760, 0)
  ON CONFLICT (employee_id, year) DO UPDATE SET
    total_minutes = EXCLUDED.total_minutes,
    used_minutes = EXCLUDED.used_minutes;

  -- 2. Chấm công: 2 tuần gần nhất (trước 2026-03-06) — tháng 2 và đầu tháng 3/2026 (trừ Tết 16–20/2)
  FOR v_days IN 0..19 LOOP
    v_work_date := DATE '2026-02-02' + (v_days || ' days')::INTERVAL;
    -- Bỏ qua Tết 16–20/2 và cuối tuần (6=Sat, 0=Sun trong extract dow: 6,0)
    IF v_work_date NOT BETWEEN '2026-02-16' AND '2026-02-20'
       AND EXTRACT(DOW FROM v_work_date) NOT IN (0, 6) THEN
      INSERT INTO attendances (employee_id, work_date, check_in_time, check_out_time, is_valid_location, status)
      VALUES (
        v_emp_id,
        v_work_date,
        (v_work_date + TIME '08:00')::TIMESTAMPTZ,
        (v_work_date + TIME '17:30')::TIMESTAMPTZ,
        true, 'valid'
      )
      ON CONFLICT (employee_id, work_date) DO UPDATE SET
        check_in_time = EXCLUDED.check_in_time,
        check_out_time = EXCLUDED.check_out_time,
        is_valid_location = true,
        status = 'valid';
    END IF;
  END LOOP;
  -- Thêm vài ngày đầu tháng 3
  INSERT INTO attendances (employee_id, work_date, check_in_time, check_out_time, is_valid_location, status)
  VALUES
    (v_emp_id, '2026-03-02', '2026-03-02 08:00:00+07', '2026-03-02 17:30:00+07', true, 'valid'),
    (v_emp_id, '2026-03-03', '2026-03-03 08:00:00+07', '2026-03-03 17:30:00+07', true, 'valid'),
    (v_emp_id, '2026-03-04', '2026-03-04 08:00:00+07', '2026-03-04 17:30:00+07', true, 'valid'),
    (v_emp_id, '2026-03-05', '2026-03-05 08:00:00+07', '2026-03-05 17:30:00+07', true, 'valid')
  ON CONFLICT (employee_id, work_date) DO UPDATE SET
    check_in_time = EXCLUDED.check_in_time,
    check_out_time = EXCLUDED.check_out_time,
    status = 'valid';

END $$;

-- 3. Đơn từ: 1 đơn phép năm đã duyệt (1 ngày), 1 đơn việc riêng chờ duyệt (chạy 1 lần; chạy lại sẽ thêm trùng)
INSERT INTO leave_requests (employee_id, manager_id, request_type, leave_type, deduct_annual_leave, start_time, end_time, total_minutes_requested, reason, status, manager_note)
VALUES
  (
    '10447138-9627-4a70-be4e-bb98aeca6acd',
    'b943bca3-9523-466d-bda4-7e73e14465e4',
    'leave_full',
    'annual_leave',
    false,
    '2025-12-20 08:00:00+07',
    '2025-12-20 17:00:00+07',
    480,
    'Nghỉ việc riêng',
    'approved',
    NULL
  ),
  (
    '10447138-9627-4a70-be4e-bb98aeca6acd',
    'b943bca3-9523-466d-bda4-7e73e14465e4',
    'leave_half',
    'personal_paid',
    false,
    '2026-03-15 08:00:00+07',
    '2026-03-15 12:00:00+07',
    240,
    'Khám bệnh',
    'pending',
    NULL
  );

-- 4. Báo vắng: 1 bản ghi (đi công tác)
INSERT INTO absence_reports (reporter_id, manager_id, reason, location, start_time, end_time, contact_phone, note)
VALUES (
  '10447138-9627-4a70-be4e-bb98aeca6acd',
  'b943bca3-9523-466d-bda4-7e73e14465e4',
  'Gặp đối tác tại VP khách hàng',
  'VP Nam Việt Media, Q.1',
  '2026-02-25 08:00:00+07',
  '2026-02-25 17:00:00+07',
  '0912345679',
  'Có check-in tại địa điểm.'
);

-- 5. Cấu hình lương (P1, P2, P3) — effective từ 2025-01-01 (chèn 1 lần nếu chưa có)
INSERT INTO payroll_configs (employee_id, p1_salary, p2_salary, p3_salary, dependents_count, insurance_rate, effective_date)
SELECT '10447138-9627-4a70-be4e-bb98aeca6acd', 18000000, 3600000, 2000000, 0, 10.5, '2025-01-01'
WHERE NOT EXISTS (SELECT 1 FROM payroll_configs WHERE employee_id = '10447138-9627-4a70-be4e-bb98aeca6acd' AND effective_date = '2025-01-01');

-- 6. Phiếu lương: tháng 1, 2, 3/2026 (gross ~ 23.6M, trừ BH 10.5%, thuế, phạt 0 → net mẫu)
-- gross = p1 + p2 + p3; insurance 10.5%; tax đơn giản; penalty 0
INSERT INTO payrolls (employee_id, month, year, p1_amount, p2_amount, p3_amount, penalty_amount, gross_salary, insurance_amount, tax_amount, net_salary, status)
VALUES
  ('10447138-9627-4a70-be4e-bb98aeca6acd', 1, 2026, 18000000, 3600000, 2000000, 0, 23600000, 2478000, 0, 21122000, 'published'),
  ('10447138-9627-4a70-be4e-bb98aeca6acd', 2, 2026, 18000000, 3600000, 2000000, 0, 23600000, 2478000, 0, 21122000, 'published'),
  ('10447138-9627-4a70-be4e-bb98aeca6acd', 3, 2026, 18000000, 3600000, 2000000, 0, 23600000, 2478000, 0, 21122000, 'draft')
ON CONFLICT (employee_id, month, year) DO UPDATE SET
  p1_amount = EXCLUDED.p1_amount,
  p2_amount = EXCLUDED.p2_amount,
  p3_amount = EXCLUDED.p3_amount,
  penalty_amount = EXCLUDED.penalty_amount,
  gross_salary = EXCLUDED.gross_salary,
  insurance_amount = EXCLUDED.insurance_amount,
  tax_amount = EXCLUDED.tax_amount,
  net_salary = EXCLUDED.net_salary,
  status = EXCLUDED.status;
