-- PeopleFlow — Seed ngày lễ Việt Nam (cố định + năm 2026)
-- Chạy sau 10-holidays.sql. Bảng holidays phải đã tồn tại. Có thể chạy nhiều lần (chỉ thêm khi chưa có).

-- Ngày lễ cố định dương lịch (lặp hàng năm) — lưu với năm 2000
INSERT INTO holidays (date, name, is_recurring)
SELECT v.date::date, v.name, v.is_recurring
FROM (VALUES
  ('2000-01-01', 'Tết Dương lịch', true),
  ('2000-04-30', 'Giải phóng miền Nam (30/4)', true),
  ('2000-05-01', 'Quốc tế Lao động (1/5)', true),
  ('2000-09-02', 'Quốc khánh (2/9)', true)
) AS v(date, name, is_recurring)
WHERE NOT EXISTS (
  SELECT 1 FROM holidays h WHERE h.date = v.date::date AND h.name = v.name
);

-- Ngày lễ năm 2026 (thay đổi hàng năm — không lặp)
-- Tết Nguyên đán 2026: nghỉ 5 ngày 16–20/2 (mùng 1 Tết là 17/2)
INSERT INTO holidays (date, name, is_recurring)
SELECT v.date::date, v.name, v.is_recurring
FROM (VALUES
  ('2026-02-16', 'Tết Nguyên đán 2026', false),
  ('2026-02-17', 'Tết Nguyên đán 2026 (Mùng 1)', false),
  ('2026-02-18', 'Tết Nguyên đán 2026', false),
  ('2026-02-19', 'Tết Nguyên đán 2026', false),
  ('2026-02-20', 'Tết Nguyên đán 2026', false),
  ('2026-04-26', 'Giỗ Tổ Hùng Vương 2026', false)
) AS v(date, name, is_recurring)
WHERE NOT EXISTS (
  SELECT 1 FROM holidays h WHERE h.date = v.date::date AND h.name = v.name
);
