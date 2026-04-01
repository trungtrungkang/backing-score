# CHI TIẾT CÁCH LÀM: CÔNG CỤ DẠY HỌC TRỰC TUYẾN MỘC (THE ONLINE VIDEO CALL CONNECTIVITY)

Tài liệu này bóc tách Công Nghệ Lõi (Core Engine) làm cho phần mềm Dạy Nhạc Trực Tuyến của Bạn hạ gục hoàn toàn các tay chơi ngoại đạo (Zoom/Skype/Google Meet).

## 1. Mạch Máu Của Lớp Mộc (WebRTC Music Mode)

Bản chất của Zoom là ứng dụng Họp Hành, nên nó triệt tiêu các tần số vang rần. B&S sẽ đi theo con đường WebRTC chuyên biệt cho Nghệ Sĩ.

- **Giải Pháp Nền Tảng (LiveKit Cloud):** Không tự xây dựng hệ thống WebRTC từ đầu. B&S sẽ sử dụng **LiveKit** (Dùng SDK `@livekit/components-react`). LiveKit tự động xử lý STUN/TURN Server, quản lý kết nối rớt mạng rất hoàn hảo.
- **Set Tham Số "Âm Thanh Mộc":** LiveKit cung cấp API can thiệp rất sâu. Khi Teacher/Student Publish Audio Track lên LiveKit Room, BẮT BUỘC tắt các bộ lọc gấy nhiễu m thanh gốc bằng AudioConstraints:

```javascript
navigator.mediaDevices.getUserMedia({
    audio: {
        echoCancellation: false,   // Cấm Hủy Vang! Tiếng Đàn Phải Vang Nguyên Tán.
        noiseSuppression: false,   // Cấm Chống Ồn! Tiếng Quạt Giấy Quẹt Trống Đừng Hút Đi.
        autoGainControl: false,    // Cấm Tự Chỉnh Đẩy Nhỏ To Mic Ngang Chừng.
        channelCount: 2            // Cấp Kênh Vòm Stereo Thay vì Mono Thất Vọng Của Zoom.
    },
    video: true
})
```
- Việc thả phanh này sẽ truyền thẳng cục Audio Trái Tim Thần Chưởng từ Đồ Nghề sang Màng Phím Tai Nghe của Giáo Viên, Giáo Viên bắt đúng cao độ để chẩn bệnh.

## 2. Đồng Bộ Lưới Không Gian (Synchronized Workspace Không Chụp Màn Hình)

Screen Share nén Video mờ bịch sẽ bị ném sọt rác. Hai người ở hai bên thế giới mở hai ứng dụng Độc lập nhưng DÍNH SÁT màn hình.

### Công nghệ Truyền Thông Real-time (LiveKit DataChannel)
- Không cần phải xài thêm hệ thống `Appwrite Realtime` hay `Socket.io` riêng biệt để kéo App nặng nề. Quản lý chung 1 kết nối duy nhất qua **LiveKit DataChannel**.
- DataChannel của LiveKit truyền tải gói tin UDP song song với Voice/Video, nên tốc độ nhanh như chớp. Khi State của Teacher thay đổi, hệ thống bắn Event Sang DataChannel:
- State của Teacher gửi tín hiệu thay đổi Event Sang:
  - Sự kiện Đổi bài hát (`ON_LOAD_SCORE`: payload { projectId })
  - Sự kiện Cuộn chuột hoặc Lật trang (`ON_PAGE_TURN`: payload { pageNumber })
  - Sự kiện Nâng Cao: **Bút Mực Đỏ Annotation**. Giáo viên dùng ngón tay chấm tọa độ màn hình vẽ cung tròn đỏ. Phép nội suy SVG Vector truyền đúng dải Toạ Độ đó qua Server rồi vẽ lại đúng tỉ lệ đó trên điện thoại trò. 100% Không bao giờ bể Pixel giật lag so với Screen Share nén MPEG.

## 3. Cứu Cánh Độ Trễ Mạng (Zero-Latency Flow Mode)

- **Vấn Đề:** Ping Mạng Mỹ-Việt = 150ms. Thầy Quạt Chả, Trò Hát Lên Phách Dớp sai 150ms là thảm cảnh nhịp điệu.
- **Thuật Toán Luồng Song Song (Parallel Flow):**
  - Teacher không hát trước cho Trò bè.
  - Teacher trên App chọn Bài Hát Giao Nhiệm Vụ trong lớp.
  - Tín Hiệu Chạy -> App Của Trò mở File MP3 Backing Track nằm Ngay Tại Thùng Cache Trình Duyệt (RAM).
  - Trò Bấm Nút Bắt Đầu và Rải Nốt Nhanh/Điệu/Hát. Tốc Độ Trễ Tín Hiệu = 0 mili-giây. Sóng Trò hát đi qua WebRTC Hủy Vang tới Tai Thầy để xác nhận cảm xúc mộc.
  - Đồng thời Bảng điểm Thuật toán Game Flow Mode Realtime ở Máy Tính Bảng của Trò nhảy số (Đúng nhịp Vạch đỏ), ném luồng Data String Bé Tẹo vài byte (Không hao đường truyền bằng Video) bay vượt biên giới về Bảng Leaderboard chớp nháy trên màn hình Giáo Viên. Thầy đọc chữ là biết trò này lỡ dớp ở Nhịp Ô Số 13. Sóng Âm thanh Tai nghe Mộc chỉ để làm minh chứng khẳng định cho con chữ. CỰC KỲ KHỦNG KHIẾP VÀ CHÍNH XÁC!
