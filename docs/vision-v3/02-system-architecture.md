# Phân Tích Thiết Kế Hệ Thống V3 (Comprehensive System Architecture)

Tài liệu này là bản thiết kế kỹ thuật **Toàn Cảnh (Master Blueprint)**, mô tả chi tiết cả những tính năng lõi **Đã phát triển hiện tại (Existing Core)** và những hệ thống **Sắp sửa tích hợp (Upcoming EdTech)**, đảm bảo toàn bộ nền tảng hoạt động nhất quán, không xung đột trên kiến trúc `Next.js 14` và `Appwrite BaaS`.

---

## PHẦN 1: KIẾN TRÚC LÕI HIỆN TẠI (EXISTING CORE ENGINE)
Đây là trái tim của nền tảng Âm nhạc, đã được xây dựng và đang vận hành ổn định. Lõi này hoạt động ẩn danh (Headless) và có nền tảng toán học khắt khe.

### 1. Engine Hiển thị Đồ họa (Visual Rendering)
- **Verovio WebAssembly (`MusicXMLVisualizer.tsx`)**: 
  - Thành phần cốt lõi dịch chuẩn `MusicXML` sang đồ họa Vector (SVG).
  - Tích hợp vòng lặp đếm tọa độ (Cursor Tracking). Khi chạy, Component liên tục lắng nghe `currentPos` (Thời gian Ms) và chiếu ánh lên bản đồ SVG, bôi đậm nốt nhạc/khuông nhạc hiện tại thành màu Cam.
  - Hỗ trợ cuộn tự động (Auto-scroll) mượt mà giữ nguyên tỉ lệ khuôn nhạc gốc.

### 2. Engine Âm thanh & Đồng bộ (Audio & Playback)
- **Tone.js & Bảng MIDI AST (`PlayShell.tsx`)**:
  - Dịch file `.musicxml` thành chuỗi các sự kiện thời gian thực (AST Arrays) cấp cho `Tone.Part`.
  - Giả lập thư viện nhạc cụ bằng bộ SoundFonts đa kênh.
  - **Tính năng Điều chỉnh âm thanh (Mixer)**: Hệ thống cho phép Mute (Tắt tiếng) hoặc Solo (Phát độc lập) từng Nhạc cụ riêng biệt để luyện tập (Track Isolation).
  - **Tính năng Luyện tập**: Cho phép chỉnh Tốc độ đếm nhịp (BPM Playback Rate) và Lặp đoạn (A-B Looping) bằng cách bôi đen quãng cần chơi.
  - **Dịch Giọng (Audio Pitch Shifting)**: Sử dụng các `AudioNode` để điều chỉnh tần số của Backing Track và file MIDI lên/xuống Tone một cách linh hoạt.

### 3. Engine Tương tác Phần Cứng trực tiếp (Wait Mode API)
Đây là "Vũ khí bí mật" của hệ thống, giúp bản nhạc *Tạm dừng và Chờ* người chơi đánh đúng nốt trước khi chạy tiếp. Code xử lý được tách thành 2 module giao tiếp ngoại vi:
- **Ngõ vào MIDI (`useMidiInput.ts`)**: Kết nối Cáp qua `navigator.requestMIDIAccess`. Phân giải tín hiệu Velocity và phím đàn thành Set Data. Trình chấm điểm hoàn toàn tách biệt 2 luồng Trái/Phải (Track Isolation) để chấm hợp âm đàn Piano phức tạp chính xác 100%.
- **Ngõ vào Acoustic (`useMicInput.ts`)**: 
  - Giao tiếp thẻ Sound Card nội mảng tắt `NoiseSuppression` và `EchoCancellation` cản trở dải âm thanh Piano.
  - Booster chèn `GainNode (2.5x)` làm khuếch đại tín hiệu thô.
  - Vượt qua YIN DSP (Convolution) bằng thuật toán Buffer chống chập chờn 250ms (`pitchTimersRef`).
  - Cắt gộp nốt đa nhịp điệu (Lenient Pattern Math) để vượt qua giới hạn Monophonic vật lý của Thuật toán bắt âm.

### 4. Engine Mạng Xã Hội Âm Nhạc (Existing Community & Social Ecosystem)
Hệ thống mạng xã hội đồ sộ này *đã xây dựng thành công* trên kiến trúc **Next.js App Router** và SDK **Appwrite**. Bao gồm các Module đang chạy thực tế trong mã nguồn:
- **Project & Score Management (`src/app/p`, `lib/appwrite/projects.ts`)**: Luồng CRUD cho phép các Creator đẩy bài hát, gán Meta data, và render trang chi tiết nghe nhạc.
- **Playlist & Collection (`src/app/collection`, `lib/appwrite/playlists.ts`)**: Chức năng Gom nhóm nhiều Project thành các Danh sách phát cá nhân (`ProjectActionsMenu.tsx`).
- **Newsfeed & Interactions (`src/app/feed`, `lib/appwrite/social.ts`)**: Bảng tin hoạt động không gian mạng, tích hợp Thả Tim (Favorites), Comment và Chia sẻ liên kết.
- **Profiles & Dashboard (`src/app/u`, `src/app/dashboard`)**: Trang cá nhân thu thập thành tích người dùng và trạm điều khiển của Creator.

