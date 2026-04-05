# Tài Liệu Sản Phẩm: Nhóm Tính Năng "Music Video Call"
*Thư mục: vision-v6*

Tính năng Music Video Call không chỉ là một công cụ gọi điện trực tuyến thông thường (như Zoom hay Google Meet), mà là **một không gian sư phạm âm nhạc kỹ thuật số**. Mỗi tính năng nhỏ bên trong đều được thiết kế để giải quyết những "nỗi đau" (pain-points) đặc thù của việc dạy và học nhạc online.

Dưới đây là chi tiết ý nghĩa và vai trò của từng tính năng dưới góc nhìn sản phẩm (Product Perspective).

---

## 1. Hệ Sinh Thái Gọi Nhóm Sư Phạm (Selective Broadcasting)

### 1.1 Quản lý Phân Quyền Micro Trọng Tâm (Audio-Isolation)
- **Ý nghĩa & Vai trò:** Khi nhiều học viên cùng lúc đàn/hát, âm thanh sẽ bị nhiễu loạn (Cacophony), đặc biệt do độ trễ truyền tải khác nhau trên Internet. Tính năng này cấu hình ngầm để mặc định **chỉ có Giáo viên** mới được phát thanh (Broadcast) đến toàn phòng. Audio của học sinh bị chặn ngay từ gốc phần mềm để tránh dội âm. 
- **Lợi ích:** Mang lại một không gian lớp học trật tự, học sinh chỉ có thể nghe tiếng đàn mẫu của thầy và tập trung thực hành trên đàn của mình tại nhà mà không lo làm ồn người khác.

### 1.2 "Raise Hand" (Giơ Tay) và Cấp Quyền Biểu Diễn
- **Ý nghĩa & Vai trò:** Để kiểm tra bài, học sinh ấn nút "Giơ tay". Giáo viên ấn duyệt, hệ thống sẽ cấp quyền (Escalate Token) để học viên đó tạm thời trở thành "Người biểu diễn". Micro của học sinh này sẽ được kết nối tới toàn lớp.
- **Lợi ích:** Mô phỏng hoàn hảo việc gọi lên bảng trả bài. Các học sinh đang tắt tiếng khác vẫn có thể lắng nghe phần trình diễn của bạn học để rút kinh nghiệm.

---

## 2. Đồng Bộ Hóa Tài Liệu (Universal Document Sync)

### 2.1 Truyền Tải Tọa Độ Bản Nhạc (Cursor/Scroll Sync)
- **Ý nghĩa & Vai trò:** Thay vì chia sẻ toàn màn hình (Screen Share) độ phân giải thấp, phần mềm của Giáo viên chỉ âm thầm gửi trạng thái (Giáo viên đang chọn Bài Nhạc nào? Đang ở khuôn nhạc số mấy?) qua hệ thống mạng. Máy học sinh khi nhận được Data này sẽ **tự động bẻ con trỏ và cuộn trang theo**.
- **Lợi ích:** Tối đa hóa trải nghiệm thị giác. Bản nhạc hiện trên máy học sinh là hình ảnh nguyên bản, không dùng video nên băng thông sử dụng gần như bằng 0 (chỉ mất vài Bytes cho lệnh chữ).

### 2.2 Bù Trừ Độ Trễ Tự Động (Jitter Audio-Visual Mitigation)
- **Ý nghĩa & Vai trò:** Do video/audio luôn bị trễ khoảng 100-300ms so với Data thuần túy, con trỏ nhịp trên màn hình học sinh thường chạy trước tiếng nhạc của Thầy. Hệ thống được lập trình để tự lấy "chỉ số chậm mạng" hiện tại ra tính toán và bắt con trỏ trên hình phải **đợi** cho khớp với tần số âm thanh gõ tới tai học trò.
- **Lợi ích:** Xóa bỏ sự khó chịu khi "Nhạc một nơi, hình một nẻo", giúp học viên không bị rối nhịp (groove).

### 2.3 Đồng Bộ Cuộn Trang Độc Lập (Anchor Measure Sync / Viewport Synchronization)
- **Ý nghĩa & Vai trò:** Khi giáo viên dừng nhạc và chỉ cuộn chuột (scroll) để giải thích lý thuyết, hệ thống sẽ sử dụng thuật toán phân tích điểm mù (Intersection Observer) để dò tìm "Khuôn nhạc đang nằm giữa màn hình" (Anchor Measure) của Thầy, truyền định danh ID của nó qua mạng, và ép DOM của Trò tự động cuộn (scrollIntoView) đến đúng khuôn nhạc đó.
- **Lợi ích:** Đảm bảo trải nghiệm "Học 1 kèm 1" chân thực: Thầy trượt hình đến đâu, Trò bị kéo theo đến đó. Đặc biệt, phương thức định vị bằng ID giúp đồng bộ hiển thị hoàn hảo ở mọi loại kích thước màn hình (kể cả khi Thầy dùng giao diện màn dọc Continuous, còn Trò dùng màn ngang Paged).

---

## 3. High-Fidelity Audio Mode (Chế độ Âm Thanh Gốc)

### 3.1 Khóa Bộ Lọc Thông Minh (Original Sound Enforcer)
- **Ý nghĩa & Vai trò:** Các công cụ gọi thoại thông thường tự động gọt dũa tiếng ồn, vô tình gọt luôn cả âm sắc (resonance) dải trầm hoặc cao của đàn Piano hay Guitar. Chế độ Original Sound sẽ bắt hệ thống gửi âm thanh nguyên chất ở độ phân giải bitrate tối đa (Music Mode).
- **Lợi ích:** Thầy dạy thanh nhạc hay các nhạc cụ acoustic có thể nghe được tiếng sắc nét nhất để nhận xét về **chất âm** của học sinh (như độ ngân vang, kỹ thuật nhả chữ).

---

## 4. UI/UX & Gamification (Cảm Hứng Học Tập)

### 4.1 Bố cục Nổi (Floating Workspace PiP)
- **Ý nghĩa & Vai trò:** Chuyển đổi khung camera của Thầy Trò thành các ô nhỏ gọn trôi tự do thay vì đóng cứng làm che khuất các nốt nhạc.
- **Lợi ích:** Học viên dễ định hướng trọng tâm vào tập sách nhạc hơn là khuôn mặt nhau, nhưng vẫn duy trì được sự kết nối ánh mắt.

### 4.2 Lịch Sử Phiên Chuyên Cần (Live Session Logger)
- **Ý nghĩa & Vai trò:** Tự động theo dõi các mốc thời gian ai đang online trong phòng, khi nào lớp học bắt đầu/kết thúc. 
- **Lợi ích:** Hệ thống Dashboard tự vẽ lại báo cáo thời lượng học cho phụ huynh/giáo viên đánh giá độ siêng năng. Nguồn cấp dữ liệu điểm danh này sau đó sẽ trích xuất ra Điểm thưởng (Gamification Points) để thúc đẩy động lực.

---
**Tổng Kết**
Music Video Call V6 không chỉ giải quyết triệt để khuyết điểm kỹ thuật về Băng thông và Độ trễ, mà còn đặt **trải nghiệm thực hành của học sinh lên làm kim chỉ nam cốt lõi**. Mọi tính năng giao tiếp đều âm thầm phục vụ cho một bài giảng mượt mà, đồng điệu nhất.
