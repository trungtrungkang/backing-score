# Kiến Trúc Hệ Thống V3 (System Architecture Overview)

Tài liệu này mô tả kiến trúc kỹ thuật của nền tảng, bao gồm các Module đã phát triển và các kế hoạch tích hợp tính năng quản lý khóa học. Nền tảng được xây dựng trên `Next.js 14` và sử dụng `Appwrite BaaS` cho cơ sở dữ liệu và xác thực.

---

## PHẦN 1: KIẾN TRÚC LÕI HIỆN TẠI (EXISTING CORE ENGINE)
Mô tả các thành phần xử lý âm thanh, đồ họa và tương tác cốt lõi đang hoạt động.

### 1. Module Hiển thị Đồ họa (Visual Rendering)
- **Verovio WebAssembly (`MusicXMLVisualizer.tsx`)**: 
  - Đảm nhiệm việc dựng đồ họa Vector (SVG) từ định dạng thư viện chuẩn `MusicXML`.
  - Tích hợp vòng lặp theo dõi tọa độ (Cursor Tracking). Component đồng bộ vị trí `currentPos` (ms) để tô sáng nốt nhạc/khuông nhạc hiện tại.
  - Hỗ trợ tính năng tự động cuộn (Auto-scroll) theo bản nhạc.

### 2. Module Âm thanh & Đồng bộ (Audio & Playback)
- **Tone.js & Cấu trúc MIDI AST (`PlayShell.tsx`)**:
  - Phân tích file `.musicxml` thành dữ liệu mảng thời gian (AST Arrays) cấp cho bộ đếm `Tone.Part`.
  - Sử dụng SoundFonts đa kênh làm nguồn âm thanh tổng hợp (synthesizer).
  - **Chức năng Mixer**: Cung cấp khả năng tắt tiếng (Mute) hoặc phát độc lập (Solo) cho từng track nhạc cụ để hỗ trợ tách lớp luyện tập.
  - **Chức năng Luyện tập**: Hỗ trợ tăng giảm tốc độ (BPM Playback Rate) và lặp đoạn (A-B Looping).
  - **Dịch Giọng (Audio Pitch Shifting)**: Sử dụng các `AudioNode` để thay đổi cao độ (pitch) của Backing Track và file MIDI.

### 3. Module Xử lý Tín hiệu Đầu Vào (Wait Mode API)
Tính năng Wait Mode dừng bản nhạc và chờ học viên đánh đúng nốt trước khi tiếp tục. Module này xử lý hai loại tín hiệu ngoại vi:
- **Tín hiệu MIDI (`useMidiInput.ts`)**: Kết nối qua Web MIDI API (`navigator.requestMIDIAccess`). Xử lý tín hiệu phím đàn và gỡ lỗi hợp âm thông qua cơ chế so sánh dữ liệu (Set Data).
- **Tín hiệu Audio/Acoustic (`useMicInput.ts`)**: 
  - Khởi tạo luồng Microphone, vô hiệu hóa `NoiseSuppression` và `EchoCancellation` do đặc thù nhận diện âm nhạc.
  - Tăng biên độ tín hiệu thu được với `GainNode (2.5x)`.
  - Phân tích tần số sử dụng thư viện YIN DSP, kết hợp với bộ đệm chống nhiễu loạn 250ms (`pitchTimersRef`).
  - Hỗ trợ khớp chuỗi các nốt đa nhịp điệu (Lenient Pattern Math) để bù đắp giới hạn Monophonic của thuật toán nhận diện.

### 4. Module Nền tảng Cộng đồng (Existing Community Layer)
Hệ thống tính năng social đang được xây dựng dựa trên **Next.js App Router** và SDK **Appwrite**. 
- **Project & Score Management (`src/app/p`, `lib/appwrite/projects.ts`)**: Quy trình CRUD để Creator quản lý, cập nhật thông tin bài hát và hiển thị trang chi tiết.
- **Playlist & Collection (`src/app/collection`, `lib/appwrite/playlists.ts`)**: Chức năng nhóm nhiều bài (Project) thành các danh sách phát (`ProjectActionsMenu.tsx`).
- **Newsfeed & Interactions (`src/app/feed`, `lib/appwrite/social.ts`)**: Giao diện hiển thị hoạt động mạng lưới, cho phép Favorite, Comment và Share.
- **Profiles & Dashboard (`src/app/u`, `src/app/dashboard`)**: Khu vực quản lý cá nhân cho User và Creator.

---

## PHẦN 2: KIẾN TRÚC PHÁT TRIỂN SẮP TỚI (LMS & EDTECH MODULES)
Tạo cầu nối giữa Core Engine với hệ quản lý khóa học (LMS).

