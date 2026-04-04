# Kiến Trúc Đồng Bộ Tài Liệu Âm Nhạc (Universal Document Sync Engine - V6)

Tài liệu này mô tả chi tiết cơ chế đồng bộ hoán vị (Sync/Share) giữa 2 định dạng tài liệu cốt lõi là **PDF (Truyền thống)** và **MusicXML (Điện toán)** trên đường truyền P2P của hệ thống WebRTC LiveKit.

## 1. Bài Toán và Phương Pháp Giải Quyết

Khi Giáo viên mở một lớp học Online, họ cần chia sẻ một File Sheet Music cho toàn bộ học sinh. 
- Nếu chia sẻ qua dạng "Share Screen" Video thuần tuý: Chữ ở những dòng Sheet Music có độ phân giải thấp sẽ bị vỡ nát khi trải qua tầng nén H.264/VP8 của Video stream. Băng thông có thể tốn đến 3-5 Mbps.
- **Giải Pháp V6**: Học sinh sẽ TỰ RENDER tài liệu gốc ở máy cá nhân với chất lượng Vector 4K sắc nét. Hệ thống LiveKit chỉ làm nhiệm vụ truyền tín hiệu **Toạ Độ (Cursor, Scroll)** thông qua WebRTC DataChannel. Băng thông giảm xuống tiệm cận 0 (chỉ mất vài Bytes cho mỗi gói tin text).

## 2. Giao Thức Truyền Tải (DataChannel Payload)

Chúng ta xây dựng hai chuẩn Payload được tối ưu hóa cho từng Engine. Mọi gói tin (Packet) gửi qua kênh `DataChannel` đều phải tuân thủ nghiêm ngặt Schema dưới đây:

### A. Envelope (Vỏ bọc chung)
```typescript
interface SyncEnvelope {
  type: "CHANGE_DOC" | "SYNC_PDF" | "SYNC_XML" | "HEARTBEAT";
  timestamp: number; // Múi giờ Epoch lúc gửi đi (Phục vụ check độ trễ)
  senderId: string;
}
```

### B. Payload: Đổi Chuyển Tài Liệu (CHANGE_DOC)
Mỗi khi Giáo viên chọn bài tiếp theo trong danh sách Setlist, Client sẽ bắn tín hiệu này ra. Máy học sinh tự kích hoạt hàm Fetch dữ liệu bài tương ứng. Cơ chế truyền: **Reliable** (Bảo đảm không rớt).
```typescript
interface ChangeDocPayload extends SyncEnvelope {
  type: "CHANGE_DOC";
  projectId: string;
  projectType: "pdf" | "musicxml"; 
}
```

### C. Payload: PDF Sync (SYNC_PDF)
Cập nhật vị trí cuộn chuột của Giáo viên trong chế độ xem bản PDF tĩnh. Gửi định kỳ bằng **Unreliable/Reliable**.
```typescript
interface PdfSyncPayload extends SyncEnvelope {
  type: "SYNC_PDF";
  pageIndex: number;  // Học sinh phải lật sang đúng trang này
  scrollY: number;    // Vị trí tỷ lệ phần trăm dọc màn hình (0.0 đến 1.0)
}
```

### D. Payload: MusicXML Sync (SYNC_XML)
Đây là Data bám sát metronome. Được gửi tự động mỗi khi ô nhịp (measure) thay đổi.
```typescript
interface XmlSyncPayload extends SyncEnvelope {
  type: "SYNC_XML";
  measure: number;    // Ô nhịp hiện tại (vd: 12)
  beat: number;       // Phách hiện tại trong ô nhịp (vd: 3)
  tempo: number;      // Tần số Metronome hiện hành
  isPlaying: boolean; // Trạng thái: Dừng hay Chạy
}
```

## 3. Kiến Trúc "Đồng Bộ Không Độ Trễ Phản Xạ" (Deskew Buffer Engine)

Mạng Internet có độ trễ (Latency). Cắm đàn đánh phím A, nhưng 50ms sau âm thanh mới tới được mép tai của thiết bị học sinh. Tuy nhiên, luồng Dữ liệu DataChannel bằng JSON gửi dưới dạng TCP/UDP lại có tốc độ xuyên sáng, nhanh hơn luồng Audio khoảng 30-50ms.

