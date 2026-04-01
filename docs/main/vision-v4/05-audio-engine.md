# CHI TIẾT CÁCH LÀM: TỐI ƯU ĐA LUỒNG ÂM THANH (AUDIO STEMS ENGINE)

Tài liệu này tháo gỡ Cụm Bom Nổ Chậm Kỹ Thuật (Lưu Trữ Cháy Túi và Trình Duyệt Quét Treo Giật) gắn với tham vọng cho phép người chơi Mute/Solo các Nhạc Cụ Bè Trợ Lý (Audio Stems).

## 1. Trói Buộc Định Dạng Server (R2 Storage Limits)
Chi phí lưu trữ và Egress tuy của Cloudflare R2 là rất rẻ, nhưng rác thải RAW (.WAV nặng 150MB 1 bài) vẫn sẽ làm cháy túi nếu 1 ngày có 1 triệu Users upload thả phanh. Cho nên Nền Tảng chỉ tiếp nhận tệp tin "Đã Sạch Lông Rút Mỡ".

- **Chặn Ngõ Frontend (Dropzone Limit):** 
  Ràng buộc Component kéo thả file chỉ chấp nhận (accept) loại MIME `audio/mpeg` (mp3) và `audio/aac` (m4a).
- **Tuyệt Chiêu Giới Hạn Stems (Mặt Kỹ Thuật):** 
  Gắn cờ Đặt Lịch (Max 5 file Âm Thanh cho 1 `ProjectDocument`). Nếu tải Lên File Số 6 -> Báo lỗi Quota Exceeded. Con số 5 là Tiêu Chuẩn Vàng của Khái Niệm Phân Tách Băng Nhạc 5 Kênh (Ngũ Âm Hướng Tâm): *Drums Cover, Bass Line, Chuỗi Guitar Điện, Nền Piano Phím Gõ, Hơi Thở Xướng Âm (Vocal).*

## 2. Tử Huyệt `<audio>` Giật Khớp Lóa và Thuốc Giải Mạng Nhện Web Audio API

Nếu chúng ta ngây thơ viết vòng Lặp 5 thẻ HTML5 `<audio src="...mp3" />` rồi ra lệnh gọi `.play()` bằng JavaScript với hi vọng chúng sẽ chạy song hành, hệ quả sẽ là:
1. Thằng Guitar Load Tốc độ mạng nhanh nên cất tiếng trước. Xóa sổ chữ "Cùng Lúc".
2. Hệ điều hành iPhone chặn tự ý chạy tệp Media Đa Luồng. Sụp gãy hệ thống Mobile.

### Bản Vẽ Phương Án Khắc Phục (The Decoding Engine Blueprint)

1. **Chuẩn Bị Khung Cửi Nhạc (Fetch n Load):** 
Thay vì dùng Thẻ Nhạc, hệ thống Javascript xài lệnh `fetch()` âm thầm kéo luồng Byte Data của 5 file MP3 đó nhồi thẳng RAM để "Bẻ Giải Mã" qua chuỗi Context Máy Chủ Duy Nhất. Gọi tắt là `AudioContext.decodeAudioData()`. Lệnh này đút các tín hiệu âm thanh vào Mảnh Nhớ (AudioBuffers).

2. **Loading Quay Mòng Mòng (Barrier Lock):**
Component Nút Bấm **[Play Flow Mode]** sẽ bị Xám Trắng lại. 
Cần viết 1 cụm Code Nhóm Promise `await Promise.all()` lướt kiểm kê xem RAM đã nuốt trọn và bẻ mã đầy đủ 5 file Stems hay Chưa. Xong xuôi hết, Nút Play Mới Được Bật Đèn Xanh Cho Nhạc Công Click.

3. **Luồng Cùng Xuất Phát Nguyên Tử (Sample-Accurate Start):**
Khi nút bấm nhận Cú Click, Mã lệnh JavaScript thực hiện nối ống 5 cái `BufferSources` Nhào Chung Lại và Xuất Lệnh: `source.start(0)`.
Do cái chuỗi hệ quy chiếu Thời Gian Môi Trường ảo (AudioContextTime) đều thống nhất 1 Vạch Vận Động Rễ Ngay Máy Tính Cục Bộ, 5 tín hiệu Âm Thanh Chạy Trơn Tru Sát Xích Không Lệch Nhau 1 Nano-giây! Nó Cứ Cứng Đờ Cùng Chiều Giật Đồng Điệu với Nấc Màn Hình Game Của Nốt Nhạc Trượt.

4. **Tích Hợp Siêu Thẩm Bàn Trộn Âm (Instant Mixer Board):**
  - Chức năng tắt trống (Mute Drums)? Chức năng Kéo To Trống 200% Lấn Át Vocal? Các Chức năng đấy hoàn thiện bằng cách Cài Biến Trở GainNodes.
  - Sửa đổi trực tiếp mã toán học CPU: Lệnh rẽ `gainNode.gain.value = 0` Báo Xóa Bóng tín hiệu Âm. Độ trễ trôi dòng lập Tức Thì bằng Zê-Ro. Ngay lúc User Cầm Chuột Nhấp Nút Mute, Tiếng Trống Câm Họng Lập Tức, Trải nghiệm Mượt Má Giật Mát Hồn Khác Với Các Đoạn Xén Buffer truyền thống. Mọi thứ Đẩy Cực Đỉnh Sang Tầm Chuyên Nghiệp (Studio Quality Grade).
