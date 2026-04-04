# Frontend API Reference: 13. Providers, Contexts & Layouts

Hệ thống Component gốc bao bọc vỏ ngoài của toàn ứng dụng, cấu hình Next.js Layout.

## 1. Hệ thống thẻ Provider Root (`src/app/[locale]/layout.tsx`)

### `<ThemeProvider>` (Dark Mode)
- **Path**: `src/components/ThemeProvider.tsx` (Bọc Next-themes).
- **Description**: Định tuyến trạng thái thuộc tính HTML `class="dark"`. Component `<ThemeToggle>` chuyển phễu thuộc tính để tailwindcss dark-mode ăn biến màu sắc.
- **RTL Scenarios**: [x] Render Button cấu hình, Fake click Event, kiểm tra tài liệu document root có gắn CSS class `.dark` vào thẻ `<html>`/`<body>` hay không.

### `<LanguageSwitcher>` (Next-Intl)
- **Description**: Tương tác với Locale routing (`/[locale]/...`). Component Select hiển thị "Tiếng Việt / English".
- **RTL Scenarios**: 
  - [x] Chọn ngôn ngữ từ thẻ Select Box, Next.js Router Router thay đổi biến `pathname` kèm mã lang code `/en` hoặc `/vi`.

## 2. Global State (`src/contexts/AuthContext.tsx`)

### Quản lý phiên Session Auth
Khác với Server, ở Client ta dùng SWR Client Auth hoặc thẻ Hook truyền thống của `Better-Auth`.
- **Hooks**: `useSession` (từ `lib/auth/better-auth-client.ts`).
- **Description**: Nó sẽ fetch liên tục API Endpoint của BetterAuth để xem token Access JWT còn sống hay không.
- **RTL Scenarios**:
  - [x] Mock hàm trả về giá trị `session = null` -> Phải Render Components trang rỗng hoặc Redirect Login Page gắt gao (Dựa đoán Header/Router push).
  - [x] Nếu fetch đang loading (`isPending = true`), Render Loading Spinner Skeleton Layout chứ không chạy quá trình check null dẫn tới văng Redirect oan. Dòng này fix chống lỗi Flash of Unauthenticated Content (FOUC).
