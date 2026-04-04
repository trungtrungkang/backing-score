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

