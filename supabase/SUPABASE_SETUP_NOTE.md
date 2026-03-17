# Supabase setup — PeopleFlow

## Cách 1: Xóa hết và tạo lại từ đầu (khuyến nghị khi đã có bảng cũ)

Chỉ cần chạy **một file** trong Supabase SQL Editor:

**`00-drop-all-and-recreate.sql`**

- Xóa toàn bộ: storage policies, bucket `check-in-photos`, các bảng audit_logs, payrolls, leave_requests, attendances, leave_balances, payroll_configs, employees, departments.
- Tạo lại toàn bộ 7 bảng + audit_logs + bucket + RLS cho storage.

**Cảnh báo:** Mọi dữ liệu trong các bảng trên sẽ mất. Sau khi chạy xong, tạo user trong Authentication rồi insert vào `departments` và `employees` (xem `04-seed-example.sql`).

**Nếu tạo user bị lỗi "Database error creating new user":** Thường do trigger trên `auth.users` (vd. chèn vào bảng `profiles` đã xóa). Chạy `06-fix-auth-user-creation.sql` để gỡ trigger/function đó, rồi tạo user lại.

---

## Cách 2: Chạy từng file (khi chưa có bảng nào)

| # | File | Mục đích |
|---|------|----------|
| 1 | `01-schema-prd.sql` | Tạo 7 bảng chính |
| 2 | `02-schema-extras.sql` | audit_logs + bucket |
| 3 | `03-storage-policies.sql` | RLS cho bucket |
| 4 | `04-seed-example.sql` | (Tùy chọn) Dữ liệu mẫu — sửa YOUR_* rồi chạy |

**Lưu ý:** Bảng `employees` tham chiếu `auth.users(id)`. Tạo user trong **Authentication → Users** trước, sau đó mới insert vào `employees`. Cột `manager_id` = UUID của sếp trực tiếp (1 dòng trong `employees`).

---

## Cho phép user đăng ký, admin gán vai trò sau

- Chạy **`08-pending-users-and-trigger.sql`**: tạo bảng `pending_users` và trigger khi user mới đăng ký (ghi vào `pending_users`).
- Trong app: user dùng **Đăng ký** (link trên trang đăng nhập) → sau đăng ký chuyển sang **Chờ duyệt**.
- Admin: **Quản trị** → **Người chờ gán vai trò** → với từng người bấm **Thêm vào nhân sự**, điền Mã NV, Họ tên, Vai trò, Phòng ban, Quản lý trực tiếp (nếu là nhân viên). Sau khi thêm, user đó đăng nhập lại sẽ vào được app.

---

## Làm gì tiếp sau khi database ổn

1. **Tạo user + dữ liệu mẫu**
   - Supabase → **Authentication → Users** → Add user (email + password).
   - Copy **UID** của user vừa tạo.
   - SQL Editor: chạy phần phòng ban trong `04-seed-example.sql`, lấy `id` của department.
   - Insert vào `employees`: `id` = UID vừa copy, `employee_code` (vd: NV001), `full_name`, `role` (employee / manager / hr / admin). Nếu là nhân viên có sếp thì điền `manager_id` = UID của sếp.
   - (Tùy chọn) Insert `leave_balances` cho năm hiện tại.

2. **Chạy app và test**
   - Trong project: `npm start`, mở `http://localhost:4200`.
   - Đăng nhập bằng user vừa tạo → vào Dashboard, thử Chấm công, Đơn từ, Cá nhân / Phiếu lương. Nếu role HR/Admin thì thử menu Quản trị.

3. **Sau khi chạy ổn**
   - Cấu hình **Redirect URL** (Forgot password): Authentication → URL Configuration → thêm `http://localhost:4200/reset-password` (và URL production khi deploy).
   - Khi lên production: bật RLS và thêm policy cho các bảng app (xem mục "Gợi ý thiết kế" bên dưới).

---

## Xóa ảnh check-in cũ (60 ngày)

Ảnh chấm công chỉ lưu **60 ngày** để tiết kiệm storage. Cần deploy Edge Function và cấu hình cron:

