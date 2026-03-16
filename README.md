# PeopleFlow

PWA quản lý nhân sự & lương 3P — Angular 21 (Standalone, Signals, OnPush) + Angular Material + Supabase.

## Cấu hình Supabase

1. Tạo project tại [Supabase](https://supabase.com), lấy **Project URL** và **anon public** key.
2. Sửa `src/environments/environment.ts` và `src/environments/environment.development.ts`:
   - `supabase.url`: URL project
   - `supabase.anonKey`: anon key
3. Chạy schema SQL trong PRD (bảng `departments`, `employees`, …) trong Supabase SQL Editor.
4. **Quên mật khẩu:** Trong Supabase Dashboard → Authentication → URL Configuration, thêm Redirect URL: `https://your-domain.com/reset-password` (và `http://localhost:4200/reset-password` cho dev).
5. **Ảnh chấm công:** Tạo Storage bucket `check-in-photos` (private), cấu hình RLS cho phép authenticated upload/read.
6. **Schema & Storage:** Chạy lần lượt các file trong `supabase/` theo thứ tự trong `supabase/SUPABASE_SETUP_NOTE.md` (01 → 02 → 03; 04 là seed mẫu tùy chọn).

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