---

## PHẦN 2: KIẾN TRÚC PHÁT TRIỂN SẮP TỚI (UPCOMING EDTECH MODULES)
Thiết lập Kiến trúc Sản xuất Nội dung, nối Core Engine hiện tại vào trong một Cổng thông tin Khóa học.

### 1. Kiến trúc Trình Soạn Bài Text-to-Music (Tiptap Integration)
Hệ thống **Creator Studio** sẽ sử dụng **Tiptap (ProseMirror)** làm trình gõ văn bản Rich-Text.
- Giáo viên có không gian viết Lý thuyết (như MS Word/Notion).
- Tiptap được lập trình cài đặt một `NodeViewWrapper` đặc biệt mang tên: `MusicSnippetNode`.
- Khi gõ phím tắt/nhấn nút, Giáo viên có thể nhúng trực tiếp Data của Core Engine (Từ Phần 1) lọt vào giữa 2 dòng văn bản. Output trả ra là một chuỗi mã JSON sạch sẽ.

### 2. Tái Cấu Trúc Giao Diện Âm Nhạc (The UI Headless Split)
Cả Khóa học (EdTech) lẫn Mạng xã hội (Community) đều dùng chung **Core Engine (Phần 1)**. Tuy nhiên, hình hài của chúng sẽ khác nhau để tránh Conflict trải nghiệm:
- **Tách Logic Rời Rạc (`useScoreEngine.ts`)**: Bóc tách chức năng chạy nhạc ra khỏi giao diện Nút bấm. Biến nó thành 1 Hook âm thầm cung cấp dữ liệu.
- **UI `<PlayShell>` (Cho Mạng xã hội)**: Giao diện Khổng lồ ôm trọn màn hình, có Cột Mixer, Thanh trượt Tempo, và Ô Lặp đoạn.
- **UI `<SnippetPlayer>` (Cho Khóa Học Tiptap)**: Giao diện Nhỏ Xíu nằm gọn trong Text. Giấu tiệt mọi Menu chức năng rườm rà. Chỉ hiện Tờ nhạc được co rút (Zoom In), nút Play, và Nút [Bật Wait Mode] để học trò thổi Microphone. Cả hai đều mương chung dòng máu `useScoreEngine`.

### 3. Kiến Trúc Quản Lý Giáo Trình (Curriculum Builder & Manager)
Giải quyết triệt để vấn đề "1 Khóa học chứa nhiều Bài Giảng", giao diện phần mềm dành cho Creator được bóc tách định tuyến quy củ thành 3 phân hệ:
- **Course List (`/dashboard/courses`)**: Cổng điều hướng và Khởi tạo Siêu dữ liệu `Course` (Đóng vai trò như việc tạo ra cái Bìa cuốn sách).
- **Curriculum Manager (`/dashboard/courses/[courseId]/edit`)**: Trạm trung chuyển và Quản trị Lộ trình học tập (`1-to-N`). Cho phép Creator Thêm mới, Xóa, Sửa và Sắp xếp vị trí của vô số `Lesson` Document nằm dưới trướng 1 `Course` Document.
- **Lesson Editor (`/dashboard/courses/creator?lessonId=XXX`)**: Trình Tiptap Studio được hạ cấp và tái sử dụng dưới dạng Quản lý Đơn phân tử, phục vụ duy nhất 1 mục đích là cập nhật trường dữ liệu Rich-Text `contentRaw` cho 1 Bài học cục bộ.

---

## PHẦN 3: CƠ SỞ DỮ LIỆU BAAAS (APPWRITE NOSQL SCHEMA)
Sử dụng **Next.js Server Actions** giao tiếp với **Appwrite**. Cấu trúc CSDL phân rã (Relational References) chống phình băng thông:

### 1. Bộ Sưu Tập Mạng Xã Hội Âm Nhạc (Community Layer)
*Lưu dữ liệu cho UI `<PlayShell>` và Hệ sinh thái Mạng xã hội của User.*
- **Collection `Projects / Songs` (Scores)**: Bài hát do Creator tải lên (ID, Tiêu đề, Appwrite `fileMusicXmlId`, `backingTrackAudioId`). Tích hợp cờ bảo mật: Admin/Creator có quyền Ghi. User thường có quyền Đọc.
- **Collection `Playlists`**: Bộ sưu tập danh sách phát. Cho phép User tự do gom nhiều `Songs` lại thành một Album luyện tập riêng (VD: "Tuyển tập Piano Tân Nhạc").
- **Collection `Posts` (Hoạt động Không gian mạng)**: 
  - Creator có thể tạo "Bài Đăng" (Status) đính kèm 1 bản nhạc mới để thông báo cho người theo dõi (Followers). 
  - Hệ thống cũng tự Auto-generate Post khi học viên hoàn thành xuất sắc 1 khóa học khó.