1. **Deploy Edge Function:**
   ```bash
   cd people-flow && supabase functions deploy cleanup-old-checkin-photos
   ```

2. **Cấu hình cron:** Xem `36-cron-cleanup-old-photos.sql` (pg_cron) hoặc dùng [cron-job.org](https://cron-job.org) gọi URL mỗi ngày:
   ```
   POST https://YOUR_PROJECT.supabase.co/functions/v1/cleanup-old-checkin-photos
   ```

---

## Gợi ý thiết kế database (không bắt buộc)

Dưới đây là các gợi ý có thể cân nhắc thêm sau khi schema chính đã chạy ổn định.

### 1. Index cho truy vấn thường dùng

- **attendances:** tra cứu theo `employee_id` + `work_date` đã có UNIQUE nên đã có index. Có thể thêm index theo tháng nếu hay filter theo khoảng ngày:
  - `CREATE INDEX idx_attendances_employee_date ON attendances(employee_id, work_date);` (đã được cover bởi UNIQUE).
- **leave_requests:** manager xem đơn chờ duyệt theo `manager_id` + `status`:
  - `CREATE INDEX idx_leave_requests_manager_status ON leave_requests(manager_id, status) WHERE status = 'pending';`
- **payrolls:** tra cứu phiếu lương theo nhân viên + tháng/năm:
  - UNIQUE(employee_id, month, year) đã đủ; có thể thêm `CREATE INDEX idx_payrolls_employee ON payrolls(employee_id);` nếu hay list theo nhân viên.

### 2. RLS (Row Level Security) cho bảng ứng dụng

Hiện tại chỉ audit_logs và storage có RLS. Nếu muốn bảo vệ dữ liệu ở tầng DB:

- **employees:** user chỉ đọc được bản ghi của mình (và HR/admin đọc tất cả).
- **attendances:** user chỉ đọc/ghi bản ghi của mình; manager/HR có thể đọc theo phòng.
- **leave_requests:** user tạo đơn và đọc đơn của mình; manager đọc đơn có `manager_id = auth.uid()`.
- **payrolls:** user chỉ đọc payroll của mình (và chỉ khi status = 'published' nếu muốn).

Triển khai RLS cần viết policy cho từng bảng (SELECT/INSERT/UPDATE/DELETE) theo role lấy từ `employees.role` (có thể dùng function `get_my_role()` hoặc join với bảng employees).

### 3. Tự điền manager_id khi tạo đơn

App hiện gửi `manager_id` từ `employees.manager_id` của nhân viên. Có thể đồng bộ ở DB bằng trigger: khi INSERT vào `leave_requests`, nếu `manager_id` NULL thì set từ `employees.manager_id` của `employee_id` tương ứng. Đảm bảo đơn luôn gắn đúng người duyệt dù client quên gửi.

### 4. Cột updated_at tự cập nhật

Bảng `employees`, `leave_requests` có `updated_at` nhưng không tự cập nhật khi UPDATE. Có thể thêm trigger:

- `BEFORE UPDATE ON employees` và `leave_requests`: `NEW.updated_at = NOW();`

### 5. Ràng buộc request_type

Có thể dùng CHECK để giới hạn giá trị:

- `leave_requests.request_type` IN ('leave_full','leave_half','leave_hours','late_explanation','ot').
- `attendances.status` IN ('valid','pending','violation').
- `employees.role` IN ('employee','manager','hr','admin').

### 6. Bảng cấu hình ca làm (shift_settings)

PRD có “ca làm (08:00–17:00), grace 5 phút”. Hiện cấu hình nằm ở app/env. Nếu muốn linh hoạt theo phòng/chi nhánh, có thể thêm bảng ví dụ: `shift_settings (id, department_id, start_time, end_time, break_minutes, grace_minutes)` và đổi động cơ tính công sang đọc từ bảng này.

---

Các mục trên là gợi ý; bạn có thể áp dụng từng phần tùy nhu cầu (performance, bảo mật, nhất quán dữ liệu).
