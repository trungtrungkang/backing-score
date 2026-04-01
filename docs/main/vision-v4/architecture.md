# KIẾN TRÚC TỔNG THỂ BACKING & SCORE (VISION V4)
**Tầm nhìn: Nền Tảng Thực Hành & Giảng Dạy m Nhạc Khép Kín (Private Studio & Practice Sandbox)**

---

## 1. TẦM NHÌN HỆ SINH THÁI (THE CORE VISION)

Thay vì theo đuổi Sàn Giao Dịch (Marketplace) công cộng, **Backing & Score (B&S)** tập trung trở thành một **Trạm Vũ Khí Thực Hành m Nhạc** tối thượng hàng đầu thế giới. B&S phục vụ hai Trụ cột Kinh doanh cốt lõi (B2C và B2B2C), tạo ra một hệ sinh thái khép kín và an toàn:

### Trụ Cột 1: Tổ Hợp Luyện Tập & Trình Diễn Cá Nhân (The Solo Artist Sandbox)
*Tệp Khách Hàng: Nghệ sĩ độc lập, Nhạc công chuyên nghiệp, Người tự học.*
- **Lưu trữ Bất tử (R2 Hub):** Nơi người dùng đẩy toàn bộ Gia Tài Bản Nhạc (PDF/MusicXML) của họ lên một "Đám mây" an toàn tuyệt đối. Biến B&S thành một Ổ Cứng m Nhạc Trực Tuyến.
- **Biểu Diễn Sân Khấu:** Các tính năng lật trang bằng Pedal, quản lý Setlist (Danh sách bài đi diễn), và Metronome giúp nhạc công mang iPad lên sân khấu mà không cần dở giáp giấy.
- **Gia Tốc Luyện Tập (Practice Engine):** Tính năng Flow Mode, Tách Track, Loop, giúp người tự luyện tập tại nhà tăng 200% tốc độ master một bài hát khó.

### Trụ Cột 2: Studio Giảng Dạy Tư Thục (The Private LMS LMS)
*Tệp Khách Hàng: Các Giáo Viên độc lập, Trung Tâm m Nhạc.*
- **Quyền Lực Phân Phối:** Giáo viên coi B&S là "Lớp Học Bí Mật" (Private Class) của họ. Họ tự tìm học sinh ngoài đời thật, tự thu tiền. 
- **Quản Lý Nhóm & Lớp:** Tạo các Nhóm Lớp (Classrooms), cấp **Mã Tham Gia (Join Code)** cho học sinh ruột vào lớp. B&S không lấy bất kỳ phí hoa hồng học phí nào. Giáo viên dùng công nghệ của B&S để phân phối bài giảng và ném Bài Tập dạng Chấm Điểm vào mặt học sinh từ xa.

---

## 2. HỆ THỐNG QUẢN TRỊ HỌC THUẬT (LMS CORE)

Cấu trúc luồng dạy học tập trung vào sự BẢO MẬT (Privacy) và SỰ KHÉP KÍN (Exclusivity).

### A. Mô Hình Master - Instance
- **Khóa học (Course / Master):** Là tài sản trí tuệ của Giáo viên. Giáo trình gốc (Video, Lý thuyết, Sheet nhạc bài tập). Nơi chỉ gán và tích lũy dữ liệu, không giao tiếp.
- **Lớp học (Classroom / Instance):** Được tạo ra từ Course (hoặc Lớp độc lập). Là Vùng Lãnh Thổ (Zone) kéo học sinh vào thành từng nhóm/cohort, giao bài tập (Assignment), chát nội bộ và gọi Video.

### B. Cơ Chế Room Key, Approval & Invite Tickets
- Chặn đứng hoàn toàn việc chia sẻ tài liệu trái phép. Mọi Lớp/Khóa được bảo vệ qua 2 lớp cửa:
- **1. Generic Join Code (Mã chung 6 số):** Học sinh gõ Code -> Tự động ném vào **Waiting Room** với thẻ `pending`. Giáo viên phê duyệt bằng tay sau khi thu học phí.
- **2. Single-use Invite Ticket (Vé dùng 1 lần):** Giáo viên xuất mã định danh trước (Pre-approved) gửi riếng. Học sinh nhập ticket này đi thẳng vào Lớp (`status: active`) bỏ qua Waiting Room.

---

## 3. CHIẾN LƯỢC TĂNG TRƯỞNG & DUNG LƯỢNG (PLG & FEATURE GATING)

