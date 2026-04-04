# Yêu Cầu và Đặc tả Kiến Trúc Cơ Bản

Nền tảng đào tạo lớp nhóm và 1-1 lấy âm nhạc làm trung tâm. Cung cấp chức năng truyền dẫn Audio-Video theo kiến trúc SFU (Selective Forwarding Unit) dựa trên nền tảng LiveKit, để tránh hiện tượng dội âm và tiết kiệm băng thông tối đa. Đặc biệt, tích hợp hệ thống đồng bộ hoá tự động Player PDF/MusicXML giữa máy chủ phòng (Host - Giáo viên) và khán thính giả (Học sinh).

## 1. Các Vai Trò Tham Gia Trong Phòng (Actor Roles)

> [!IMPORTANT]
> Cốt lõi của mô hình phòng học âm nhạc là tránh độ nhiễu loạn tiếng ồn (Cacophony). Nhất là khi nhiều nhạc cụ phát ra cùng lúc với độ trễ khác nhau.

- **Teacher (Host):**
  - Có toàn quyền chia sẻ Video, Audio tĩnh (`canPublish: true`).
  - Phân phát tín hiệu toạ độ MusicXML Sync (`DataMessage`) mỗi khi lật trang, dời nhịp hoặc bấm nút Metronome.
  - Được trao quyền năng Quản trị: Có thể cấp quyền, thu hồi Microphone hoặc Spot-light Video của bất kì cá nhân học viên nào.
- **Student (Participant):**
  - Mặc định: Phân quyền `canSubscribe` = true và `canPublishData` = false. Video của học sinh có thể truyền tải nhưng phần Âm Thanh (Audio) bị gắt ngầm, độc lập trên từng endpoint của các học sinh khác.
  - Về mặt giao diện UI, MusicXML Player của học sinh sẽ bị "Chốt cứng" với tín hiệu từ Host. Nó chịu sự điều phối của hệ thống Bù Trễ Kỹ Thuật Số (Jitter Buffer Offset) để diễn ra đồng bộ hoàn hảo với Audio từ giáo viên.
  - Chức năng Giơ Tay (Raise Hand). Khi giáo viên gọi kiểm tra, Token của học sinh sẽ được Escalate lên quyền Broadcast Audio tới toàn lớp học.

## 2. Thiết Kế Cơ Sở Dữ Liệu Bổ Sung (Database Schema Extension)

Mở rộng cấu trúc học thuật hiện có (LMS) nằm ở `src/db/schema/classroom.ts` để lưu vết dữ liệu sử dụng cho tính năng Call.

