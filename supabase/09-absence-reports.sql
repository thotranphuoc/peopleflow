-- PeopleFlow — Báo vắng (absence reports)
-- Chạy sau 00-drop-all-and-recreate.sql hoặc khi đã có bảng employees.
-- Nếu dùng 00-drop-all-and-recreate.sql thì các bảng này đã được gộp vào đó.

-- Bảng con trước (để có thể chạy độc lập: chỉ cần employees)
DROP TABLE IF EXISTS absence_report_members CASCADE;
DROP TABLE IF EXISTS absence_reports CASCADE;

CREATE TABLE absence_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    location TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    contact_phone TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE absence_report_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    absence_report_id UUID NOT NULL REFERENCES absence_reports(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(absence_report_id, employee_id)
);

CREATE INDEX idx_absence_reports_reporter ON absence_reports(reporter_id);
CREATE INDEX idx_absence_reports_manager ON absence_reports(manager_id);
CREATE INDEX idx_absence_reports_start_time ON absence_reports(start_time);
CREATE INDEX idx_absence_report_members_report ON absence_report_members(absence_report_id);
