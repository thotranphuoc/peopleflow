-- PeopleFlow — Thêm cột ý nghĩa (description) cho leave_types, rút gọn tên hiển thị
-- Chạy sau 29-leave-types.sql

ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS description TEXT;

UPDATE leave_types SET display_name = 'Phép năm', description = 'Phép năm - trừ số ngày phép năm' WHERE code = 'annual_leave';
UPDATE leave_types SET display_name = 'Việc riêng có lương', description = 'Nghỉ việc riêng có hưởng lương (Hiếu, Hỉ, Tang...)' WHERE code = 'personal_paid';
UPDATE leave_types SET display_name = 'Ốm đau (BHXH)', description = 'Nghỉ ốm đau có giấy BHXH' WHERE code = 'sick_bhxh';
UPDATE leave_types SET display_name = 'Ốm (không BHXH)', description = 'Nghỉ bệnh không có giấy BHXH' WHERE code = 'sick_no_bhxh';
UPDATE leave_types SET display_name = 'Thai sản / Khám thai', description = 'Nghỉ thai sản hoặc khám thai' WHERE code = 'maternity';
UPDATE leave_types SET display_name = 'Con ốm (dưới 7 tuổi)', description = 'Nghỉ chăm con ốm dưới 7 tuổi' WHERE code = 'child_sick';
UPDATE leave_types SET display_name = 'Không hưởng lương', description = 'Nghỉ không hưởng lương' WHERE code = 'unpaid';
UPDATE leave_types SET display_name = 'Giải trình đi trễ', description = 'Giải trình đi trễ hoặc về sớm' WHERE code = 'late_explanation';
UPDATE leave_types SET display_name = 'Đăng ký OT', description = 'Đăng ký làm thêm giờ' WHERE code = 'ot';
UPDATE leave_types SET display_name = 'Làm ngoài văn phòng', description = 'Giải trình làm việc ngoài khu vực văn phòng' WHERE code = 'off_site_work';