Nếu ta để màn hình lật trang NHANH HƠN lúc tiếng lật đàn đến thính giác của Học sinh -> Não bộ của học sinh sẽ bị rối loạn thao tác.
=> **Yêu cầu Bắt buộc**: Hình lật trang của Học sinh phải được Nén lại vài chục mili giây chờ cho Tiếng truyền kịp.

**Thuật toán Delay Sync (trong `UniversalSyncProvider`):**

1. Học sinh bắt được gói tin `SYNC_XML` hoặc `SYNC_PDF` từ LiveKit. Biết chính xác `measure` giáo viên đang đánh.
2. Hook `useSyncDeskew` đo đạc số âm thanh ngậm trong đường ống Buffer:
   `const delayMs = audioTrack.getRTCStats().jitterBufferDelay;`
3. Component chờ đúng bằng thời gian đó trước khi kết xuất (Render) UI mới:
   ```javascript
   setTimeout(() => {
      // Bây giờ Âm thanh đã vừa ra khỏi loa màng nhĩ học sinh.
      // Ra lệnh cho AlphaTab hoặc PDFReader cuộn con trỏ theo sát nhịp!
      setLocalCoordinate(payload.measure);
   }, delayMs);
   ```

## 4. Xử Lý Nghẽn Mạng Phục Hồi (Heartbeat Resiliency)

Trong các giao thức Video Streaming, việc rớt mất gói tin DataChannel `Unreliable` là thường tình. Điều gì xảy ra khi lớp có 1 học sinh mới rớt Wi-Fi vào lại, hoặc vô lớp trễ nửa bài? 

**Nút thắt Heartbeat:** Máy của Host (Teacher) sẽ luôn lưu State nội bộ của chính mình. Cứ mỗi 3 Giây, một hàm `clearInterval` sẽ gom nhóm thông tin hiện có (Đang bật bài nào, measure số mấy, đang cuộn đến đâu) vào bản tin `HEARTBEAT` để tống xuống toàn bộ khán phòng.
Những học viên bị lệch nhịp sẽ bắt lấy Heartbeat và được hệ thống tái định hình (Reset Layout) khớp đúng tiến độ lớp lập tức. Mọi sự kiện Drop Wifi đều tự sửa chữa trong vòng tối đa 3 giây mà Giáo Viên không cần tác động.

## 5. Cấu Trúc File & Thư Mục Front-end

```text
src/components/livekit/
├── UniversalSyncProvider.tsx     // Khối bao bọc, cung cấp React Context
├── controllers/
│   ├── PdfSyncController.tsx     // Hook bắn tín hiệu xuống PDFPlayer 
│   └── XmlSyncController.tsx     // Nhận & Deskew tín hiệu nhồi qua AlphaTab API
└── LiveKitClassroom.tsx          // Khung viền hình ảnh Video Trôi Nổi (Dock/Floating)
```

## 6. Tính Năng Phi Ly Tâm (Free View / Detached Mode)

Thực tế giảng dạy cho thấy Học sinh sẽ có lúc muốn tự ý trượt trang PDF hoặc giở lại trang nhạc cũ để ôn bài ngay trong lúc Thầy giáo đang giảng ở chương tiếp theo.

- **Biến Trạng Thái Mỏ Neo**: Một state `isAutoSyncEnabled = true` (Mặc định) sẽ chặn gác cổng trước hàm Hook. Nếu học sinh có tác động vật lý lên giao diện (Ví dụ: Chạm ngón tay vuốt PDF, tự xoay con lăn chuột lên Player, tự bấm Play nhạc), hệ thống lập tức ngắt cờ `isAutoSyncEnabled = false`.
- **Ignore Payload**: Khi tắt đồng bộ, mọi tín hiệu P2P báo Múi Toạ Độ (`SYNC_PDF`, `SYNC_XML`) mà Giáo viên gửi lên DataChannel đều bị giấu nhẹm (Bỏ qua). Học sinh hoàn toàn làm chủ cục diện máy mình. Tuy nhiên, luồng Audio/Video Call vẫn nối mạch bình thường.
- **Trở Lại Đường Đua (Re-sync Button)**: Một nút bấm UI màu vàng với viền đập nhịp nhàng: `Trở lại vị trí của Giáo Viên (Sync with Host)` sẽ rớt xuống trên màn hình. Nếu học sinh ấn vào, cờ bật thành `true` và máy khách ngay lập tức lấy lại túi toạ độ mới nhất từ gói `HEARTBEAT` bị bỏ ngỏ trước đó để Dịch Chuyển Tức Thời học sinh về đúng vị trí giảng dạy của lớp.

