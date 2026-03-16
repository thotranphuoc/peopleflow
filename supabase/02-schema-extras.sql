-- ============================================================
-- PeopleFlow — Bổ sung schema (audit_logs, bucket)
-- Chạy SAU 01-schema-prd.sql
-- ============================================================

-- Audit log chung
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name VARCHAR(100) NOT NULL,
  record_id UUID,
  action VARCHAR(50) NOT NULL,
  old_value JSONB,
  new_value JSONB,
  action_by UUID REFERENCES auth.users(id),
  action_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_at ON audit_logs(action_at);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Bucket ảnh check-in (Storage)
INSERT INTO storage.buckets (id, name, public)
VALUES ('check-in-photos', 'check-in-photos', false)
ON CONFLICT (id) DO NOTHING;
