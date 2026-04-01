# Real-time Play-Along Assessment Mode (Flow Practice Mode)

Tính năng "Flow Practice Mode" cho phép người dùng luyện tập theo thời gian thực (giống Synthesia). Nhạc và thanh Playhead sẽ chạy liên tục theo đúng nhịp độ bài (không đợi như Wait-Mode), hệ thống sẽ giám sát phím đàn MIDI người dùng gõ và chấm điểm (Hit/Miss) trả về phản hồi Trực quan (Tick xanh/đỏ).

## User Review Required

> [!IMPORTANT]
> **State Management:** Chúng ta sẽ cần tách biệt khái niệm `isWaitMode` ra thành một state chung là `practiceModeType` (`'none' | 'wait' | 'flow'`). Việc này sẽ ảnh hưởng tới một số component đang dùng boolean `isWaitMode`. Bạn duyệt hướng refactor này chứ?

> [!WARNING]
> **Tolerance Window (Độ trễ châm chước):** Ở chế độ chơi thật, con người không thể gõ chính xác 100% từng mili-giây. Tôi đề xuất thiết lập một "Hit Window" (Khoảng thời gian dung sai) là `±200ms`. Nếu người dùng gõ đúng nốt trong vùng 200ms trước và sau tọa độ của nốt đó trên bản nhạc, hệ thống sẽ tính là Gõ đúng (Perfect/Good). Quá thời gian đó sẽ tính là Bỏ lỡ (Miss). Bạn thấy con số 200ms này hợp lý không hay muốn chặt chẽ hơn?


## Proposed Changes

---
### 1. State Management & Hooks (`useScoreEngine`)
Chúng ta sẽ bổ sung cơ chế theo dõi chấm điểm nhịp độ thực (Real-time Evaluation Queue):

#### [MODIFY] `src/hooks/useScoreEngine.ts`
- Bổ sung type: `PracticeModeType = 'none' | 'wait' | 'flow'`. Đổi `isWaitMode` thành state này để dễ mở rộng.
- Tái sử dụng mảng `practiceChordsRef` đang có sẵn từ Wait-Mode để làm "Đề bài" cho Flow-Mode. Tuy nhiên cần **Cải tiến việc parse tọa độ**:
  - Với Project có Audio (Manual Timemap): Tọa độ nguyên thuỷ (`n.time`) của MIDI là thời gian mộc (Lý thuyết). Trong khi đó, Flow-Mode sẽ trôi theo thời gian thực (Physical Time) của file Audio. Do đó, mảng `practiceChordsRef` phải được đưa qua hàm nội suy (Interpolation Map) dựa trên `timemap` để "Bẻ cong" thời gian của các nốt nhạc sao cho khớp 100% với tiếng trống của Audio thì chức năng Tick xanh đỏ mới chạy đúng được!
- Thêm state `assessmentResults`: theo dõi trạng thái chấm điểm của từng nốt hoặc hợp âm trong mảng `practiceChordsRef` (Ví dụ: `Record<number, 'hit' | 'miss' | 'pending'>`).
- Sửa vòng lặp `updatePosition` (RAF Loop):
  - Ở Flow-Mode, `currentPos` trôi tự do theo âm thanh gốc.
  - Quét qua các hợp âm xung quanh `currentPos`. Nếu gõ trùng "Đề bài" trong khung ±200ms -> Đánh dấu `Hit`. Nếu trôi qua khỏi +200ms -> Đánh dấu `Miss`.
- Tự động Mute (Làm câm) các Track luyện tập khỏi bộ phát `<midi-player>`/`Metronome`.

---
### 2. Giao diện Cấu hình (Player Control)
Cập nhật giao diện thanh Toolbar để người dùng dễ dàng chuyển đổi Mode và chọn Track.

#### [MODIFY] `src/components/player/PlayShell.tsx` / `EditorShell.tsx`
- Sửa UI nút Wait-Mode cũ thành 1 nhóm nút "Practice Modes": [Normal] - [Wait] - [Flow].
- Cung cấp giao diện chọn Hand / Track: (Left Hand), (Right Hand), (Both).
- **[TÍNH NĂNG MỚI] Nút Tùy chỉnh Layout (Layout View Switch):** Bổ sung nút bấm (Toggle) cho phép người chơi chuyển đổi giữa `Paged Layout` (Bản nhạc chia trang thành nhiều dòng) và `Continuous Layout` (Bản nhạc là một dải băng chạy ngang duy nhất liên tục từ đầu đến cuối).

#### [MODIFY] `src/components/editor/MusicXMLVisualizer.tsx` (Verovio Config)
- Thêm thuộc tính state `layoutMode: 'paged' | 'continuous'`.
- Khi `continuous`, truyền option thẳng vào lõi Verovio (`worker.setOptions`):
  - Kéo dãn khung trang siêu thực `pageWidth: 60000`.
  - Ép `breaks: 'none'` để khử tất cả ký hiệu xuống dòng của bản nhạc gõ sẵn.
  - Lúc này, Engine cuộn màn hình (`updatePlayhead`) sẽ tiếp quản làm việc, nó sẽ biến màn hình lưới cuộn qua trái/phải thành một dòng ngang vô hạn - tương tự như màn hình Track nhạc của Synthesia hay RockBand!

---
### 3. Phản hồi Trực quan (MusicXMLVisualizer)
Cập nhật Engine SVG để bôi màu xanh/đỏ trực tiếp lên nốt nhạc theo thông số chấm điểm.

#### [MODIFY] `src/components/editor/MusicXMLVisualizer.tsx`
- Nhận biến `assessmentResults` truyền xuống từ `useScoreEngine`.
- Viết thêm logic quét vào khối `isPlaying` RAF Loop:
  - Nếu ID của nốt nhạc đang nằm trong một `practiceChord` thuộc diện `'hit'` -> Bơm class CSS `.assessed-hit` (Đổi nốt thành màu Xanh lá & Hiện checkmark).
  - Nếu thuộc diện `'miss'` -> Bơm class `.assessed-miss` (Đổi màu Đỏ).
- Cập nhật `globals.css` bổ sung keyframes nhảy animation cho các nốt Xanh/Đỏ này để tạo cảm giác Gamification (giống chơi game rhythm).


## Open Questions

1. **Hiển thị Checkmark/Cross:** Bạn muốn màu sắc chỉ hiển thị trên việc đổi màu bản thân cái nốt nhạc (Đen -> Xanh/Đỏ) hay bạn muốn vẽ thêm hẳn 1 cái Icon (✅ / ❌) bay bổng ngay trên đầu nốt nhạc đó cho giống game nhạc?
2. **Tổng hợp kết quả:** Khi kết thúc bài nhạc (End of Track), bạn có muốn show 1 bảng tóm tắt màn chơi (Ví dụ: "Độ chính xác: 85% - Tuyệt vời!") không?

## Verification Plan

### Manual Verification
1. Chọn bài "Waltz of the Flowers", bật chế độ "Flow Mode".
2. Chọn Track Tay Trái. Loa sẽ tự động câm tiếng piano tay trái, chỉ phát tay phải.
3. Bấm Play. Thanh trượt không dừng lại.
4. Gõ thử phím MIDI lệch nhịp -> Nhìn xem nốt chuyển màu Đỏ.
5. Gõ đúng nhịp trên phím MIDI -> Nhìn xem nốt chuyển Xanh.
6. Ngồi yên không gõ gì -> Nốt trôi qua sẽ tự động nẩy màu Đỏ (Miss).
