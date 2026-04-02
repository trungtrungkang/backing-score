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

### Đồng hồ hệ thống & Độ trễ phần cứng (WebAudio Latency)
`<midi-player>` của `@magenta/music` có độ trễ khởi động phần cứng (`WebAudio start latency`) khoảng 150ms-250ms sau khi hàm `start()` được gọi.
- `currentTime` nội bộ của `<midi-player>` di chuyển theo mô hình Nấc (Event-driven stuttering) nên nếu Binding directly vào UI, thanh Playhead sẽ bị giật cục.
- Giải pháp tuyệt đối mượt mà: Luôn dùng `performance.now()` thuần túy trơn tru suốt 60fps, tuy nhiên **phải thiết lập một hằng số Delay cứng** (`LATENCY_COMPENSATION_MS = 150`) trừ thẳng vào `currentPos` để hình ảnh Playhead hoàn thiện đồng bộ tĩnh với thời điểm sóng âm thanh phát ra tới tai người nghe. 

## 5. MusicXMLVisualizer - Chấn Chỉnh Lỗi Đồng Bộ
Các thuật toán phức tạp đã được áp dụng để triệt tiêu vĩnh viễn mọi giới hạn sai số:

1. **Native Measure Intersection (Chiết xuất Tọa Độ Trực Hệ DOM):**
   Thay vì cố cộng dồn `theoreticalMs` toán học một cách rủi ro (vì Verovio hay gộp/tách nhịp đà lấy đà), thuật toán giờ đây sẽ query trực tiếp lớp SVG chứa nốt đầu tiên của từng ô nhịp (`measureEl.contains(noteEl)`) để quét chính xác tuyệt đối `.tstamp` thật sự nằm trên hình vẽ. Lệnh query này được "đóng băng" bằng `algTstampCache` chặn hiện tượng lag do query DOM 60 lần/giây.

2. **Polyphony Highlight History (Bộ lọc Đa âm):**
   Thay vì đọc mù quáng mảng `on` (chỉ xuất Nốt MỚI Gõ), thuật toán thiết lập 1 hàm quyét Lịch sử `for ( i = 0 to activeIdx )` tích luỹ các tín hiệu `on` (Gõ phím) và đào thải các tín hiệu `off` (Bỏ phím) để ra được một tập Hợp Âm Thực Mặc Định (`currentlySoundingIds` Set).
   Nhờ Set lịch sử đa âm này, các nốt đang được ngân dài (Held notes) sẽ giữ vững độ sáng màu cam kể cả khi có bè khác gõ chèn phím xen ngang, đồng thời hoạt động không khuyết điểm khi Tua lùi (Seek Backwards).

## 6. Chế độ Flow-Mode (Gamification & Luyện tập liên tục)
Flow-Mode là chế độ nâng cao của hệ thống để đánh giá phần trình diễn (Assessment) của người chơi trên thời gian thực.
Hệ thống chấm điểm sử dụng hệ quy chiếu Tỷ lệ phần trăm (%) cho từng ô nhịp thay vì kiểm tra Nhạc lý Tuyệt đối (Pass/Fail) để cung cấp điểm số chính xác và cổ vũ người chơi.

Thuật toán cấu trúc của Flow-Mode chứa đựng 2 trụ cột kỹ thuật phức tạp:

### Trụ cột 1: Thuật toán Lưới Đồng bộ Đa Nhịp độ (Dynamic Measure Grid)
Hệ thống MIDI thường chỉ có thông tin Nốt và Tick (ví dụ `1920 ticks = 1 ô nhịp`), dẫn đến hậu quả bị nát và trượt (Metric Drift) hoàn toàn khi bản nhạc chứa **Sự thay đổi Time Signature giữa chừng** hoặc chứa **Ô nhịp lấy đà (Anacrusis / Pickup Measures)** ở đầu bản nhạc.
> [!TIP]
> **Giải pháp `durationInQuarters` native:** 
> Do Verovio MIDI generator không thường xuyên xuất thông tin "Nhịp khuyết" (Pickup) vào TimeSignature, hệ thống Score Engine sẽ trực tiếp parse Object Payload `timemap.durationInQuarters` được biên dịch trực tiếp từ bộ `AutoTimemapGenerator` (thứ parse thẳng cấu trúc MusicXML document root rễ trước đó). 
> `useScoreEngine` sẽ tự động dựng một Vector lưới `measureGrid` sở hữu độ rộng Ticks hoàn hảo tương ứng với độ rộng Quarters toán học của TỪNG Ô NHỊP ĐƠN LẺ! Từ đó Ô Khuyết Nhịp ở đầu Bài (Measure 0) sẽ được gán đúng số đo (ví dụ: `480 Ticks`), giúp Ô số 1 tiếp theo không bị nuốt chửng vào khung hình, cứu sống hoàn toàn chỉ số đồng bộ của file.