- **Collection `Interactions` (Tương Tác Xã Hội)**: Cấu trúc đa hình (Polymorphic). Lưu trữ toàn bộ `Likes`, `Comments`, `Shares`. Mỗi document chứa `targetId` (Trỏ tới ID của Song, Playlist, hoặc Post) và `userId`.

### 2. Bộ Sưu Tập Khóa Học Tương Tác (EdTech Layer)
*Lưu dữ liệu cho UI `<SnippetPlayer>`.*
- **Collection `Courses`**: (Thông tin tổng quát khóa học, Giá thẻ thanh toán hiển thị Stripe, Ảnh bìa, Thông tin Giảng Viên).
- **Collection `Lessons`**: (ID Khóa Học, Thứ tự bài học). Chứa cột `contentJson` là đoạn Output của Tiptap Editor. Đoạn mã này có lưu Sẵn cái ID Trỏ ngược về cái Bài hát đang hot ở bảng `Scores`. Nối Mạng xã hội vào Khóa Học thành 1 vòng tròn khép kín.

### 3. Bộ Sưu Tập Thanh Toán & Gamification (Progress Layer)
- **Collection `Enrollments`**: Ghi nhận Student nào đã Đăng ký/Thanh toán Khóa học nào (Quan hệ N-N).
- `uploadCourseScore()`: (Dành cho Creator) Gọi thẻ API lên Up file MusicXML vào Storage. Trả về `FileID` nén vào Block Editor.
- `evaluateWaitModeToken()`: Ngay khi User cầm Mic thổi sáo thành công, `SnippetPlayer` nổ Animation xong sẽ gọi Action này. Server Action kết nối với Appwrite Admin SDK (Key chìm) Insert `true` vào `Progress` Collection của User đó.
- `fetchPillarSchedules()`: SSR load trang Course chi tiết, đọc JSON, map `SnippetPlayer` ID ra thành HTML trực tiếp tăng tốc độ SEO.

---

## PHẦN 4: KIẾN TRÚC THANH TOÁN (PAYMENT & SUBSCRIPTION MODEL)
Đây là nguồn sống của Hệ thống. Ở giai đoạn Phase 1, Creator là **Cộng tác viên** đóng góp Khóa học cho Hệ thống. Hệ thống (Platform) sẽ thu tiền trực tiếp từ Học viên qua **Stripe** (Hoặc ZaloPay/Momo).

**Luồng Thanh toán Gói Cước (The Subscription & Sales Loop):**
1. **Khởi tạo (Catalog)**: Hệ thống định giá Khóa Học lẻ (VD: 50.000đ) và Gói Thuê Bao Subscription (VD: 200.000đ/tháng Unlocked Full).
2. **Giao dịch (Checkout)**: Học sinh bấm nút "Mua lẻ" hoặc "Đăng ký Gói Tháng". Frontend Next.js gọi hàm Server Action `createCheckoutSession(courseId | planId)`. Server gửi Request lên Stripe tạo phiên và trả về URL thanh toán. Học sinh bị văng ra trang nhập Thẻ Tín Dụng.
3. **Lắng nghe (Webhook)**: Học sinh quẹt thẻ thành công (hoặc Stripe tự động trừ tiền gia hạn tháng kế tiếp). Stripe dội ngược 1 tín hiệu POST về Endpoint `/api/webhooks/stripe` của Next.js.
4. **Mở khóa (Fulfillment)**: Server Next.js xác thực Chữ ký Stripe hợp lệ -> Dùng **Appwrite Admin Key** (Tuyệt mật) chạy Logic:
   - Nếu mua lẻ: Chèn 1 dòng vào `Enrollments` với nội dung `[StudentID: A, CourseID: B, Status: PAID]`.
   - Nếu mua Subscription: Thay đổi Cờ trong User Profile: `[StudentID: A, SubscriptionTerm: 30/12/2026]`.
5. **Truy cập**: Học sinh quay lại Web, Giao diện check thấy Cờ `PAID` (hoặc User đang có Subscription còn hạn), lập tức mở khoá CÁC Lesson bài học để tiến vào Wait Mode.

---

## TỔNG KẾT BẢO TỒN NỀN TẢNG (Strategic Conclusion)
Bằng cách trừu tượng hóa (Abstracting) các `useMidiInput`, `useMicInput`, `math.ts`, `Verovio` hiện có thành Headless Hooks, chúng ta **Không đập bỏ bất cứ một dòng code nào bạn đã viết**. Mọi tính năng cực khó hiện tại (Pitch Shifting, Mixer) vẫn hiển diện uy lực trên Mạng xã hội `PlayShell`, nhưng nằm im tinh tế phía dưới giao diện Học Thuật của `Tiptap SnippetPlayer` một cách hoàn hảo và độc lập tuyệt đối!