### 2.1 Bảng `live_sessions` (Lưu Vết Phòng Học)
Lưu trữ trạng thái vòng đời của một cuộc gọi được kích hoạt trong Classroom.

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const liveSessions = sqliteTable("live_sessions", {
  id: text("id").primaryKey(), // ID định danh phiên livestream ngẫu nhiên
  classroomId: text("classroom_id").notNull(), // Trỏ về Classroom tương ứng
  hostId: text("host_id").notNull(), // Ai là Teacher chủ trì
  startedAt: integer("started_at", { mode: 'timestamp' }).notNull(),
  endedAt: integer("ended_at", { mode: 'timestamp' }), // Sẽ mang giá trị Null nếu cuộc gọi đang diễn ra
  activeProjectContext: text("active_project_id"), // Bài nhạc (MusicXML/PDF) hiện Host đang bật
  recordingUrl: text("recording_url") // Cloud url nếu tích hợp module lưu Egress Record sau này
});
```

### 2.2 Bảng `live_attendances` (Sổ tay Điểm Danh)
Ghi chép log ra/vào của học viên.

```typescript
export const liveAttendances = sqliteTable("live_attendances", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  studentId: text("student_id").notNull(),
  joinedAt: integer("joined_at", { mode: 'timestamp' }).notNull(),
  leftAt: integer("left_at", { mode: 'timestamp' }),
  durationSeconds: integer("duration_seconds").default(0)
});
```

## 3. Thiết Kế Các Luồng Kỹ Thuật (Engineering Pipelines)

### 3.1. Phân Phối Mã Truy Cập JWT An Toàn
- LiveKit bắt buộc mọi người dùng phải có 1 mã Access/JWT Token để đăng nhập vào WebRTC Gateway của họ.
- Chúng ta sẽ thiết kế một hàm Server Actions trong `src/app/actions/v5/livekit.ts` tên là `generateJoinToken(classroomId: string)`.
- Khi UI học sinh gọi lên, Backend chạy Query để đảm bảo ID của họ thuộc về nhóm `classroom_members`. Sau khi Pass, Backend gọi `AccessToken()` từ bộ SDK `livekit-server-sdk` và bọc ID lại đẩy trả về cho Client. Token chỉ cấp hiệu lực tĩnh khoảng 4 tiếng.

### 3.2. Payload Đồng Bộ Màn Hình Âm Nhạc (Music Sync Engine)

Toàn bộ quá trình đồng bộ đi qua đường truyền `Data Channel` P2P, sử dụng Socket băng thông siêu hẹp.

**Định dạng Payload chuẩn của hệ thống:**
```json
{
  "type": "CURSOR_SYNC",
  "measure": 42,
  "beat": 1,
  "playing": true,
  "tempo": 120,
  "timestamp": 1714555023945
}
```

**Kỹ thuật Khớp Độ Trễ Bù Trừ (Desync Offset Mitigation):**
1. Giáo viên nhấn Nhạc cụ / Chạy play.
2. Máy Client của Thầy gửi JSON đi tức tốc thông qua `room.localParticipant.publishData(payload)`.
3. Client của học sinh sẽ dò sóng để chẩn đoán độ trễ truyền thanh: `audioTrack.getRTCStats().jitterBufferDelay`. Giả sử hệ thống đang bị lag khoảng 120ms.
4. Giao diện MusicXML trên trình duyệt của Thầy không gọi hàm *Scroll* tức thì. Giao diện sẽ treo một `setTimeout(action, 120ms)` trước khi bẻ góc con trỏ. Mắt và Tai của học viên sẽ đạt trạng thái Sync hoàn hảo.

### 3.3. Xử lý các Tình Huống Ngoại Lệ (Edge-Cases)
- **Học Sinh Trễ Mạng Cục Bộ (Thoát/Vào lại phòng đột ngột):**
  - Payload gửi dọc đường có thể bị Miss/Drop.
  - Giải pháp: Định kỳ (Tick-rate) chạy nền. Cứ mỗi 5 giây, Teacher Client sẽ tự động đẩy lại một gói Sync đầy đủ `Keep-alive states`. Học trò mới cắm Router mạng vào lại sẽ nhận gói Sync mới nhất.
- **Giáo viên Tắt Micro Nhưng Học Sinh Vẫn Chơi Đàn:**
  - Track Media và Track Data của WebRTC tách biệt độc lập với nhau. Nếu Thầy tắt Mic (Muted), dữ liệu đồng bộ nốt nhạc vẫn tuôn chảy mà không bị gãy vỡ. Việc dạy học theo hệ Offline (Tập câm điếc dựa vào nhịp gõ metronome hình học) vẫn diễn ra trơn tru.
- **Giáo viên Rớt Mạng Đột Ngột (Reconnection & Session Crash Resilience):**
  - Tránh tình trạng hệ thống vội vã kết thúc Lớp học và tạo ra vô số các `sessionId` rác khi thầy rớt Wifi. Khi Teacher kết nối lại (`createLiveSession`), Backend sẽ quét xem lớp này có phiên nào vừa chạy cách đây vài giờ và chưa bị đóng (Ended) hay không. Nếu có, Backend sẽ **Tái sử dụng (Resume)** đúng mã UUID của phiên đó để bảo toàn mảng dữ liệu Điểm danh (live_attendances). Về sau, Việc đánh dấu phòng "Thật sự Kết thúc" sẽ do tín hiệu Webhook tĩnh `room_finished` từ cụm LiveKit quyết định.

## 4. UI / UX Design Phác Thảo
- **Floating / Picture-in-Picture UI**: Layout MusicXML dọc hoặc ngang chiếm 70% trang màn hình. Giao diện LiveKit được thiết kế trôi bồng bềnh dưới dạng "Video bong bóng" hoặc bám cố định một dải nhỏ bên mép Trái (Sidebar).
- **Control Bar Mở Rộng**: Cạnh nút `Play | Coda | Repeats` mặc định của PDF Player sẽ có thêm bộ biểu tượng: `Microphone`, `Camera`, `Share Track`, `Raise Hand`.
