# Mô Hình Kinh Doanh & Chia Sẻ Doanh Thu (Creator Revenue Model)

Tài liệu này thiết lập khung kế hoạch hợp tác giữa Hệ thống (Platform) và Đối tác nội dung (Creators).

---

## 1. PHÂN BỔ TRÁCH NHIỆM

### Trách Nhiệm Của Hệ Thống (Platform)
- **Hạ Tầng Kỹ Thuật (Infrastructure)**: Cung cấp và duy trì toàn bộ máy chủ, Server Actions, Appwrite Database, lưu trữ dữ liệu bản nhạc và hệ thống lõi Wait Mode.
- **Phát triển Tệp Người Dùng**: Tối ưu hóa phễu chuyển đổi thông qua nền tảng chia sẻ âm nhạc miễn phí để tăng số lượng người dùng chuyển đổi sang các gói dịch vụ trả phí.
- **Xử lý Thanh Toán**: Tích hợp các cổng thanh toán (Stripe, v.v.), thu hộ, xử lý các nghĩa vụ tài chính liên quan và phân bổ báo cáo doanh thu minh bạch định kỳ.
- **Bảo Mật Nội Dung (DRM)**: Áp dụng các biện pháp kỹ thuật số để bảo vệ bản quyền tài liệu giảng dạy, hạn chế tình trạng chia sẻ tài khoản trái phép.

### Trách Nhiệm Của Đối Tác (Creator)
- **Sản Xuất Nội Dung**: Cung cấp các khóa học, tài liệu bằng công cụ nội bộ (Tiptap Editor) kèm cấu hình các bài tập thực hành (Snippet) đảm bảo đúng chất lượng sư phạm.
- **Hỗ Trợ Cộng Đồng**: Giải đáp câu hỏi, phản hồi bình luận của học viên trong khuôn khổ khóa học hoặc trên diễn đàn chung của nền tảng.
- **Cam kết Tích hợp**: Ưu tiên đóng góp giá trị nội dung trong hệ sinh thái của ứng dụng.

---

## 2. QUYỀN LỢI & CƠ CHẾ CHIA SẺ DOANH THU

Hệ thống hoạt động chủ yếu dựa trên gói đăng ký (Subscription) và cung cấp thêm tùy chọn bán lẻ. Doanh thu dự kiến phân bổ theo 3 luồng:

### A. Quỹ Tương Tác Nội Dung (Royalty Pool)
*Áp dụng đối với học viên sử dụng gói thuê bao (Subscription) truy cập toàn hệ thống.*
- Nền tảng phân bổ một tỷ lệ phần trăm (X%) từ tổng doanh thu Subscription vào "Quỹ Tương Tác" hàng tháng.
- **Phương pháp phân bổ**: Doanh thu từ quỹ này được chia tỉ lệ thuận với hiệu suất thực tế của nội dung. Hiệu suất được đo lường dựa trên các chỉ số như: Tổng thời gian hoàn thành bài học, và Số lượng bài tập Wait Mode được vượt qua thành công trong khóa học đó.
- Mục tiêu của quỹ này là khuyến khích Creators tạo ra các khóa học mang lại giá trị thực hành cao, giữ chân học viên gắn bó với hệ thống lâu hơn.

### B. Doanh Thu Mua Trực Tiếp (A-la-carte Sales)
*Áp dụng khi người dùng quyết định mua gói trọn đời hoặc mua lẻ từng khóa học (không tham gia Subscription).*
- Creators nhận một tỷ lệ phân chia cố định (Y%) trên tổng giá trị giao dịch, sau khi đã trừ đi các chi phí liên quan đến cổng thanh toán.
- Phần còn lại sẽ được hệ thống giữ để phục vụ chi phí vận hành máy chủ và bảo trì.

### C. Cơ Chế Tiếp Thị Liên Kết (Affiliate / Referral)
- Hệ thống cung cấp công cụ tạo mã giới thiệu (Coupon/Referral Links) cho các Creators.
- Khi Creators sử dụng kênh cá nhân (Tiktok/Youtube/Blog) để điều hướng người dùng mới đăng ký vào hệ thống (Subscription hoặc Mua lẻ), Creators sẽ nhận mức hoa hồng cố định (Z%) cho giao dịch thành công đó.
- Chương trình này khuyến khích Creators trở thành đại sứ thương hiệu để mở rộng mạng lưới người dùng chung.

