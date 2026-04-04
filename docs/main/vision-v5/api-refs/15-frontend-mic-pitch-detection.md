# Frontend API Reference: 15. Mic Pitch Detection (`useMicInput`)

Tài liệu này đặc tả cơ chế nhận diện tự động cao độ âm thanh sắc nét (Polyphonic Pitch Detection) qua Microphone, được thiết kế thành Hook độc lập `useMicInput.ts`.

## 1. Khởi tạo & Định tuyến Kiến trúc Máy học (Machine Learning)
Phân hệ này ứng dụng mô hình AI của Spotify là `@spotify/basic-pitch` chạy trên nền máy học Web `@tensorflow/tfjs`.

- **Lazy Loading Model**: Để tránh tình trạng treo trình duyệt, TFJS (nặng hàng Megabytes) không bị Bundle thẳng vào mã nguồn trang web. Thay vào đó, nó được `import()` động (Dynamic Import) vào giây phút người dùng ấn nút "Cho quyền truy cập Micro".
- **Hệ thống phần cứng tăng tốc (Backend Acceleration)**: Engine sẽ thử thiết lập ưu tiên phần cứng: WebGL (Card đồ họa) -> WASM -> CPU dự phòng.

## 2. Đường ống xử lý Audio (Audio Pipeline)
Bởi vì thuật toán AI của Basic Pitch đòi hỏi cực kỳ khắt khe về đầu vào băng tần âm thanh (đúng 22,050 Hz và khung mẫu 43,844 samples/khung ~ 2 giây):
- **Trình tạo nguồn mộc (Raw Source):** Bắt buộc rút dây `echoCancellation` và `noiseSuppression` của WebRTC (Microphone) thành `false` ngay từ hàm `getUserMedia`. Tiếng đàn bị lọc tạp âm sẽ mất sóng Harmonics (bội âm), khiến AI mù màu.
- **Node Cố Định (ScriptProcessorNode)**: Xóa vòng đời `AudioWorkletNode` để sử dụng `ScriptProcessor` nhằm tương thích tối đa với Next.js mà không rắc rối với đường dẫn Blob URL ảo. Hệ thống nhồi liên tục Data vào một bộ đệm vòng (Ring Buffer).
- **Bộ đệm vòng (Ring Buffer State)**: Mảng `Float32Array` chứa 43,844 điểm dữ liệu luôn luôn xoay nòng, ghi đè cái quá cũ bằng cái tươi mát, để đẩy kịp cửa sổ thời gian (Sliding Window) chạy ngầm qua Model AI.

## 3. Khóa chống chèn ép luồng (Mutex Inference Lock)
Vì hàm `evaluateModel` của AI kéo rất nặng tài nguyên UI, nên ta sử dụng cờ `isEvaluatingRef = true` để khóa "chặn cửa" (Mutex).
Nếu thẻ âm thanh nhồi Buffer quá nhanh trong khi Card đồ họa xử lý AI chưa báo xong khung hình kết quả cũ, nó sẽ tự lướt qua (Drop frame) để giữ nhịp độ FPS cho toàn trang web, chống treo Chrome. Max-pooling lấy dồn 45 mili-giây quá khứ bù trừ thời gian chết ảo.

## 4. Xử lý Bộ lọc & Chống Nhiễu Ồn (Acoustic Splatter Prevention)
Bảng mảng AI trả ra cấu trúc Tensor 88-phím (giống độ dài phím đàn Piano). Để chuyển nó về Array Nốt thực sự:
- Trích xuất ra `aggregatedFrame` 88 Tọa độ qua thuật toán Max-pooling (chắt lọc cái tốt nhất).
- **Profile Người dùng (Calibration)**: So sánh với Cấu hình Micro theo profile người đó (`MicProfile`). Nếu tần số nhiễu phòng ở mức 0.38, nó sẽ đẩy ranh giới nhạy cảm (Probability Threshold) lên. Nếu người đó gảy nốt Trầm/Bass (nhỏ hơn phím 36), Engine tự nới rộng biên độ bù điểm điếc cho Mic.
- **Top 6 Polyphonic Limit**: Bóp ngạch tối đa chỉ xuất ra 6 nốt (6 ngón bóp hợp âm cao nhất), lược bỏ rác. Ngăn chặn hiện tượng dập Note vang (Sustain splatter).

## Unit Test Scenarios Đề Xuất
Bởi vì Model AI tải trên Web không thể chạy trọc lóc trên NodeJS của Jest. Ta dùng Testing Mock:
- [x] Mock hàm trả về `MediaDevices.getUserMedia` truyền vào luồng array giả (fake Float32Array).
- [x] Kiểm tra Hàm gọi phân giải Threshold linh hoạt: Tạo Mock Profile `{ noiseFloor: 0.5 }`, ném vào mảng AI điểm Probability `0.4`. Assert kiểm chứng Hệ thống phải Từ Chối ghi nhận mảng `activeNotes` của nốt rác đó vì $0.4 < 0.5$ (Baseline chìm).