## 7. Bản Chất Trộn Âm Thanh & Tương Tác Cục Bộ (Audio Topology & Local UI Actions)

Trong mô hình LiveKit, **Giáo viên đóng vai trò là Bàn Trộn Âm Thanh (Master Mixer)**. Tiếng đàn thực tế + Âm Metronome + Tiếng Backing Track từ AlphaTab của Thầy được gộp lại thành 1 luồng Audio WebRTC chung để bắn sang tai nghe Học sinh.

Vì vậy, UI của học sinh xử lý các tương tác cục bộ (Mute track, Metronome) theo quy tắc sau:

1. **Khi đang trong quy củ (Auto-Sync = true):**
   - Bộ Synthesizer (Máy phát MIDI) của thẻ AlphaTab nội bộ phía học sinh bị tắt tiếng ngầm (`Master Volume = 0`). Để tránh hiện tượng Dội âm (Echo), học sinh chỉ NGHE âm thanh LiveKit của Thầy giáo và NHÌN con trỏ chạy trên màn hình.
   - Nếu học sinh cố tình bấm nút *Bật Metronome* hoặc bấm *Mute một track nhạc cụ* trên UI hệ thống, App mặc định học sinh muốn "Khởi nghĩa học riêng". Cờ `isAutoSync` ngay lập tức sập xuống `false`. 
2. **Khi ở chế độ tự trị (Free View Mode):**
   - Luồng WebRTC Audio của Giáo viên tự động giảm âm lượng xuống 20% (Để học sinh vẫn nghe Thầy chỉ thị thoang thoảng).
   - Bộ Synthesizer nội bộ được kích âm lượng lên 100%. Lúc này, mọi nút Metronome, Mute/Unmute Track của Học sinh sẽ có tác dụng kiểm soát bản nhạc vật lý của chính thiết bị đó.
3. **Khi tái đồng bộ (Re-Sync):**
   - Volume nội bộ lại sập về 0.
   - Volume lớp học tăng lại 100%. Toàn bộ tempo, mute states bị ghi đè bởi gói `HEARTBEAT` của Thầy giáo!

## 8. Cấu Hình WebRTC Cho Âm Nhạc (Music-Grade Audio Quality)

Bản chất WebRTC ban đầu được sinh ra để tối ưu hóa cho **Giọng nói Con người (Speech)**. Mặc định nó sẽ bật 3 thanh gươm chống nhiễu: *Echo Cancellation (Chống vang)*, *Noise Suppression (Lọc ồn)*, và *Auto Gain Control - AGC (Cân bằng âm lượng)*. 
Điều này là **Thảm Hoạ** đối với âm nhạc! Nếu có các bộ lọc này, tiếng đàn ghi-ta hay tiếng trống snare sẽ bị hệ thống AI lầm tưởng là "Tiếng Ồn" dội vào Mic, dẫn đến việc bị bóp méo, ngắt quãng (clipping), tiếng to tiếng nhỏ thất thường (volume ducking).

Để đảm bảo âm thanh LiveKit phát ra phải rành mạch, dải tần (Dynamic Range) nguyên vẹn như nghe file MP3, hệ thống sẽ chèn trực tiếp các tham số sau vào lúc khởi tạo `LocalParticipant`:

```javascript
const audioOptions = {
  echoCancellation: false,  // Tắt triệt tiêu tiếng vang
  noiseSuppression: false,  // Tắt lọc ồn rác
  autoGainControl: false,   // Tắt tự giảm âm lượng (đảm bảo độ Dynamic của tiếng nhạc cụ)
  sampleRate: 48000,        // Chuẩn PCM Studio (48kHz)
  sampleSize: 16,
  channelCount: 2           // Bắt buộc đẩy luồng Stereo (Âm thanh nổi) thay vì Mono
};
```
Ngoài ra, để chống giật/rớt mạng, hệ thống tận dụng cơ chế **RED (Redundant Audio Data)** của LiveKit để gửi lặp gói tin âm thanh 2 lần, giúp kháng cự trên mọi môi trường Wi-Fi yếu mà không bị cà giật (Stutter).

## 9. Khả Năng Đa Luồng Máy Quay (Multi-Camera Broadcasting)

