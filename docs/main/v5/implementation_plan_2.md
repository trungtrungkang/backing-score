# Kế Hoạch Cải Thiện UI/UX Dashboard (Main View)

## Đánh giá UI/UX hiện tại
File `dashboard/page.tsx` đang gặp tình trạng "Phình to theo chiều dọc" (Vertical Bloat). Các thành phần đang được xếp chồng lên nhau theo thứ tự:
1. Banner Cảnh báo (Xác thực Email)
2. `SubscriptionCard` (Quảng cáo nâng cấp Premium)
3. `DailyChallengeCard` (Thẻ Gamification/Luyện tập)
4. Thanh Header (Sửa Profile, Nút Create Project)
5. 3 Thẻ Stats Card (Thống kê số lượng bản nhạc)
6. `DriveManager` (Khu vực làm việc chính để duyệt file)

**Vấn đề:** 
- Quá tải thông tin (Cognitive Load). Người dùng vừa vào là bị "đập vào mặt" quá nhiều thẻ thông báo, quảng cáo, thử thách.
- Phải cuộn chuột tốn thời gian mới xuống được khu vực thiết yếu nhất là `DriveManager`.
- Các nút không liên quan nhóm lại với nhau (vd: Nút "Edit Profile" nằm ngay cạnh "Create Project" trên đầu danh sách File).

## Proposed Changes (Giải pháp thiết kế)

### Chuyển đổi sang Bố cục 2 Cột (2-Column Grid Layout)
Thay vì xếp chồng dọc, chúng ta sẽ chia màn hình theo tỷ lệ **70:30** hoặc **75:25** (trên Desktop).

**Cột Trái (Main Content - 70-75%)**
Tập trung 100% vào nghiệp vụ quản lý File:
1. **Header:** Tinh giản tối đa. Xóa bỏ hoàn toàn nút "Edit Profile" (đã có ở trang /u/[id]) và "Create Project" rườm rà (Người dùng giờ đây chỉ việc Kéo & Thả file trực tiếp vào giao diện của DriveManager). Chỉ giữ lại tiêu đề "My Uploads".
2. **Stats Overview:** Đặt 3 thẻ thống kê ở dạng nhỏ gọn ngay dưới Header.
3. **DriveManager:** Tối đa hóa diện tích để làm việc với danh sách File & Folder. Cắt bớt các border rườm rà vì nó đã nằm trong 1 không gian riêng.

**Cột Phải (Widgets / Side Pane - 25-30%)**
Góc dành cho Gamification và Quản lý tài khoản:
1. **Verfication Widget:** Nếu user chưa xác thực Email, nhắc nhở nhỏ gọn ở đây.
2. **DailyChallengeCard:** Hiển thị khích lệ luyện tập hàng ngày.
3. **SubscriptionCard:** Kêu gọi nâng cấp (Upsell).

*(Trên điện thoại di động - Mobile: Cột phải sẽ tự động rớt xuống dưới cùng hoặc biến thành 1 tab riêng biệt để nhường toàn bộ màn hình viber cho Drive).*

## Open Questions
- Bạn có đồng ý với thiết kế thay đổi từ "1 Cột dọc" sang Bố cục "Bảng điều khiển 2 cột (Dashboard Grid Column)" như trên không?
- Bạn có muốn tôi bốc tách phần `Stats Overview` ra thành một Component riêng biệt hay cứ viết thẳng vào `page.tsx` cho nhanh gọn?

## Verification Plan
1. Viết lại cấu trúc CSS Grid / Flexbox trong `dashboard/page.tsx`.
2. Kiểm tra Responsive: Đảm bảo trên mobile màn hình hẹp, cột Widget (phải) tự đẩy xuống bên dưới cột Trái.
3. Chụp hình UI trước / sau để so sánh độ thoáng (White space).
