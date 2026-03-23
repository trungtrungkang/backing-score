# Danh Mục Tính Năng V3 (Feature Matrix & Core Ecosystem Setup)

Tài liệu này liệt kê cấu trúc tính năng nền tảng V3 dựa trên mã nguồn (Source Code), phân chia theo 3 lớp hạ tầng (Layers) và mô tả cách vận hành **Headless Architecture**.

---

## 1. LAYER AUDIO TRUNG TÂM (CORE ENGINE - NO UI)
*Module lõi chuyên xử lý dữ liệu và âm thanh, được gọi thông qua Hook `useScoreEngine()`.*

- **MusicXML Visual Render Engine (`MusicXMLVisualizer.tsx`)**: Thành phần biên dịch vector SVG từ tài liệu MusicXML thông qua Verovio WASM kết hợp công cụ đồng bộ tọa độ (Sync Tracking Tool).
- **Tone.js SoundFonts Core**: Chuyển đổi siêu dữ liệu thành sự kiện thời gian thực (MIDI AST Parsing), hỗ trợ Mixer đa kênh, lặp đoạn (A-B Looping) và tùy chỉnh cao độ (Pitch Shifting).
- **Phân hệ Tương tác (Wait Mode API)**:
  - Tín hiệu MIDI: Lắng nghe input vật lý từ cáp nối qua các Native Listeners.
  - Tín hiệu Audio: Sử dụng Microphone với thuật toán YIN, kết hợp bộ đệm tín hiệu (250ms) để xử lý dữ liệu Acoustic mượt mà.

---

## 2. LAYER MẠNG XÃ HỘI (THE COMMUNITY PILLAR)
*Trung tâm tương tác người dùng, triển khai trên các layout chính của Next.js kết hợp Appwrite BaaS.*

- **Dashboard / Studio (`app/dashboard`)**: Khu vực quản lý (Admin/Creator) thực hiện tải lên tập tin Score thông qua Server Actions.
- **Trình Diễn Nhạc Chuyên Dụng (`PlayShell.tsx`)**: Giao diện tổng hợp hiển thị toàn màn hình, sử dụng Layer 1 để cung cấp đầy đủ các tiện ích như Solo/Mute Mixer, Tempo Slider cho nhu cầu tập luyện chi tiết.
- **Quản Trị Dự Án & Bộ Sưu Tập (`lib/appwrite/projects.ts` & `playlists.ts`)**: 
  - Khởi tạo Single Tracks.
  - Tổ chức thư viện cá nhân thông qua Playlists (`ProjectActionsMenu.tsx`).
- **Tương Tác Xã Hội - Social Engine (`app/feed` & `lib/appwrite/social.ts`)**:
  - Newsfeed hiển thị cập nhật bài hát và hoạt động của cộng đồng.
  - Cấu trúc đa hình (Polymorphic) xử lý thao tác Interactions (Likes, Comments, Shares) cho nhiều loại đối tượng (User/Project/Post).
  - User Profiles (`app/u`) thống kê lịch sử tương tác và bài học hoạt động.

---

## 3. LAYER HỌC VIỆN & EDTECH (THE COURSE PILLAR)
*Hệ thống quản lý khóa học LMS, phân phối thông qua giao diện văn bản và nội dung tương tác.*

- **Hệ Thống Phân Phối (Marketplace)**: Xây dựng quy trình thanh toán (Stripe/Enrollment), danh sách khóa học, và khung truy cập dữ liệu chương bài.
- **Trình Soạn Thảo (Tiptap Content Builder)**:
  - Giao diện text editor hỗ trợ định dạng rich-text cơ bản (Headings, Bullet List).
  - Cung cấp Extension tự thiết kế `<musicSnippetNode>`. Cho phép import một ID bài hát (Score) từ Layer 2 sang bài thực hành trong nội dung lý thuyết.
- **Trình Chạy Mini Wait Mode (`SnippetPlayer.tsx`)**: Kế thừa logic từ `useScoreEngine()` nhưng sử dụng UI tinh gọn, được giới hạn trong một container hẹp. Khóa các tính năng Mixer hoặc AB Looping để học viên tập trung vào bài tập hiện tại.
- **Trình Chấm Điểm & Tiến Độ (Progress Controller)**:
  - Tiến hành xác thực hoàn thành bài qua Server Actions kết nối với Database. Biến trạng thái `isCompleted` được bảo mật.
  - Khả năng liên thông sự kiện (Event Hook) đưa thông tin học viên hoàn thành lên Activity Feed ở Layer 2.

---

## PHÂN TÍCH TƯƠNG THÍCH (Architecture Modularity)

**Quản lý Phân định Trách nhiệm (Separation of Concerns):**
- **Độc Lập Giao Diện (UI Isolation)**: `SnippetPlayer` và `PlayShell` là hai UI component sử dụng hai trạng thái trình bày riêng biệt nhưng chia sẻ cùng một Core Engine API (`useScoreEngine`). Cập nhật tính năng Mixer trong `PlayShell` sẽ không làm ảnh hưởng đến cấu hình của `SnippetPlayer`.
- **Tối Ưu Hóa Bộ Nhớ (Data Normalization)**: Dữ liệu bài nhạc (Score) được tải lên và lưu trữ một lần. Khi Creator tích hợp bài vào một khóa học thông qua Editor, trình Tiptap chỉ lưu một id tham chiếu ngắn. Cấu trúc này giảm tải lưu trữ kép.
- **Tối Ưu Giao Tiếp (Client-Server Request)**: Hạn chế rò rỉ dữ liệu hoặc fetch payload lớn bằng cách tích hợp Server Actions. Môi trường Editor làm việc trực tiếp với SDK phía backend (Appwrite).