Đối với các nhạc cụ phức hợp như Electone, Piano Grand hay Drumset, việc Giáo viên hoặc Học sinh yêu cầu có 2-3 góc máy (Một soi mặt, một soi dọc bàn phím, một dìm xuống dàn Pedals dưới chân) là nhu cầu thực tế tất yếu.

Kiến trúc cốt lõi của LiveKit hoàn toàn hỗ trợ **Đa Phát Tuyến (Multiple Published Tracks)** trên cùng một Người dùng (Participant). Khác với các ứng dụng meeting như Zoom vốn dĩ hay ép bạn phải dùng giải pháp giả lập webcam phụ bằng "Share Screen", hệ thống LiveKit cho phép chúng ta làm việc này cực kỳ Native:

1. **Thu Thập Phần Cứng**: Gọi hàm trình duyệt `navigator.mediaDevices.enumerateDevices()` để liệt kê và chọn tất cả các Webcam cắm vào cổng USB nội bộ.
2. **Kích Hoạt & Định Danh Tracks**: Thay vì chỉ gọi `room.localParticipant.setCameraEnabled(true)`, Giáo viên sẽ tạo nhiều Track từ các Webcam khác nhau và vứt thẳng vào Room kèm theo nhãn dán:
   ```typescript
   await room.localParticipant.publishTrack(keyboardCamTrack, { name: "HandCam_1" });
   await room.localParticipant.publishTrack(footPedalCamTrack, { name: "PedalCam_2" });
   ```
3. **Phân Rã UI ở Khán Giả (Học Sinh)**: Khác biệt so với cuộc gọi 1-1 đơn thuần, Frontend UI của chúng ta phân tích các luồng `TrackReference` đổ về.
   - Luồng có tên `Camera` (Mặc định) sẽ nằm trên cùng.
   - Các luồng gắn tên tùy chỉnh (`HandCam_1`, `PedalCam_2`...) sẽ được rải dọc xuống và thu nhỏ thành các Thẻ (Thumbnails) Picture-in-Picture. 
   - Học sinh có đặc quyền đưa chuột bấm đúp vào cửa sổ `PedalCam_2` để **Ghim (Pin) Phóng To** riêng góc máy bằng chân của Giáo viên khi muốn nhìn kỹ kĩ thuật ấn Pedals.

Chức năng Multi-Cam này được quản lý riêng biệt với luồng âm thanh gốc, nên số lượng Camera có ghim thêm bao nhiêu đi nữa thì Độ trễ Audio/Data Sync hoàn toàn không bị ảnh hưởng!

## 10. Chuyển Xếp Giao Diện Linh Hoạt (Dynamic Topology UI)

Phần lớn thời gian đầu giờ học (hoặc với các lớp căn bản), Giáo viên và Học sinh chỉ cần tập trung trao đổi ngón đàn hoặc trò chuyện mà không cần thiết phải hiển thị tờ Sheet Music vướng víu. Do đó, Giao diện Lớp Học (Classroom UI) được thiết kế theo dạng **"Cánh Bướm" (Expandable)**:

1. **Trạng thái Mặc định (Full Video Mode):** 
   - Khi luồng `active_project_id` trên DB là NULL, toàn bộ 100% diện tích trang Web sẽ dành cho Camera.
   - Giao diện áp dụng dạng Box Grid (Chia ô vuông đều) hoặc Spotlight (Người nói to ở giữa, các thành viên nhỏ bên trên) hệt như Zoom hay Google Meet thông thường.

2. **Khi Trình chiếu File (Document Focus Mode):**
   - Khi Giáo viên bấm nút "Mở bản nhạc", tín hiệu `CHANGE_DOC` được kích hoạt.
   - UI sẽ áp dụng CSS Transitions mượt mà: Toàn bộ thẻ Video Grid khổng lồ sẽ bị "bóp" lại, trôi dạt về thành một Sidebar mép Trái (hoặc mép Phải) với bề ngang chiếm khoảng 25-30% màn hình, các Webcam thu gọn thành khung hình dọc.
   - Khoảng phình 75% không gian trung tâm còn lại sẽ được bù đắp bởi Khay gác nhịp (PlayShell / MusicXML / PDF Player).

3. **Thu gọn Bản nhạc (Unshare):**
   - Một chạm vào nút "Dừng chia sẻ File", Sheet Music biến mất, khung Camera 30% lại lập tức bung nở che lấp toàn màn hình. 
   
