# Danh Mục Tính Năng V3 (Feature Matrix & Core Ecosystem Setup)

Tài liệu này liệt kê toàn bộ cấu trúc tính năng Nền tảng V3 dựa sát trên Mã nguồn (Source Code) thực dụng, chia theo 3 Lớp Xương Sống và chỉ ra phương pháp **Headless Architecting** nhằm giúp chúng không bao giờ tự "giẫm chân" gây ra lỗi trên giao diện.

---

## 1. LAYER AUDIO TRUNG TÂM (CORE ENGINE - NO UI)
*Bộ phận cơ bắp không lộ diện ra ngoài, được gọi qua Hook `useScoreEngine()`.*

- **MusicXML Visual Render Engine (`MusicXMLVisualizer.tsx`)**: Chuyển đổi siêu nhanh SVG bằng Verovio WASM + Sync Tracking Tool.
- **Tone.js SoundFonts Core**: Chuyển đổi nhạc cụ thời gian thực (MIDI AST Parsing), Trộn Mixer đa kênh, Lặp A-B và Dịch Tone (Pitch Shifting).
- **Phần Cứng Đĩa (Wait Mode API)**:
  - Wait Mode MIDI (Tách tay 100% không kẹt track qua Native Listeners).
  - Wait Mode Acoustic (Mic YIN + Auto Merge Lenient đa tracks + Trễ tín hiệu 250ms Booster).

---

## 2. LAYER MẠNG XÃ HỘI (THE COMMUNITY PILLAR)
*Trung tâm lưu giữ chân người dùng. Chạy trên Layout Full Page diện tích rộng của Next.js + Appwrite.*

- **Dashboard / Studio Up Tải (`app/dashboard`)**: (Chỉ Admin/Creator) Upload Score qua Server actions lưu Appwrite Bucket.
- **Trình Diễn Nhạc Chuyên Dụng (`PlayShell.tsx`)**: Giao diện ôm trọn màn hình, bám chặt Layer 1 để nhét đủ hàng chục nút bấm (Solo/Mute Mixer, Tempo Slider) phục vụ nhu cầu dân học đàn Hardcore.
- **Quản Trị Dự Án & Bộ Sưu Tập (`lib/appwrite/projects.ts` & `playlists.ts`)**: 
  - Khởi tạo Single Tracks.
  - Tổ chức Thư mục Nhạc cá nhân qua Playlists (Component `ProjectActionsMenu.tsx`).
- **Tương Tác Xã Hội - Social Engine (`app/feed` & `lib/appwrite/social.ts`)**:
  - Scrolling Newsfeed.
  - Bọc cấu trúc Đa Hình (Polymorphic) xử lý thao tác `Likes/Favorites`, `Shares`, `Comments` bắn chéo vào mọi Object.
  - User Profiles (`app/u`) lưu trữ thành tựu.

---

## 3. LAYER HỌC VIỆN & TIPTAP EDTECH (THE COURSE PILLAR)
*Mô-đun sắp phát triển, sử dụng giao diện nhỏ giọt, chèn lẫn lộn giữa Văn bản lý thuyết.*

- **Hệ Thống Phân Phối (Marketplace)**: Thanh Toán (Enrollment Stripe), Lọc Khóa Học do Creator ủy quyền, Trình xem cấu trúc Chương, Bài.
- **Trình Viết Mã Trực Quan (Tiptap Content Builder)**:
  - Hỗ trợ Headings, Bullet List, Đoạn văn bản (Notion-like).
  - Component nhúng Extension tự thiết kế `<musicSnippetNode>`. Import mã Truy xuất cực lẹ (Lấy chính ID Bài hát bên Layer 2 thẩy sang làm Bài thực hành).
- **Trình Chạy Mini Wait Mode (`SnippetPlayer.tsx`)**: Gọi lõi `useScoreEngine()` nhưng Tắt Mute Mixer, Xóa AB Looping... Chỉ còn lại bảng Nhạc và Nút Mic. Không chiếm dụng quá 800px.
- **Trình Chấm Điểm Tuyệt Mật (Progress Controller)**:
  - API Action Backend: Khước từ chấm điểm Client. Tách riêng Module gọi `isCompleted = true` về DB khi nhận cờ (Flag) từ YIN Audio.
  - Liên thông chéo: Đẩy Data lên lại Feed (Layer 2) để mọi người chúc mừng học viên!

---

## KIỂM ĐỊNH SỰ XUYÊN THẤU VÀ XUNG ĐỘT (Conflict Analysis Validation)

**ĐIỂM GIAO THOA HOÀN MỸ (Tránh Crash App)**
- **UI KHÔNG XUNG ĐỘT**: `<SnippetPlayer>` và `<PlayShell>` là 2 lớp Da bọc ở ngoài tách biệt vật lý. Dù ta nhét chức năng Mixer nặng nề vào `<PlayShell>` thì thằng em nhỏ `<SnippetPlayer>` đang nằm khép nép giữa dòng chữ Blog Tiptap của khóa học cũng không phình to giao diện ra và làm vỡ cấu trúc bài học.
- **THỰC THỂ KHÔNG XUNG ĐỘT**: Nhờ tính năng **Playlist** và **Projects** đã sẵn có, Hệ thống không phải lưu đúp 2 lần file `Score` vào Khóa học. Thay vào đó Tiptap chỉ lưu 1 chuỗi tham chiếu ID cực ngắn `scoreId=$x`. Toàn bộ dữ liệu nằm ở Appwrite an toàn và không gây trùng lặp Data.
- **NETWORK BAY BỔNG**: Server Actions của Next.js chọc thẳng vào Appwrite SDK, giải phóng Tiptap khỏi băng thông Fetch. Tốc độ chuyển sinh thái đạt mốc phi thường.
