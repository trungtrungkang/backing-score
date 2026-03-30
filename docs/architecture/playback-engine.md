# Backing & Score Playback Architecture

Tài liệu này ghi chú lại kiến trúc cốt lõi của hệ thống Playback Engine trong dự án Backing & Score, đặc biệt nhằm ghi nhớ các logic phức tạp xung quanh `MusicXMLVisualizer`, hệ thống Timemap và chế độ Wait-Mode.

## 1. Vòng lặp Render Giao Diện (RAF Loop)
Thành phần hiển thị chính là `<MusicXMLVisualizer>`. Việc di chuyển thanh Playhead (thanh trượt) mượt mà không dùng State của React vì React State Updates quá chậm để chạy ở 60 FPS và dễ gây giật (re-render đệ quy toàn cục).

Thay vào đó, hàm `updatePlayhead` sử dụng `requestAnimationFrame` (RAF):

> [!WARNING]
> **Không bao giờ được sử dụng Early Return (chặn sớm) để ngắt RAF Loop khi thời gian (`positionMs`) không đổi!**
> 
> Sai: `if (lastPlayheadMs === currentPosMs) return;`
> Lệnh này sẽ ngắt tận gốc RAF và khiến vòng lặp chết vĩnh viễn cho tới khi user tương tác lại. Trong các chế độ như Wait-Mode hoặc khi Pause, `positionMs` đứng im nhưng vòng lặp vẫn phải tiếp tục sống (chỉ tốn cực kỳ ít tài nguyên) để đón bắt các event tiếp theo.

**DOM Cache Mechanism:**  
Dù hàm `updatePlayhead` chạy 60 lần/giây, nhưng nó chỉ làm các phép toán JS căn bản. Các lệnh query DOM tốn kém (như `getBBox()`, `getScreenCTM()`) chỉ được kích hoạt (trigger) khi chỉ số nốt nhạc hiện tại (`validActiveIdx`) thực sự thay đổi so với frame trước.

## 2. Hệ Quy Chiếu Thời Gian (Time Spaces)
Hệ thống tồn tại song song 2 hệ thời gian rất dễ gây nhầm lẫn:

1. **Theoretical Time (Thời gian lý thuyết - Verovio Tstamp):**  
   Đây là giá trị thời gian toán học chuẩn xác tuyệt đối sinh ra từ BPM và `durationInQuarters` trên file hình XML. Giá trị này chia cắt các nốt hoàn hảo. `<svg>` của Verovio chỉ hiểu hệ tọa độ theo thời gian này (`.tstamp`).

2. **Physical Audio Time (Thời gian âm thanh thực tế):**  
   Dù hệ thống đang chơi bằng Backing Track gốc (Manual), hay bằng bộ phát MIDI Synthesis (Auto), giá trị đồng hồ gốc (`positionMs`) luôn là **Physical Time** (elapsed ms). 
   Vì thuật toán trôi thời gian của Audio Player/MIDI Player đôi khi sinh ra sai số micro-seconds so với bản vẽ Verovio, cho nên **Cả Auto lẫn Manual Timemap đều phải chạy qua bộ "giải nén"** ở Normal Mode: Lấy thời gian thực (`currentPosMs`), chuyển hoá thành `% progress` của ô nhịp, rồi nhân trả lại vào Theoretical Time để biến đổi thành `currentVrvMs` (toạ độ Verovio Native).

## 3. Wait-Mode (Chế Độ Chờ / Luyện Tập)
Chế độ Wait-Mode sở hữu những quy luật cực kỳ nghiêm ngặt khác với Normal Playback:

> [!IMPORTANT]
> **Wait-Mode bắt buộc phải sử dụng Hệ Thời Gian Lý Thuyết (Theoretical Time).**
> - Ở Wait Mode, backing track (âm thanh bị bẻ cong) bị tắt hẳn.
> - Do đó, thanh playhead không cần hệ thống "giải nén" phức tạp của Manual Timemap.
> - Khi `isWaitMode=true`, hệ thống tự ép `EFFECTIVE_TIMEMAP_SOURCE = "auto"`. Toạ độ ảo (`currentVrvMs`) sẽ bằng thẳng toạ độ gốc (`currentPosMs`). Việc này giúp Playhead bám cứng (Snap) vào chính xác toạ độ của nốt nhạc đang đợi, thay vì "trôi" (Glide) lửng lơ bằng tỷ lệ `% progress` thường sinh ra sai số thập phân (float errors).

**Quy tắc Highlight (Tô màu nốt):**
- Ở chế độ bình thường (`Normal`), Verovio tự động gắn class `active-verovio-note` để tô màu nốt nhạc màu cam khi playhead đi qua.
- Tuy nhiên, Wait-Mode đã sở hữu hệ thống thiết kế Flashcard độc lập riêng biệt của mình (tô xanh, đỏ đo lường độ chính xác theo phím đàn). Vì vậy, logic tô màu cam mặc định bị **vô hiệu hoá** (`!isWaitMode`) để tránh tình trạng "râu ông nọ cắm cằm bà kia".

## 4. `useScoreEngine` Architecture
Engine này đóng vai trò như bộ máy đếm nhịp (Metronome) và điều phối toạ độ tập trung (`positionMs`). Tránh việc mutate trực tiếp toạ độ này ở các Component con. Khi cần tua nhạc (`handleSeek`) hoặc Sync với các thiết bị bên ngoài (MIDI Keyboard), `useScoreEngine` sẽ ép `positionMsRef.current` tức thời rồi mới phát tín hiệu ra vòng ngoài thông qua React State. Hệ thống `MusicXMLVisualizer` sẽ "nghe" trực tiếp từ `positionMsRef.current` (chứ không phải State) để loại bỏ độ trễ (latency lag) từ React Batch Updates.
