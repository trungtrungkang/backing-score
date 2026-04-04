# Frontend API Reference: 10. Player & PDF Viewer

Tài liệu đặc tả các UI Components chịu trách nhiệm render bảng phổ (MusicXML) và tài liệu PDF, tích hợp luồng Audio/Video Sync đồng bộ.

## 1. `<OSMDPlayer />` (Open Sheet Music Display)
- **Path**: `src/components/player/OSMDPlayer.tsx`
- **Description**: Render file XML/MusicXML thành các nốt nhạc SVG/Canvas (dựng hình DOM phức tạp thông qua OpenSheetMusicDisplay wrapper).
- **Props**:
  - `xmlString` (string, bắt buộc): Nội dung thuần của file MusicXML.
  - `zoom` (number): Mức độ thu phóng (1.0 = 100%).
  - `cursorPosition` (number): Fractional measure/beat để vẽ thanh chạy màu xanh (Playback Cursor).
  - `onReady` (function): Bắn event khi OSMD dựng hình xong (để tắt Loading Spinner UI bù lại độ trễ).
- **React Testing Library (RTL) Scenarios**:
  - [x] Mock instance của `OpenSheetMusicDisplay` tránh lỗi WebGL/Canvas do JSDOM không hỗ trợ. `jest.mock('opensheetmusicdisplay')` để giả lập `render()` method trả về resolve.
  - [x] Render component -> Truyền xmlString rỗng -> Bắt expectation hiển thị Alert "File nhạc lỗi hoặc rỗng".
  - [x] Rerender với `cursorPosition` thay đổi -> Đảm bảo `osmd.cursor.next()` được trigger chính xác mà không kích hoạt gọi lại toàn bộ hàm mount XML đắt đỏ.

## 2. `<PDFViewer />`
- **Path**: `src/components/pdf/PDFViewer.tsx`
- **Description**: Trình đọc PDF trang ngang hoặc cuộn dọc mượt mà cho tài liệu không phải định dạng cấu trúc.
- **Props**:
  - `fileUrl` (string): Presigned URL từ R2 hoặc CDN công cộng.
  - `navMapSequence` (string/JSON array): Dấu trang để cuộn. Biến DOM Ref sẽ lắng nghe event Audio Time Update để lướt bằng `window.scrollTo`.
  - `scale` (number): Kích cỡ.
- **RTL Scenarios**:
  - [x] Mock PDF.js worker.
  - [x] Render DOM canvas của số `pageNumbers`. Expect element có role `document` hiện đủ số `<canvas>` theo số lượng trang.

## 3. BackingTrackSync / Player Controls
- **Path**: `src/components/player/PlayerControls.tsx`
- **Hooks involved**: `useAudio` (quản lý `HTMLAudioElement`).
- **Description**: Bệ điều khiển chứa nút Play, Pause, Seek bar. Nó truyền emit event Playback về parent.
- **RTL Scenarios**:
  - [x] Ấn nút "Play" -> Hook `useAudio` thay đổi state `isPlaying` thành true và Fire Event. Nút Play biến thành biểu tượng dóng Pause.
  - [x] Test Accessibility (A11y): Tab focus phải chạy vòng quanh các nút Control. `expect(playButton).toHaveFocus()`.