Lợi dụng điểm mạnh chi phí siêu rẻ của hạ tầng **Cloudflare R2**, B&S áp dụng chiến lược Product-Led Growth (PLG) để hút cạn user từ tay đối thủ như forScore và Tomplay.

### A. R2 Storage - Điểm Chạm Gây Lệ Thuộc (Vendor Lock-in)
- **Miễn phí (Upload Xả Láng):** Cung cấp hạn mức Upload PDF và MusicXML cho các nghệ sĩ/người tự học cực kỳ thoải mái (vd: 100 bài). 
- Đòn Tâm Lý: Khi dữ liệu của người dùng nằm trên cloud của B&S kết hợp với khả năng render bản nhạc cực nét, họ không đời nào chịu tốn công xách file tải ngược lưu vào thẻ nhớ điện thoại nữa.

### B. Tường Thu Phí (Paywall & Tiers) Phân Lớp Service Level
- **Tier 0 (Free User - Tệp Sinh Tồn):** Xem bài mượt, truy cập thư viện nhạc mẫu (Ví dụ: 1000 bản Piano cổ điển), Lật nửa trang. *Mục tiêu: Đạt lượng DAU (Lượt dùng hàng ngày) khổng lồ thông qua kho Content SEO.*
- **Tier 1 (Pro Sub - Tệp Solo Artist/Musician):** Thu tiền công nghệ Trí tuệ luyện tập. Mở khóa Flow Mode (chấm điểm theo nốt rơi thả phanh), Auto-scroll qua AI nghe âm thanh, Mute/Solo nhạc cụ (MusicXML), Tăng/giảm Tone (Pitch Shift), Ghi chú vẽ viết đồng bộ (Cloud Sync Annotations).
- **Tier 2 (Studio Sub - Tệp B2B Teacher/School):** Thu tiền công nghệ "Trường Học Ảo". Mở khóa tạo Classroom kín, sinh vé Invite dùng 1 lần, duyệt sinh viên pending, tạo Assignments kết nối thẳng với điểm số báo cáo.

---

## 4. HỆ SINH THÁI TƯƠNG TÁC (SOCIAL & WIKI NHỮNG NẶC DANH NÔI BỘ)

### A. Bảng Tin Lọc Lõi Nghệ Thuật (Private Social Feed)
- Không có Newsfeed Public toàn cầu.
- **Dual Feed Nguồn Đóng:** Các User (đặc biệt là tệp Hành Nghề Tự Do - Solo Artist) sẽ chỉ nhận Feed tin tức từ 2 nguồn: Bảng tin trong **Classroom** họ tham gia (thay lời dặn ở lớp), và Bài chia sẻ của **KOL/Nghệ Sĩ họ Follow**.
- **The Inspiration Hook (Chống Spam):** Tránh Spam bão điểm khoe khoang vô vị. Feed ưu tiên khoe Giá Trị m Nhạc. 
  - *Sneak Peek:* Trích xuất 15s Replay đoạn Solo đỉnh nhất đưa lên Bảng Tin vinh danh thay cho con số 100 điểm chết khô.
  - *Teacher Curated:* Trong Classroom, Thầy sẽ Chọn ra bản Submit bài tập tốt nhất của 1 học trò và Ghim (Pin) "Bài Thực Hành Xuất Sắc Của Tuần" lên đầu Feed. Tạo Peer-pressure ganh đua cho cả lớp.

### B. Dữ Liệu Lõi (Global Metadata Taxonomy)
- Dù thu mình vào thành Private App, B&S vẫn cần một bộ nhãn mác (Tags) xịn.
- **Wiki Bị Ẩn (Backend Taxonomy):** Chặn User tạo rác tên Tác Phẩm. Dùng Admin và AI để tự thiết lập danh sách Tác Giả, Thể Loại chuẩn. 
- Nghệ Sĩ tải 1 triệu bản nhạc PDF lên thư viện? Họ chỉ được lấy Tag từ danh sách Wiki. Từ đó, B&S sở hữu khả năng Lọc/Tìm kiếm cực kỳ thông minh trong Thư viện vô tận của Artist.

---

## 5. CÔNG CỤ DẠY HỌC TRỰC TUYẾN KẾT DÍNH (THE ONLINE CONNECTIVITY)