### Trụ cột 2: Giải quy luật Lặp Lại Cấu Trúc (Repeats & D.C al Fine)
Khi 1 bài hát có vòng lặp (Ví dụ chơi lại Ô số 5 ở phút thứ 2), MIDI sẽ "trải dài thẳng tắp" bản nhạc ra. 
Nếu hệ thống chấm điểm dùng Tên Giao diện (`physicalMeasure` ví dụ Ô số 5) làm Key Dictionary chấm điểm, mảng dữ liệu của Lần chơi thứ 2 sẽ bị cộng dồn và nén bẹp đứt quãng vào mảng của Lần chơi thứ 1! Kết quả dẫn đến bong bóng % của vòng lặp bị tịt ngòi 100%.

> [!IMPORTANT]
> **Latent vs Physical Splitting**
> - **Chấm điểm:** `useScoreEngine` sử dụng một ID thứ nguyên bí mật gọi là `latentMeasure` (Chỉ số tịnh tiến tuyệt đối, vd 1, 2, 3... 90). Vòng số 1 sẽ được mã hóa vào ID 5. Vòng lặp số 2 sẽ được mã hóa vào ID 62. Khép kín và hoàn toàn cách ly mảng đối chiếu điểm số.
> - **Hiển thị UI:** Engine gửi một Payload `AssessmentMeasureResult` nhét kèm ID `physicalMeasure` (Là số ID DOM thực tế ở trên màn hình, luôn là số 5). `MusicXMLVisualizer` sẽ đọc `physicalMeasure` (số 5) để tìm Bounding Box toạ độ trên màn hình. Kết quả sẽ tạo ra Bong bóng % Rực rỡ vòng 1. Và khi tua đến vòng 2, một Quả bong bóng % độc lập hoàn toàn mới sẽ tiếp tục được sinh ra và chèn đúng vào khoảng không gia đó mà không bị giẫm chân, lỗi gộp ID.

## 7. Gamification System & Anti-Cheat (Hệ thống Điểm thưởng và Chống Gian lận)
Chế độ Flow-Mode yêu cầu sự công bằng trong việc xếp hạng và cấp phát XP. Vì người dùng có thể sử dụng Microphone thay vì cáp MIDI, hệ thống rất dễ bị qua mặt bằng việc "bật loa ngoài" (Acoustic Loopback). Nốt nhạc phát ra từ loa máy tính sẽ vọng thẳng vào Mic, tạo ra điểm số ảo 100%.

### Chiến lược Chống Gian lận (Acoustic Loopback Invalidation)
Thay vì chặn hoàn toàn quyền sử dụng Mic, hệ thống áp dụng cơ chế **đẩy trách nhiệm (Warning) kết hợp giảm trừ (Penalty)**:

1. **Nhận diện Loopback trực tiếp (`isGamificationInvalidated`):**
   Cờ trạng thái `isGamificationInvalidated` trong `useScoreEngine` được kích hoạt tự động theo công thức:
   `isMicInitialized && !isScoreSynthMuted && (isFlowMode || isWaitMode)`.
   Nghĩa là: Nếu người chơi đang bật Mic, VÀ âm thanh của phím đàn Guide/Synth gốc không bị tắt đi (Muted), hệ thống kết luận 100% tiếng đàn sẽ vọng vào Mic.

2. **Cảnh báo Thông minh (UI Warning Toast):**
   - Khi phát hiện Loopback, một popup Toast (sử dụng thư viện `sonner` với ref-tracker tối ưu để không bị nháy liên tục) sẽ yêu cầu người dùng tắt "Audio Track nhạc cụ chính" hoặc "Mute nhạc cụ".
   - UI chỉ cảnh báo, không cưỡng ép người dùng thoát ra. User vân có thể tiếp tục chơi.

3. **Hình phạt Điểm số (Zero-Score Submission):**
   Hàm `submitPracticeSession` tại thời điểm gửi API POST `/api/gamification/session` sẽ kiểm tra cờ này. 
   - Nếu vi phạm Loopback, `flowModeScore` (hoặc `waitModeScore`) sẽ bị ghi đè thô bạo về `0` (Zero).
   - Backend (`gamification.ts`) tiếp tục áp dụng thuật toán `0 XP` với Modifier Zero nếu nó nhận được điểm thi bằng 0.