Kiến trúc này giúp nền tảng đa dụng tuyệt đối: Vừa là Web Meeting phổ thông, vừa biến hình thành Phòng Nhạc Điện Tử chỉ với 1 cú click!

## 11. Vẽ Chú Thích & Ghi Chú Thời Gian Thực (Canvas Annotation)

Một tính năng "Đắt Giá Nhất" đối với giáo dục âm nhạc: Giáo viên khoanh tay khoanh tròn một nốt nhạc khó, hoặc vẽ mũi tên dặn dò kỹ thuật Lướt ngón (Glissando).
Nếu dùng Video Share Screen, việc vẽ vời sẽ đội Băng thông hình ảnh lên hàng chục Mbps vì phải gửi lại từng Pixel màu. V6 giải quyết bài toán này cực thanh thoát qua `DataChannel`:

1. **Hiển Thị Lớp Phủ (Overlay Canvas)**: Bao bọc bên ngoài khung hiển thị MusicXML hoặc PDF là một thẻ `<canvas>` trong suốt HTML5, dính chặt với các tọa độ bản nhạc.
2. **Chuẩn Hóa Kích Thước & Tọa Độ (Coordinate Mapping)**:
   - **Đối với PDF**: Đây là loại tài liệu tĩnh (Fixed-layout). Ta chỉ cần tính tỷ lệ chuẩn (Relative Proportions) theo phần trăm của trang giấy đang xem: Ví dụ `x=0.5` (Ngay nếp gấp giữa), `y=0.1` (Sát viền trên). Máy học sinh sẽ quy đổi cái mốc 50% đó ra màn hình của họ mà không bị lệch.
   - **Đối với MusicXML (Bám Tọa Đo Nhịp - Anchor Box)**: Khác biệt hoàn toàn! MusicXML của AlphaTab là dạng kết xuất phản hồi (Responsive). Cùng một ô nhịp số 15, trên máy tính Thầy có thể nằm ở Dòng nhạc số 1, nhưng trên iPad học trò nó sẽ bị vỡ dòng và trôi xuống Dòng nhạc số 3. Nếu vẽ theo tọa độ `X,Y` thông thường, vòng tròn nét bút của Thầy sẽ thắt cổ họng... khoảng không trắng bóc ở máy học trò!
     -> **Giải Pháp AlphaTab**: Khi ngón tay Thầy chạm vào màn hình MusicXML, API nội bộ của AlphaTab sẽ truy xuất ra Bounding Box (Khuôn chứa) của Ô nhịp (Measure) rớt dưới ngòi bút đó. Payload gửi đi không phải là X/Y tĩnh, mà là 1 mỏ neo: `[Gắn vào ngực Measure số 15, Tọa độ X/Y di chuyển tương quan +10px so với mép trái của góc Measure đó]`. Hệ thống học sinh dò tới Measure 15, và đẻ nét vẽ ra ngay mép đó bất chấp nó đang nằm ở xó xỉnh nào của màn hình!
   
3. **Payload DataChannel Tốc độ cao (`DRAWING`)**:
   Khi cây bút của Giáo Giên quẹt 1 đường cong, P2P Socket lập tức ném cục JSON nhỏ khoảng 200 bytes sang nhà học sinh.
   
   *Mẫu Payload PDF:*
   ```json
   { "type": "DRAWING", "action": "DRAW", "color": "RED", "target": "PDF", "pageIndex": 1, "points": { "x": 0.521, "y": 0.450 } }
   ```
   *Mẫu Payload MusicXML:*
   ```json
   { "type": "DRAWING", "action": "DRAW", "color": "BLUE", "target": "XML", "anchorMeasure": 15, "offsetX": 0.2, "offsetY": -0.1 }
   ```

4. **Kết Xuất Điểm Cắm (Target Render)**: Trình duyệt của mọi Học sinh phân tách luồng Payload, bốc tọa độ/điểm Neo và vẽ lại y hệt đường cọ trên thẻ `<canvas>` theo mốc 60 FPS (Không độ trễ). Áp lực xử lý Graphic đổ hoàn toàn về GPU của Clients.

Khi muốn xoá, Giáo viên bấm cục Tẩy, Payload `{"type": "DRAWING", "action": "CLEAR"}` được vứt đi, màn hình của mọi học trò lập tức sạch bách. Gọn gàng và cực kỳ tiết kiệm bộ nhớ phần cứng!

