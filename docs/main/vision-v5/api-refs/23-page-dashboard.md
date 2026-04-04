# E2E Workflows: 23. Dashboard & Workspace

Trang `/dashboard` đóng vai trò là xương sống kết nối toàn bộ luồng nghiệp vụ của người dùng sau khi đã đăng nhập (Post-login). Nó không chỉ là nơi chứa file, mà còn là trung tâm điều hướng đi các phân hệ ngách (Classroom, Wiki Editor, Analytics).

## 1. Cấu trúc Layout (`src/app/[locale]/dashboard/page.tsx`)

Trang Dashboard được chia làm 3 tầng thành phần chính:

### A. Sidebar Điều hướng (`<DashboardSidebar />`)
- Quản lý định tuyến trên Desktop và Menu đậy trên Mobile.
- Các tab chính:
  - **Drive (Dự án của tôi)**: Quản lý sheet nhạc và audio.
  - **Classrooms (Lớp học LMS)**: Trỏ về `/dashboard/classrooms`.
  - **Analytics (Thống kê)**: Danh cho Admin hoặc tài khoản Premium.
  - **Account/Settings**: Quản lý thông tin và thiết lập tài khoản.
- Responsive Logic: Nút gập menu (Hamburger index) ẩn/hiển thị `DashboardSidebar` theo State `mobileMenuOpen`.

### B. Gamification & Cảnh báo Bảo mật
- Nằm vị trí đầu tiên của Main Content Area.
- Cảnh báo xác thực Email (Email Verification Prompt): Nếu API BetterAuth trả về `user.emailVerification === false`, sẽ xuất hiện Alert màu xanh nhắc nhở `sendVerification()`.
- Component `<DailyChallengeCard />`: Neo hệ thống nhiệm vụ hàng ngày (Làm thế nào để cộng điểm EXP, xem cấp độ Rank).

### C. Khu vực Workspace & Grid (Stats)
- Component chứa các thẻ thống kê tổng quan (Ví dụ: Tổng số Dự án tạo ra, Bao nhiêu dự án đã Publish, Tương tác tổng).
- Cuối cùng là đóng gói thẻ `<DriveManager />` (Đã có tài liệu LLD chi tiết số 11) hiển thị cây thư mục File Tree quản trị tài sản (Assets).

## 2. Xử lý Logic URL Parameter (State Sync)
Một điểm đặc biệt trong kiến trúc của Dashboard:
- Nhận biến `?folder=XYZ` từ URL (`useSearchParams`).
- Khi người dùng click chọn thư mục con, component không đổi đường dẫn cứng mà Update biến Param URL. Giúp thao tác Back/Forward của trình duyệt (PopState) hoạt động mượt mà để nhảy lùi lại các thư mục cha mẹ.

## 3. Subscription Polling Callback (Webhook Kế toán)
Sau khi người dùng trả tiền thành công qua hệ thống LemonSqueezy, họ sẽ bị Redirect về trang này kèm theo cờ `?checkout=success`.
- `useEffect` lắng nghe cờ này, gọi ngầm 1 Request cấp tốc POST `/api/subscription/sync`.
- Update quyền Premium ngay lập tức dưới Local Browser (AuthContext `refreshSubscription`) để unlock thẻ `<DriveManager >` cho tải File nặng, mà không phải đợi Event Webhook mất vài phút xử lý ở Backend.

## E2E Testing Scenarios Đề Xuất
- [x] **Test chặn chưa xác thực Email**: Đăng nhập bằng Account C (email chưa xác nhận), Assert expect dải banner Xanh dương nhắc nhở phải hiện ra chặn đường.
- [x] **Test File Explorer Router**: Bấm click chui vào 2 tầng thư mục con, gõ phím Back mũi tên trên Browser. Cây thư mục `<DriveManager />` buộc phải tự render trồi lên tầng cha ăn theo đúng Param `?folder`.
- [x] **Test nâng cấp tài khoản cực nhanh (Fast Polling)**: Gắn URL `?checkout=success`. Bắt API Network tab. Đảm bảo API Sync được bắn đi 1 lần và Toast chúc mừng mọc lên.
