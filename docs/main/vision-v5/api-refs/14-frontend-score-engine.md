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

## 3. Hệ Thống Dual-Timemap & Đồng Bộ Trục Thời Gian
Cốt lõi hóc búa nhất của Hook này ở các biến `timemap` và `correctedTimemapRef`:
- Nếu người dùng đánh Mode `audio` (nhạc Beat có sẵn): Phải khớp thời gian Audio với nốt nhạc thông qua sơ đồ lưới thời gian ảo (`manualTimemap`).
- Nếu người dùng đánh Mode `midi`: Sẽ tự tính BPM và tính ngược số `ticks` sang `ms` (hàm tỷ lệ nội suy `ticksToUnscaledMs`).

## 4. Chế độ Tập luyện Mở rộng (Wait Mode & Flow Mode)
Tích hợp mạnh mẽ với Hardware ngoại vi:
- Giao tiếp với `useMidiInput.ts` (Bàn phím Piano cứng của người dùng cắm vào máy tính) và `useMicInput.ts` (Nghe cao độ nốt qua Micrô).
- Khi bật chế độ `isWaitMode`:
  - Phát nhạc đến 1 điểm -> Dừng ngắt (Global Mute tắt).
  - Vòng lặp quét `practiceChordsRef` (lấy từ MIDI thô) xem người dùng bấm đúng Hợp âm/Nốt không.
  - Ghi nhận Anti-cheat: `isGamificationInvalidated` báo động nếu Micrô vô tình thu lại chính âm thanh Synthesizer của máy phát ra do không tắt loa/cắm tai nghe.

## Unit Test & E2E Scenarios Đề Xuất
Bởi vì quá đồ sộ, cần Fake (Mock) hoàn toàn lớp cấp thấp:
- [x] **Event Loop**: Trigger event `handlePlay`. Assert gọi chuẩn hành vi `MidiPlayerSingleton.start()` và `audioManagerRef.play()`, kiểm tra Catch Promise Rejection.
- [x] **Rate Scaling (Tua nhanh)**: Khi gọi `setPlaybackRate(0.5)`, check xem có Update lại cấu hình lưới BPM truyền cho con Metronome bên trong AudioManager không (Chống tiếng gõ Metronome bị lệch pha).
- [x] **Phát hiện gian lận (Anti-cheat/Feedback Loop)**: Gắn điều kiện Mic Mode, bật tiếng `Score Synth` to hết cỡ. Kỳ vọng biến state `isGamificationInvalidated` lập tức bật thành `true`.
