# Frontend API Reference: 14. Score Engine (`useScoreEngine`)

Đây là trung tâm điều khiển (Brain Component) lớn nhất của toàn bộ hệ thống Player tại Frontend. Hook `useScoreEngine.ts` dài ~1500 dòng, tiếp quản mọi khâu đồng bộ hóa giữa DOM, Web Audio API, và luồng dữ liệu MusicXML.

## 1. Cấu trúc Output (Return Signature)
Hook trả về một Pattern gom nhóm cực kỳ khoa học, phù hợp cấu trúc Dependency Injection vào các component con:
- `state`: Trạng thái React để render giao diện (Ví dụ: `isPlaying`, `positionMs`, `playbackRate`, `practiceModeType`). Thay đổi sẽ trigger Re-render.
- `refs`: Chứa biến Mutable cho logic tính toán cực nhanh không cần re-render (Ví dụ: `audioManagerRef`, `midiPlayerRef`, `positionMsRef`).
- `actions`: Bộ Hàm điều khiển (Ví dụ: `handlePlay`, `handleMuteToggle`, `setLoopState`).

## 2. Hệ Sinh Thái Audio & MIDI (AudioManager x MidiPlayer)
- **Audio Stems**: Quản lý nhiều lớp âm thanh đệm (Backing Tracks) bằng class `AudioManager` độc lập. Hook này tự lặp qua mảng `payload.audioTracks` để tải file vào RAM.
- **Score Synth (MIDI)**: Tích hợp `@tonejs/midi`. Đặc biệt có sự kiện `handleMidiExtracted` - Dịch mã Base64 MIDI nhúng ngược vào `<midi-player>` để phát ra tiếng Piano nốt nhạc thật chuẩn xác.

## 3. Hệ Thống Dual-Timemap & Cấu trúc Dữ Liệu Tọa Độ
Trái tim đồng bộ hóa của ứng dụng nằm ở mảng lưới thời gian (Timemap). Mảng này liên kết số thứ tự ô nhịp biểu diễn (Measure) với thời điểm tính bằng mili-giây (timeMs) và các nhịp phách bên trong (beatTimestamps). Cụ thể hai phương pháp sinh Timemap:

### A. Auto Timemap (Timemap Tự Động / Từ File MIDI)
- **Nguồn gốc**: Được tạo ra từ quá trình Parse file MusicXML hoặc phân giải thuộc tính Tempo (BPM) nhúng sẵn trong File MIDI gốc.
- **Hoạt động**: Hook tự lấy số `ticks` tổng (VD: 480 PPQ) phân giải theo tỷ lệ BPM. Hàm `ticksToUnscaledMs` lặp qua từng node nốt nhạc ảo, tính trước xem ở Ô nhịp (Measure) số X, nốt này sẽ vang lên ở mili-giây thứ mấy trong không gian. Thuật toán này có khả năng tự co dãn hoàn hảo bù đắp các đoạn chơi chậm dần (Ritardando) thiết lập trong ký âm.

### B. Manual Timemap (Timemap Thủ Công / Tapping Sync)
- **Nguồn gốc**: Dùng cho trường hợp "Đánh nhạc đệm bằng file Audio mp3 thu sẵn" (Không có trục thời gian cấu trúc).
- **Hoạt động (Nằm tại `<EditorShell />`)**: 
  - Người dùng bấm nút **Sync Track (Elastic Grid)** trên thanh TransportBar, kích hoạt trạng thái `isSyncMode`.
  - Bật nhạc lên nghe. Máy thu sẵn một bộ phím gõ (Ví dụ: nhấn Phím `Enter` là ngã báo Downbeat đầu ô nhịp, `Shift` là nhịp giữa, vv...).
  - Vòng lặp `handleKeyDown` ghi nhận sự kiện nhấp từ bàn phím -> Lấy độ trễ chính xác của Node âm thanh `audioManagerRef.getCurrentPositionMs()` tại khoảnh khắc bấm -> Gói lại và nén thành mảng `manualTimemap`.
  - Đây giống như một mini-game "Tap to the beat" để gắn dính bản PDF/MusicXML tĩnh lặng khớp hoàn toàn với hơi thở của người ca sĩ hát bằng cảm xúc (tempo trồi sụt thất thường) trong bản ghi âm.