## 12. Cơ Chế Báo Hiệu Đa Phân Tầng (Multi-tier Presence Broadcasting)

Làm sao để một học sinh biết lỡ và nhảy vào lớp khi Thầy của mình đang Stream mà không cần đến sự hiện diện của Real-time WebSockets? Hạ tầng của ta thiết lập quy trình bao vây thông báo 3 tầng như sau:

1. **Hiển Thị Tĩnh Động Lưỡng Tính (SWR Polling UI)**:
   - Tại trang `/[locale]/dashboard/classrooms`: Frontend sử dụng SWR với thời gian làm tươi (Refresh Interval) là 15 giây để rà soát bảng DB `live_sessions`. 
   - Nếu phát hiện cột `endedAt` của phòng bằng NULL, Thẻ môn học (Classroom Card) sẽ ngay lập tức phồng lên một chiếc nhãn **🔴 LIVE** nhấp nháy đỏ chót. Học viên để treo máy cũng tự động thấy thẻ sáng lên.
   
2. **Kích Nổ Chuông Báo (In-App Database Notification)**:
   - Tại Server Action `createLiveSession()`, ngay sau khi ghi nhận lệnh Mở Camera, hệ thống đẻ tự động loạt Bản ghi (Records) bắn vào bảng `notifications` cho tất cả các cột `student_id` đang Subscribe lớp học.
   - Quả chuông trên Header UI của App nổ chấm đỏ rực, nhấn vào Link sẽ thả rơi học sinh xuống thẳng Route Live của phòng.

3. **Gửi Thư Triệu Tập (Resend Email Dispatch)**:
   - Nhờ được kết nối chặt với hạ tầng Email Resend, với những Lớp Học Phí Cao (VIP) hoặc Lớp 1-kèm-1, một thông báo Email cộp mác *"Thầy giáo vừa lên Live!"* được Dispatch vào hệ thống thư điện tử của sinh viên lúc bắt đầu Session, phòng trường hợp họ quên cắm mặt vào trang web! 

## 13. Khớp Luồng Cột Trụ Nhạc Nền (Backing Track Injection)

Một nan giải "Điển hình" khi chơi nhạc trực tuyến: Khóa học mở nhạc đệm (Backing Track dạng MP3/WAV) cho Thầy giáo đánh Solo guitar theo. Cần phải ngăn chặn triệt để chuyện "Đàn đi trước, nhạc cất bước theo sau" (Desync dội kênh).

**Sai Phầm Chết Người (Local Dual-Play)**: Nếu Học sinh TỰ CHƠI file Backing Track MP3 trên máy mình, và Thầy cũng tự chơi trên máy Thầy. Do độ trễ của Mic qua mạng khoảng 80ms, Học sinh nghe Nhạc Nền hiện tại, rồi cộng thêm tiếng Guitar của Thầy đến trễ (Bị lệch nhịp 80ms => Rớt nhịp hoàn toàn!).

**Giải Pháp Tuyệt Đối (Source Routing qua LiveKit)**: Định lý tối thượng của kiến trúc Audio Meeting Âm nhạc là: **Nhạc nền phải đồng hành cùng Nhạc cụ trên một hệ quy chiếu độ trễ**.
1. **Chụp Màng Âm (Capture Stream)**: Ứng dụng của Thầy sử dụng hàm `const mediaStream = audioRef.current.captureStream()` để chộp lấy luồng tín hiệu của thẻ phát nhạc Backing Track MP3 ngay tại lõi trình duyệt.
2. **Kênh Track Bí Mật**: Server LiveKit mở song song một luồng âm thanh phụ trợ bên cạnh Webcam Mic. Gọi luồng này là `ScreenShareAudio` hoặc định danh `BackingTrack_Audio`.
3. **Pha Trộn Hoàn Hảo**: Dữ liệu MP3 của Nhạc Nền sẽ chảy tuôn qua đường truyền P2P cùng lúc với tín hiệu Âm Thanh của Microphone (Đàn Guitar).
4. **Hưởng Thụ Phía Học Trò**: Học trò hoàn toàn không bật File MP3 dưới máy khách. Họ sẽ nghe cả Nhạc đệm và Tiếng đàn Thầy từ cùng một chiếc Cổng ra loa WebRTC của LiveKit. Do 2 âm thanh này cùng đến trễ chung 80ms => Mối quan hệ tương quan đồng bộ giữa chúng vẫn là Hoàn hảo 100%!


