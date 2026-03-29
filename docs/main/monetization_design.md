# Monetization & Marketplace — Tài Liệu Thiết Kế Phân Hệ Thanh Toán

**Phiên bản:** 1.0  
**Cập nhật:** 2026-03-29  

Tài liệu này mô tả chi tiết kiến trúc của phân hệ Thanh Toán (Monetization) trên nền tảng Backing & Score. Thiết kế này tuân thủ nguyên tắc "Unified Product Layer" (Lớp Sản phẩm thống nhất) được đề xuất trong bản đánh giá hệ thống ngày 26/03/2026.

---

## 1. Tổng Quan Kiến Trúc Thanh Toán

Hệ thống thanh toán của Backing & Score sử dụng **Lemon Squeezy** làm Merchant of Record (MoR) để giải quyết toàn bộ bài toán pháp lý, hỗ trợ hoàn tiền và đóng thuế quốc tế.

Hệ thống hỗ trợ 2 mô hình kinh doanh song song:
1. **Platform Subscriptions**: Gói trả phí định kỳ cho người dùng để nâng cấp đặc quyền.
2. **One-Time Purchases (Đơn Mua Lẻ)**: Bán đứt nội dung số (Khóa học, PDF, Project, Lịch học Live).

---

## 2. Thiết Kế "Product Layer" (Lớp Sản Phẩm Thống Nhất)

Để tránh việc phải viết code thanh toán riêng rẽ cho từng loại content (Khóa học, PDF, Booking...), hệ thống sử dụng một lớp **Product Abstraction Layer**. Mọi nội dung muốn bán ra tiền đều phải được "đóng gói" thành 1 Product.

### 2.1 Sơ Đồ Thực Thể Hệ Sinh Thái Mua Bán

```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   Lemon Squeezy │       │ Appwrite DB     │       │ Nội Dung Thực   │
│   (Sàn TMĐT)    │       │ (Lớp Sản Phẩm)  │       │ (Content)       │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ Store           │       │ products        │       │ courses         │
│                 │   1:1 │                 │  1:1  │                 │
│ Variant         │◄──────┤ variantId       │       │                 │
│                 │       │ targetType      ├──────►│ sheet_music     │
│                 │       │ targetId        │       │                 │
│                 │       │                 │       │ classrooms      │
└────────┬────────┘       └────────┬────────┘       └─────────────────┘
         │                         │
         │ (Webhook)               │
┌────────▼────────┐       ┌────────▼────────┐
│ order_created   │──────►│ purchases       │  (Lịch sử giao dịch)
└─────────────────┘       └────────┬────────┘
                                   │ (Tự động cấp quyền)
                          ┌────────▼────────┐
                          │ entitlements    │  (Quyền Sở Hữu)
                          └─────────────────┘
```

### 2.2 Collections Chính

| Collection | Mục đích | Fields Quan Trọng |
|---|---|---|
| `products` | Cửa sổ trưng bày. Mọi thứ được phép bán đều nằm ở đây. | `creatorId`, `targetType` (course/pdf/booking), `targetId`, `priceCents`, `lemonSqueezyVariantId`, `status`. |
| `purchases` | Lưu lại thông tin biên lai khi có khách mua hàng. | `orderId`, `userId`, `productId`, `amountCents`, `currency`, `createdAt`. |
| `entitlements` | Quyền truy cập nội dung. Là nơi duy nhất quyết định User có được xem nội dung bị khóa hay không. | `userId`, `targetType`, `targetId`, `grantedAt`, `sourceProductId`. |

---

## 3. Luồng Giao Dịch Đơn Mua Lẻ (One-Time Purchase Flow)

### Bước 1: Khởi tạo dữ liệu (Product Creation)
1. Thầy Lộc tạo một bản PDF `targetId: PDF_123` trong bảng `sheet_music`.
2. Hệ thống gọi API Lemon Squeezy để tạo 1 Variant giá $5. Lấy được `variantId: VAR_999`.
3. Hệ thống ghi vào bảng `products`: `{ targetType: "pdf", targetId: "PDF_123", variantId: "VAR_999" }`.

### Bước 2: Người dùng Cà Thẻ (Checkout)
1. Học sinh bấm nút **Mua $5**.
2. Client gọi API `/api/checkout` của NextJs tích kèm `productId`.
3. Server tạo một Checkout URL từ Lemon Squeezy, gài `custom_data: { userId: "HS_01", productId: "PROD_XXX" }` vào giỏ hàng.

### Bước 3: Webhook Fulfillment (Cấp quyền)
1. Trong lúc học sinh vẫn đang xem màn hình "Thank you", Lemon Squeezy bắn tín hiệu `order_created` về `/api/webhooks/lemonsqueezy`.
2. Server trích xuất `custom_data.userId` và `custom_data.productId`.
3. Server query `products` để biết món này là `pdf` mang mã `PDF_123`.
4. Server lưu lịch sử giao dịch vào bảng `purchases`.
5. Server lưu quyền truy cập vào bảng `entitlements`: `{ userId: "HS_01", targetType: "pdf", targetId: "PDF_123" }`.

### Bước 4: Mở Thuận Tiện Trải Nghiệm (Access Check)
1. Khi học sinh vào trang `/dashboard/pdfs/PDF_123`.
2. Hệ thống kiểm tra: Học sinh này có sở hữu `PDF_123` trong bảng `entitlements` không?
3. Trả kết quả `true` -> Cho phép tải file không dính Watermark.

---

## 4. Multi-Vendor Marketplace (Chia tiền tự động)

Hệ thống tận dụng cơ chế **Affiliate (Tiếp thị liên kết)** của Lemon Squeezy để lách luật thu tiền, tránh việc người sáng lập phải đăng ký pháp nhân phức tạp (như Stripe Connect).

**Cách hoạt động của Affiliate Hack:**
1. Mỗi khi Giáo viên đăng ký bán Khóa Học, họ sẽ được đăng ký làm Affiliate cho Nền Tảng.
2. Nền tảng cấu hình: Giáo viên sẽ hưởng 80% Affiliate Commission.
3. Khi khách mua khóa học của Giáo viên A (Giá $20), thuật toán Checkout tự động gài mã Affiliate của Giáo Viên A vào hóa đơn.
4. Lemon Squeezy thu thuế VAT (VD: $2). Dư $18. 
5. Lemon Squeezy làm công tác kế toán tự động: Chuyển thẳng $14.4 (80% hoa hồng) vào tài khoản Lemon Squeezy của giáo viên. Nền Tảng được giữ $3.6.
6. Kết Quả: **Database hoàn toàn không cần lưu trữ số dư ví người dùng hay lịch sử Payout (Rút tiền). Lemon Squeezy lo 100% mọi thứ liên quan đến tiền bạc và thuế thu nhập!**
