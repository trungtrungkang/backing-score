# Mô Hình Kinh Doanh & Phân Quyền Nền Tảng (Creator Revenue & Rights)

Tài liệu này định nghĩa Thỏa thuận Cộng tác (Collaborator Agreement) giữa Hệ thống (Nền tảng Lotusa) và các Giáo viên/Nhạc sĩ (Creators).

---

## 1. TRÁCH NHIỆM CHÉO (Responsibilities)

### Trách Nhiệm Của Hệ Thống (Platform)
- **Hạ Tầng Kỹ Thuật (Infrastructure)**: Vận hành toàn bộ máy chủ, Server Actions, Appwrite Database, lưu File MusicXML/MP3, và thuật toán chấm điểm `Wait Mode Engine`.
- **Nguồn Lưu Lượng (Marketing & Traffic)**: Sử dụng Phễu Mạng Xã Hội (Community Feed) để chạy SEO kéo học sinh miễn phí vào. Sau đó chuyển đổi (Convert) họ thành người mua Gói Thuê bao (Subscription).
- **Thanh Toán (Payment Clearing)**: Giao tiếp với Stripe, thu hộ tiền, đóng thuế, và tự động chia doanh thu (Revenue Share) minh bạch cho Creator vào mùng 10 hàng tháng.
- **Bảo Vệ Bản Quyền (DRM/Copyright)**: Đảm bảo Mã nguồn và Video/Tài liệu bài giảng của Creator không bị copy tuồn ra ngoài. Chống Account-sharing (Dùng chung tài khoản).

### Trách Nhiệm Của Cộng Tác Viên (Creator)
- **Sản Xuất Nội Dung Độc Quyền**: Soạn giáo án chữ (Tiptap Editor) và chọn Bản Nhạc (Snippet) đúng chuẩn sư phạm. Đảm bảo chất lượng giáo dục cao nhất.
- **Chăm Sóc Cộng Đồng (Engagement)**: Trả lời Comments, giải đáp thắc mắc lý thuyết của học sinh ngay bên dưới Khóa Học của mình hoặc trên mạng xã hội nội bộ.
- **Tính Chính Danh**: Không lôi kéo học viên ra các nền tảng bán khóa lậu bên ngoài. 

---

## 2. QUYỀN LỢI & CHIA SẺ DOANH THU (Monetization & Rights)

Vì nền tảng kinh doanh theo dạng **Gói Thuê Bao (Subscription)** kết hợp **Bán Lẻ**, dòng tiền sẽ được chia theo 3 nguồn chính để đảm bảo sự công bằng tuyệt đối:

### A. Quỹ Thưởng Tương Tác (The Royalty Pool)
*Áp dụng khi Học viên dùng Gói Thuê Bao (Subscription) tháng/năm học miễn phí mọi Khóa.*
- Hệ thống trích ra X% (Ví dụ: 30%-50%) từ tổng doanh thu Subscriptions hàng tháng để ném vào "Quỹ Thưởng Hệ Sinh Thái" (Royalty Pool).
- **Công thức tính tiền cho Creator**: Tiền thưởng được chia đều dựa trên **[Tổng Số Phút Học Viên Lưu Lại Đọc Tiptap]** + **[Số lượt vượt qua Wait Mode]** của khóa học đó. 
- *Ý nghĩa*: Khóa nào càng cuốn hút, học viên thực hành cắm cáp đàn càng lâu, Creator đó càng nhận được nhiều tiền từ Quỹ. Khóa nào rác, tạo ra cho có, Quỹ chia bằng 0.

### B. Doanh Thu Bán Lẻ (A-la-carte Sales)
*Áp dụng khi Học viên không mua gói Sub, mà bỏ 500k ra Mua Đứt Khóa Học.*
- Mức chia cao nhất. Creator nhận về Y% (Ví dụ: 50% - 70%) doanh thu sau khi trừ đi phí quẹt thẻ Stripe.
- Hệ thống lấy phần còn lại để trang trải chi phí Máy Chủ WebMusicXML.

### C. Hoa Hồng Affiliate (Creator Referral)
- Nếu Creator tự dùng Mạng Xã Hội cá nhân (Tiktok/Youtube của họ) mang mã Giảm giá (Coupon) kêu gọi Fan vào đăng ký Gói Subscription của toàn Hệ thống.
- Creator sẽ nhận ngay 20%-30% Hoa hồng giới thiệu trong tháng đầu tiên cho Users mới đem về. Đây là thỏi nam châm khổng lồ khích lệ Creator tự làm Marketing kéo khách cho App!

---
*Bản thiết kế này giữ cho Hệ thống (Platform) có Quyền Sinh Sát tối cao, đồng thời kích thích các Creator sản xuất khóa học "Gây Bão" nhờ Cỗ máy chấm điểm Wait Mode độc quyền.*
