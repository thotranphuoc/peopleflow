-- Bổ sung phép đặc biệt: phép 5 năm, 10 năm, chuyển năm trước...
ALTER TABLE leave_balances
ADD COLUMN IF NOT EXISTS extra_minutes INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN leave_balances.extra_minutes IS 'Phép bổ sung (phút): phép 5 năm, 10 năm, chuyển năm trước. Tổng hiệu lực = total_minutes + extra_minutes';
