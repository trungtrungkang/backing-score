# E2E Workflows: 25. Authentication Pages (Login/SignUp)

Để vận hành hệ thống danh tính dựa trên nền tảng Better Auth & CSDL Turso (D1), dự án có các trang giao diện mặt tiền (Frontend Pages) dành cho việc xác thực người dùng.

> [!NOTE] 
> **Tình trạng hiện tại của nhóm tính năng Auth (Basic)** 
> Đây là phiên bản UI cốt lõi khởi đầu (MVP). Giao diện hiện tập trung vào tính tương tác ổn định để đảm bảo Core Flow thay vì đầu tư nhiều vào hiệu ứng UI/UX lộng lẫy. Trong tương lai gần, hệ thống sẽ cần hoàn thiện thêm các luồng như Quên mật khẩu (Forgot Password), OTP Code, và nâng cấp hình ảnh thương hiệu nghệ thuật hơn.

## 1. Kiến trúc Routing
- **`/login`**: Trang đăng nhập. Cung cấp nút đăng nhập Google OAuth và đăng nhập bằng Email/Password truyền thống.
- **`/signup`**: Trang đăng ký. Nhập Email, Name và Password.
- **`/verify`**: Landing page bắt lại quá trình Click Link từ Email để kích hoạt tài khoản (`user.emailVerification = true`).

## 2. Giao thức tương tác (Context Integration)
Các trang UI này hoàn toàn không gọi API Fetch thuần thủ công. Chúng là các dumb-components được bơm sức mạnh thông qua Hook `useAuth()` (lấy từ thẻ bao ngoài `<AuthProvider>` ở `src/contexts/AuthContext.tsx`).
- Gọi `login(email, password)`
- Gọi `loginWithOAuth("google")`
- Lắng nghe state `error` ném ra từ Context để hiển thị thẻ đỏ `Alert` ngay dưới Form.

## 3. Quá trình Chuyển hướng an toàn (Redirection)
1. **Sau khi Submit Form**: `useAuth` bắn dữ liệu lên máy chủ Node qua thư viện `better-auth`.
2. Hứng Response trả về JWT / Session Cookie.
3. Component `page.tsx` chặn lệnh await, gọi `router.push("/dashboard")` để lôi cổ người dùng vào Khu vực làm việc Kín (Protected Area).
4. **Vòng lặp chống xâm nhập**: Nếu User đang ở trạng thái CÓ Session, nhưng vì lý do gì đó ấn nút Back trình duyệt về `/login`. Thẻ Component sẽ tự bật Next.js Redirect đá ngược họ trở lại `/dashboard`.

## Lộ trình Nâng cấp trong tương lai (Roadmap)
- [ ] Bổ sung trang **`/forgot-password`** và flow thiết lập lại Password.
- [ ] Bổ sung hiệu ứng Background Parallax hoặc video Slider nghệ thuật vào khu vực trống hai bên sườn form ảo (Splitting View).
- [ ] Đẩy nhanh tiến trình Login bằng Magic Link (Gửi gửi gửi link chui tọt vào thẳng App không cần nhớ pass).