Xây dựng Tòa Lâu Đài Private Class vượt xa kỹ năng thô sơ của Zoom/Skype qua Hệ Thống Tương Tác Đồng Bộ (Hạt Nhân Lõi Phase 1):

1. **Âm Thanh Mộc Bản (WebRTC Music Mode):** Ép tắt bộ lọc Echo Cancellation / Noise Suppression của máy tính. Giúp Teacher ngồi ở màn hình bên kia nghe rõ nguyên vẹn từng độ vang của nốt nhạc Acoustic do Trò đánh.
2. **Theo Dõi Bản Nhạc Đồng Bộ Lớp Học (Sync Workspace):** 
   - Thay thế chế độ Screen Share. B&S dùng Trình Trích Xuất Vector hiển thị sắc sống độc lập trên thiết bị riêng của Thầy và Trò.
   - Thầy gạch bút đỏ vào Phách số 3 trên màn hình iPad của Thầy -> Kéo theo bằng WebSocket -> Vạch đỏ hiện nguyên xi trên Laptop của Trò. Thầy lật trang -> Màn hình của Trò tự Auto-lật theo.
3. **Phá Cữ Độ Trễ (Zero-latency Flow Practice):**
   - Giờ Video Call, Thầy quăng Backing Track và Trò đánh theo độ trễ Zero ngay tại máy của Trò.
   - Thầy nghe âm thanh qua Video nhưng mắt dán vào Bảng Real-time Cập Nhật Lỗi của Flow Mode nhảy số Xanh Đỏ hiện ra từ đường truyền Data thay vì Audio. Dạy chính xác 100% đến từng nốt gảy tay.

---

## 6. KIẾN TRÚC TỐI ƯU HÓA ĐA LUỒNG M THANH (AUDIO STEMS ENGINE)

Việc cho phép Upload nhiều Audio Tracks (Stems như Drums, Bass, Vocals) trong 1 Project (MusicXML) là cốt lõi của tính năng Mute/Solo, nhưng kéo theo bài toán nhức nhối về Storage Dữ Liệu và Performace Trình Duyệt.

### A. Giải Quyết Bài Toán Dung Lượng Server (Storage Costs)
- **Ép Chuẩn Định Dạng:** Ngăn chặn tuyệt đối User upload file không nén (`.wav`, `.flac`). Bắt buộc chỉ nhận các định dạng nén như `.mp3` (192kbps) hoặc `.m4a` (AAC). Một track MP3 dài 4 phút chỉ nặng khoảng 4-5MB. (Điều này giúp R2 luôn rẻ).
- **Mức Trần Giới Hạn (Hard-Limit):** B&S là phần mềm Luyện Tập (Practice App) chứ không phải DAW. Thiết lập Hard-Limit: **Tối đa 5 Audio Tracks / 1 Project**. (Thường là 5 rãnh cấu trúc: Drums, Bass, Guitars, Keys, Vocals).

### B. Giải Quyết Bài Toán Giật Lag Đồng Bộ (Playback Desync Lag)
- **Tử Huyệt HTML5:** Nếu code hiển thị 5 thẻ `<audio>` để phát 5 file MP3 song song, trình duyệt sẽ sập hoặc chạy trượt nhịp (Khớp lóa) do buffering.
- **Thuốc Giải Web Audio API (`AudioContext`):** 
  - Hệ thống sẽ **Fetch** toàn bộ 5 luồng MP3 và Giải mã (Decode) tống thẳng vào bộ Nhớ Đệm (RAM - `AudioBufferSourceNode`).
  - Nút Play chỉ được bật (Enabled) sau khi toàn bộ Promises giải mã của 5 tracks báo đã hoàn tất 100%. 
  - Lệnh `bufferSource.start(0)` phát ra trên cùng 1 hệ quy chiếu Thời gian (Context Time). Kỹ thuật Nút Mạng Nhện (Node Graph) này tạo ra khả năng **Đồng bộ trọn vẹn đến từng Sample (Sample-accurate sync)** — 5 tracks và nốt nhạc MusicXML sẽ chạy mượt mà sát rương mà không bao giờ bị lệch nhịp.
  - Việc bấm Mute nhạc cụ chỉ đơn giản là thao tác toán học (`gainNode.gain.value = 0`), độ trễ bằng 0.

---
*(Tài liệu này được soạn thảo nhắm đóng băng kiến trúc thiết lập nền tảng vĩ mô cho Backing & Score Phase 1. Database & Engine sẽ được align theo Blueprint này).*