4. **Kinh tế Hệ số (Mic Penalty Input Modifier):**
   Ngay cả khi người chơi không gian lận (đã tắt Synth), việc dùng Mic luôn có biên độ sai lệch so với MIDI. Backend áp dụng hệ số phạt cứng `M_MIC_PENALTY`: `baseXP * 0.5`. Người dùng dùng Mic chỉ nhận được tối đa 50% XP so với dùng dây cáp MIDI, khuyến khích họ đầu tư cáp chuẩn để đảm bảo trải nghiệm sư phạm tốt nhất.

### Pipeline gửi điểm API
- Hàm hook `onPracticeComplete` ở core `useScoreEngine` sẽ tự động trigger Event khi thanh Playhead vượt quá biên độ thời gian của bản nhạc (`totalSongDurationMs`).
- Sự kiện này bốc dỡ payload trích xuất động linh hoạt % Hits / Misses trên thời gian thực, truyền gọi tắt lên Backend Appwrite mà không cần phải nhúng các logic nặng nề tính toán lại vào trong `PlayShell`.

## 8. Dual Playback Mode & Mixer Synchronization
Hệ thống cho phép người dùng chuyển đổi qua lại giữa `Midi Mode` (chỉ hiển thị và phát các track giả lập âm thanh nội bộ) và `Audio Mode` (hiển thị và phát các stems audio tải từ storage). Do cả 2 hệ thống âm thanh này được quản lý bởi cùng một Engine tổng (`useScoreEngine`), Mixer gặp phải rủi ro xung đột trạng thái rất lớn (Cross-talk interference).

### Nguyên tắc 1: Cross-Isolation (Cách ly chéo bóng ma)
Khi Mixer ở `Midi Mode`, các Audio track sẽ bị ẩn khỏi UI. Tuy nhiên, nếu một Track Audio bị ẩn đó từng mang cờ Solo (`[S] = true`) lưu trữ trong Database, cờ Solo này theo thiết kế cốt lõi của Mixer sẽ chặn mồm (kill) toàn bộ các nhạc cụ khác, bao gồm cả MIDI. 
Để giải quyết tận gốc hiện tượng "Bị chặn tiếng bởi linh hồn (ghost state) của track đang ẩn", Engine áp dụng bộ Filter chéo ở tầng sâu nhất:
- Nếu `isMidiMode` kích hoạt: Biến cờ `anyAudioSolo` bị ép thẳng về `false` (Bất kể database có ghi gì). MIDI hoàn toàn thống trị.
- Nếu `isAudioMode` kích hoạt: Biến cờ `isAnyMidiSolo` bị ép thẳng về `false`. Mọi trạng thái ẩn của MIDI không có tác quyền trên Audio Stems.

### Nguyên tắc 2: Thuật toán Base64 Velocity injection cho Multi-Track MIDI
Trái với hệ thống Audio nơi mỗi track có 1 `AudioGain` riêng biệt, hệ thống `@magenta/music` (Tone.js) chỉ sử dụng duy nhất một cổng Master Node cho toàn bộ bản nhạc. 
Trong trường hợp `EditorShell` ở chế độ Multi-Track MIDI (MusicXML tách làm cấu trúc nhiều phần như `score-midi-0`, `score-midi-1`), việc áp dụng Mute Global của Master Node là bất khả thi (vì nó sẽ tắt cả 2 track).
> [!IMPORTANT]
> **Giải pháp nội suy (Velocity Translation):**  
> Việc Tắt tiếng (Mute) hay kích hoạt Độc quyền (Solo) đối với bất kì một track con nào (`score-midi-X`) trong môi trường Multi-Track đều không trực tiếp thao tác vào WebAudio. 
> Thay vào đó, Engine tiến hành biên dịch dữ liệu (Mute/Solo/Volume) này rồi nhúng thẳng vào quá trình **Regenerate (tái tạo) file MIDI Base64**, biến nó thành chỉ số cường độ gõ phím (`Velocity`).
> Bất kì một note nào thuộc về vòng lặp đã bị Mute (hoặc không nằm trong tập hợp các Tracks được Solo) sẽ bị ép chỉ số `Velocity = 0` (Silent Note On). 
> Nhờ đó, người dùng vẫn có thể thao tác tắt M/S riêng biệt với các kênh UI độc lập mà vẫn nghe được kết quả tách bạch từ 1 luồng Master Node duy nhất. Cơ chế này còn giải quyết tận gốc lỗi "Tương tác Solo làm bật chéo Mute ở các nút khác" vốn không phải là một tiêu chuẩn thiết kế UI của các ứng dụng âm nhạc (DAWs).
