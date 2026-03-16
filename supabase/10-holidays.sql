-- PeopleFlow — Ngày lễ (public holidays)
-- Chạy khi đã có schema chính. Bảng không phụ thuộc employees/departments.

DROP TABLE IF EXISTS holidays CASCADE;

CREATE TABLE holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    name TEXT NOT NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_holidays_date ON holidays(date);
CREATE INDEX idx_holidays_recurring ON holidays(is_recurring) WHERE is_recurring = true;
