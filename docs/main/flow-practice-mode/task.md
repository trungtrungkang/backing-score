# Flow Practice Mode - Task Checklist

- [ ] **1. Refactor State in `useScoreEngine`**
  - Chuyển đổi cờ `isWaitMode` thành state hệ thống `practiceModeType: 'none' | 'wait' | 'flow'`.
  - Khởi tạo bộ lưu kết quả `assessmentResults: Record<number, 'hit' | 'miss' | 'pending'>`.
- [ ] **2. Tọa độ hóa Âm thanh (Audio Time Warping)**
  - Cập nhật quá trình khởi tạo `practiceChordsRef` trong `useScoreEngine` để bẻ cong Tọa độ Cơ học (Theoretical Time) thành Tọa độ Nhạc gốc (Physical Time) nếu bài nhạc sử dụng Audio Track (Manual timemap).
- [ ] **3. Chấm điểm Thời Gian Thực (Sweep Loop Engine)**
  - Thêm logic quét thời gian mốc ±200ms vào trong vòng lặp RAF `updatePosition`. Lọc bắt lỗi nhấn đè MIDI và trả về kết quả `assessmentResults`.
  - Tích hợp tự động Mute (câm) các dải âm thanh / MIDI Tracks bị trùng với lựa chọn của người luyện tập.
- [ ] **4. Layout Liền Mạch (Continuous Verovio Mode)**
  - Cập nhật thư viện lõi `MusicXMLVisualizer.tsx` để chấp nhận thuộc tính `layoutMode: 'paged' | 'continuous'`.
  - Ép thuộc tính `breaks: 'none'` dãn `pageWidth` thành 60000px để tạo Grid cuộn màn hình nằm ngang.
- [ ] **5. Visuals & CSS Animation (Gamification)**
  - Render thẻ CSS `.assessed-hit` (Màu Xanh), `.assessed-miss` (Màu Đỏ) đè vào hệ thống Grid SVG.
  - Sửa file `globals.css` để gắn animation hiệu ứng vào các lệnh CSS này.
- [ ] **6. Giao diện (Toolbar UI Update)**
  - Tiến hành nhúng nút `[Continuous Layout Toggle]` và cụm `Practice Flow` vào Toolbar của `PlayShell` & `EditorShell`.
