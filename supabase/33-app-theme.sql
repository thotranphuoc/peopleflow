-- Màu chủ đạo theo ngày trong tuần (0=CN, 1=T2, ..., 6=T7)
-- Gợi ý 7 màu 2026: Teal, Royal blue, Violet, Emerald, Amber, Sky blue, Fuchsia
CREATE TABLE IF NOT EXISTS app_theme (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  color_0 VARCHAR(7) NOT NULL DEFAULT '#0d9488',
  color_1 VARCHAR(7) NOT NULL DEFAULT '#2563eb',
  color_2 VARCHAR(7) NOT NULL DEFAULT '#7c3aed',
  color_3 VARCHAR(7) NOT NULL DEFAULT '#059669',
  color_4 VARCHAR(7) NOT NULL DEFAULT '#ea580c',
  color_5 VARCHAR(7) NOT NULL DEFAULT '#0284c7',
  color_6 VARCHAR(7) NOT NULL DEFAULT '#c026d3',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_theme (color_0, color_1, color_2, color_3, color_4, color_5, color_6)
SELECT '#0d9488', '#2563eb', '#7c3aed', '#059669', '#ea580c', '#0284c7', '#c026d3'
WHERE NOT EXISTS (SELECT 1 FROM app_theme LIMIT 1);

COMMENT ON TABLE app_theme IS 'Màu theme theo ngày: 0=Chủ nhật, 1=Thứ 2, ..., 6=Thứ 7';

-- Cập nhật palette 2026 cho bản ghi đã có
UPDATE app_theme SET
  color_0 = '#0d9488', color_1 = '#2563eb', color_2 = '#7c3aed',
  color_3 = '#059669', color_4 = '#ea580c', color_5 = '#0284c7', color_6 = '#c026d3',
  updated_at = NOW();