## 4. Chế độ Tập luyện Chuyên Sâu (Wait Mode & Flow Mode)
Bằng việc hợp nhất luồng dữ liệu từ `useMidiInput` (Bàn phím cơ) và `useMicInput` (Cao độ FFT), `useScoreEngine` cung cấp một cỗ máy (Engine) chấm điểm thời gian thực:

### A. Hoạt động Trích xuất Hợp âm (`practiceChordsRef`)
Ngay khi load bài, Hook quét toàn bộ dữ liệu MIDI của các Track được chọn tập luyện, nhóm trùng lặp các nốt đánh cùng lúc (sai số < 20ms) thành một Mảng Tọa Độ phân giải: `[{ timeMs: 1200, notes: Set(60, 64, 67), measure: 2 }, ...]`. Biến con trỏ `targetChordIndexRef` bắt đầu từ 0.

### B. Chế độ Chờ (Wait Mode) - Chìa khóa tự học
- **Cơ chế chặn (Blocking)**: Một vòng lặp `requestAnimationFrame` chạy ở tần số ~60FPS liên tục đối chiếu `positionMs` của bài nhạc với mảng Hợp âm mục tiêu. Khi tiếng nhạc chạy tới sát nút Hợp âm hiện tại, Audio/MIDI tự động **hãm phanh (Pause) và ngắt tiếng (Mute)**. Dòng thời gian bị đóng băng.
- **Cơ chế so khớp (Collision Detection)**: Hook liên tục kiểm tra Set `activeNotesRef` từ Microphone/MIDI. Khi nào Micro của bạn phát đủ phổ âm (VD: Đô-Mi-Son) khớp với tập hợp `targetChord.notes`, Hook nhả cờ `hit`, nhả phanh cho bản nhạc xé rào chạy sang mũi nhọn `targetChordIndexRef + 1`.

### C. Chế độ Trôi chảy (Flow Mode) - Chấm điểm biểu diễn
- Khác với Wait Mode, tiếng nhạc **không bao giờ bị dừng lại**.
- **Cửa sổ dung sai (Tolerance Window)**: Thuật toán quy định một cửa sổ sai số (Ví dụ ±150 mili-giây). Nếu tiếng vang lên khớp cao độ trong cửa sổ thời gian đó khi nốt lướt đi băng qua vạch con trỏ, Cờ hệ thống lưu trữ Record điểm rớt vào mảng `assessmentMeasureResults` thành `hit`. Trượt cửa sổ hoặc sai nốt bị đánh `miss`.

### D. Hệ thống Anti-Cheat
Ghi giong lại biến cờ `isGamificationInvalidated` chặn tịt ngay hiện tượng sinh viên bật Micro mà quên tắt Loa (Loopback phá game). Cụ thể, nếu `Score Synth` (vốn dĩ phát tiếng Piano dẫn đường) đang được vặn to bằng Loa ngoài, nó sẽ lọt vào Mic. Engine tự phát giác điều này và từ chối cập nhật Exp sau buổi học.

## Unit Test & E2E Scenarios Đề Xuất
Bởi vì quá đồ sộ, cần Fake (Mock) hoàn toàn lớp cấp thấp:
- [x] **Event Loop**: Trigger event `handlePlay`. Assert gọi chuẩn hành vi `MidiPlayerSingleton.start()` và `audioManagerRef.play()`, kiểm tra Catch Promise Rejection.
- [x] **Rate Scaling (Tua nhanh)**: Khi gọi `setPlaybackRate(0.5)`, check xem có Update lại cấu hình lưới BPM truyền cho con Metronome bên trong AudioManager không (Chống tiếng gõ Metronome bị lệch pha).
- [x] **Phát hiện gian lận (Anti-cheat/Feedback Loop)**: Gắn điều kiện Mic Mode, bật tiếng `Score Synth` to hết cỡ. Kỳ vọng biến state `isGamificationInvalidated` lập tức bật thành `true`.