### 1. Trình Soạn Thảo Tích Hợp Nhạc (Tiptap Integration)
Hệ thống **Creator Studio** dự kiến tích hợp **Tiptap (ProseMirror)** làm công cụ soạn văn bản rich-text.
- Cung cấp môi trường soạn thảo cho Giảng viên.
- Mở rộng Tiptap bằng một `NodeViewWrapper` mang tên `MusicSnippetNode`.
- Cho phép nhúng ID của đoạn nhạc tĩnh hoặc Wait Mode trực tiếp vào bài viết. Output sẽ được lưu dưới dạng JSON schema.

### 2. Tái cấu trúc UX/UI Module Chơi Nhạc (UI Split)
Cả hai phân hệ Mạng xã hội và Học tập đều sử dụng **Core Engine (Phần 1)**. Giao diện người dùng sẽ được điều chỉnh tùy ngữ cảnh:
- **Tách Logic Âm Nhạc (`useScoreEngine.ts`)**: Trừu tượng hóa Logic vận hành khỏi Giao diện. Engine trở thành Hook cung cấp States và Methods độc lập.
- **UI `<PlayShell>` (Dành cho Explore/Community)**: Giao diện đầy đủ hiển thị toàn màn hình, bao gồm Cột điều khiển Mixer, tùy chỉnh Tempo và Looping.
- **UI `<SnippetPlayer>` (Dành cho Khóa Học)**: Giao diện tối giản thiết kế riêng cho Tiptap node. Ẩn các công cụ thao tác phức tạp. Chỉ giữ lại phần lõi hiển thị 1-2 khuông nhạc, nút Play, và chế độ Wait Mode tích hợp Micro/MIDI ghi nhận tiến độ.

### 3. Cấu trúc Quản lý Khóa Học (Curriculum Manager)
Đảng cấp quản trị Khóa học và Bài giảng dành cho Creator:
- **Course List (`/dashboard/courses`)**: Quản trị dữ liệu Meta (Tiêu đề, ảnh bìa, danh mục) của Khóa học.
- **Curriculum Manager (`/dashboard/courses/[courseId]/edit`)**: Giao diện định tuyến lộ trình (`1 Course -> N Lessons`). Quản lý vị trí thứ tự, thêm mới, hoặc ẩn/hiện Bài học.
- **Lesson Editor (`/dashboard/courses/creator?lessonId=XXX`)**: Môi trường soạn thảo Tiptap, chỉ cập nhật duy nhất thuộc tính văn bản (Rich-Text Content) của một Bài học cụ thể.

---

## PHẦN 3: KIẾN TRÚC CƠ SỞ DỮ LIỆU (APPWRITE SCHEMA)
Sử dụng **Next.js Server Actions** để giao tiếp thông qua API **Appwrite**.

### 1. Nhóm Dữ liệu Mạng Xã Hội (Community Collections)
- **`Projects` / `Scores`**: Thông tin bài hát (ID, Title, `fileMusicXmlId`, `backingTrackAudioId`). Permission: User có quyền Đọc; Admin/Creator có quyền Ghi.
- **`Playlists`**: Bộ sưu tập danh sách phát do người dùng định nghĩa, gom nhóm các `Scores`.
- **`Posts`**: Dòng trạng thái (Status) chứa thông báo trên Newsfeed. 
- **`Interactions`**: Dữ liệu tương tác (`Likes`, `Comments`). Sử dụng ID tham chiếu đa hình (`targetId` nối với Score, Playlist, hoặc Post).

### 2. Nhóm Dữ liệu Khóa Học (EdTech Collections)
- **`Courses`**: Dữ liệu đại diện của khóa học (Giá, Tác giả, Avatar).
- **`Lessons`**: Các bài học trực thuộc Course. Chứa trường lưu JSON Output của Tiptap Editor. Nội dung JSON có thể chứa reference ID trỏ về Collection `Scores`.

### 3. Nhóm Dữ Liệu Thanh Toán & Tiến Độ (Progress Layer)
- **`Enrollments`**: Liên kết User đánh dấu quyền truy cập Khóa học (Role mapping).
- Cập nhật tiến độ `Progress` thông qua Server Action bảo mật khi Client báo cáo đã hoàn thành thành công `evaluateWaitModeToken()`.

---

## PHẦN 4: THÚC ĐẨY THƯƠNG MẠI & PHÂN QUYỀN (COMMERCE & ROLES)
Giai đoạn đầu, Khóa học được tích hợp bởi đội ngũ. Hệ thống dự kiến vận hành luồng cấp phép qua Stripe (hoặc các cổng tương tự).

1. **Khởi tạo Sản Phẩm**: Khóa học hoặc Gói Thuê bao (Subscription) được cấu hình trên Stripe Dashboard và ánh xạ ID với DB.
2. **Giao dịch**: Next.js Server Action khởi tạo `CheckoutSession`.
3. **Webhooks**: Stripe gửi thông báo phản hồi thanh toán thành công về `/api/webhooks/stripe`.
4. **Cấp quyền**: Appwrite Admin SDK thiết lập Document mới trong `Enrollments` tương ứng hoặc thiết lập cờ `Subscription` có hạn cho User ID.
5. **Truy Cập**: Mở khóa Middleware chặn nội dung của `Lessons`.
