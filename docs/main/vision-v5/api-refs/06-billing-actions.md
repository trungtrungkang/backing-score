# API Reference: 06. Billing & Subscriptions Actions

## 1. Webhook Handlers (`src/app/api/webhooks/lemonsqueezy/route.ts`)

Đây là một API Route (không phải Server Action) vì máy chủ của LemonSqueezy sẽ POST trực tiếp thẳng vào endpoint này.

### POST `route.ts`
- **Inputs**: HTTP Body (Raw Text buffer), Headers từ Lemon.
- **Outputs**: HTTP 200 OK (Thành công), HTTP 400 (Lỗi chữ ký/Signature Invalid), HTTP 500 (Lỗi xử lý Data).
- **Business Logic**:
  1. Parse Secret Key trong thư mục biến môi trường `.env.local` (`LEMON_SQUEEZY_WEBHOOK_SECRET`). Bắt buộc.
  2. Băm mã hóa (HMAC SHA-256) cái raw text Buffer gửi đến và dùng phép so sánh String Timing-safe với Header `X-Signature`.
  3. Lấy `meta.custom_data.user_id` để biết khách hàng nào vừa mua hàng.
  4. Trích xuất kiểu Event Name:
     - Nhánh `subscription_created`: Lưu `status = 'active'`, `planIdentifier = variant_name`.
     - Nhánh `subscription_updated`: Lưu lại `status` mới, cập nhật Next Billing Date (`renewsAt`).
     - Nhánh `subscription_expired` / `subscription_payment_failed`: Chỉnh `status = 'past_due' / 'expired'`.
  5. Upsert bản ghi vào bảng `subscriptions` (hoặc Soft Update bằng `update` nếu đã có).
- **Unit Test Scenarios**:
  - Môi trường Mock cho Route.ts khó vì nó là API truyền thống, không phải hàm trong. Cần test riêng file Helper Logic (Nếu được rã (Extract) code khối POST handler ra thành một hàm riêng `processLemonWebhook(payload, signature, secret)`).
  - [x] Test Fake Signature: Phải ném `throw Error` chứ không bao giờ lọt qua được bước (2).
  - [x] Webhook chứa ID người lạ (User không tồn tại trên hệ thống) -> Ghi log Warning nhưng vẫn trả HTTP 200 cho Lemon (Tại sao 200? - Để Lemon không Retry/Bắn SPAM liên ngân hàng).

## 2. Server Validation (`src/app/actions/v5/subscriptions.ts`)

### `checkPremiumAccess`
- **Inputs**: Lấy thẳng Session từ Browser (Header Cookie).
- **Outputs**: `boolean`.
- **Business Logic**: Gọi bảng `subscriptions` bằng Session UserID, kiểm tra `status === 'active' || status === 'on_trial'` và `renewsAt > Date.now()` (Nếu cần).
- **Unit Test Scenarios**:
  - [x] User đang sử dụng thẻ bị báo hủy qua đêm -> status chuyển `past_due` -> `checkPremiumAccess` lập tức trả về False, khóa tính năng tải File nâng cao ngay lập tức.
