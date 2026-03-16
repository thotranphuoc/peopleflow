-- Cho phép app ghi và đọc audit_logs (đã bật RLS nhưng chưa có policy thì mặc định chặn hết).
-- INSERT: user đăng nhập được ghi log (app ghi thay mặt user).
-- SELECT: chỉ manager, hr, admin được xem (theo bảng employees).
DROP POLICY IF EXISTS "Allow authenticated insert audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Allow manager hr admin read audit_logs" ON audit_logs;

CREATE POLICY "Allow authenticated insert audit_logs"
ON audit_logs FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow manager hr admin read audit_logs"
ON audit_logs FOR SELECT TO authenticated
USING (
  auth.uid() IN (SELECT id FROM employees WHERE role IN ('manager', 'hr', 'admin'))
);
