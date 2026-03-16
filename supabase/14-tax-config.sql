-- PeopleFlow — Cấu hình thuế TNCN (bậc thuế + giảm trừ)
-- Admin chỉnh bậc thuế và mức giảm trừ trên giao diện, không cần sửa code.

CREATE TABLE IF NOT EXISTS tax_brackets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sort_order INT NOT NULL,
    amount_from DECIMAL(15, 0) NOT NULL,
    amount_to DECIMAL(15, 0),
    rate_percent DECIMAL(5, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tax_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    amount_monthly DECIMAL(15, 0) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed giảm trừ (VN: bản thân 11tr/tháng, người phụ thuộc 4,4tr/tháng)
INSERT INTO tax_deductions (code, name, amount_monthly)
VALUES
    ('self', 'Giảm trừ bản thân', 11000000),
    ('dependent', 'Giảm trừ người phụ thuộc', 4400000)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    amount_monthly = EXCLUDED.amount_monthly;

-- Seed bậc thuế lũy tiến (VN 2020+: đến 5tr 5%, 5-10 10%, 10-18 15%, 18-32 20%, 32-52 25%, 52-80 30%, >80 35%)
-- Chỉ seed khi bảng rỗng
INSERT INTO tax_brackets (sort_order, amount_from, amount_to, rate_percent)
SELECT v.sort_order, v.amount_from, v.amount_to, v.rate_percent
FROM (VALUES
    (1, 0, 5000000, 5),
    (2, 5000000, 10000000, 10),
    (3, 10000000, 18000000, 15),
    (4, 18000000, 32000000, 20),
    (5, 32000000, 52000000, 25),
    (6, 52000000, 80000000, 30),
    (7, 80000000, NULL, 35)
) AS v(sort_order, amount_from, amount_to, rate_percent)
WHERE NOT EXISTS (SELECT 1 FROM tax_brackets LIMIT 1);
