# Tài liệu mô tả tính năng hệ thống Backing & Score

Tài liệu này mô tả các nhóm tính năng của ứng dụng web **Backing & Score** theo góc nhìn sản phẩm và vận hành, đối chiếu với mã nguồn tại thời điểm biên soạn. Đường dẫn URL trong tài liệu dùng tiền tố `/{locale}/...` (ví dụ `en`, `vi`).

---

## 1. Tổng quan

**Mục đích:** Backing & Score là ứng dụng **Web DAW + Live** — hỗ trợ chơi nhạc nền (backing), làm việc với bản nhạc kỹ thuật số, sắp xếp và biểu diễn trong trình duyệt. Lõi phát nhạc và ký hiệu dựa trên gói **musicxml-player** (SpessaSynth, Verovio, MIDI, timemap đồng bộ con trỏ).

**Đối tượng sử dụng:**

- Người chơi nhạc / học viên: luyện tập với điểm số, thử thách, khóa học, lớp học.
- Người tạo nội dung (creator): dự án nhạc, playlist, khóa học (khi có quyền).
- Giáo viên / quản lý lớp: lớp học, bài tập, chấm bài, tài liệu.
- Đội vận hành: wiki âm nhạc, duyệt nội dung, nội dung nổi bật (admin / content manager / wiki editor).

**Stack kỹ thuật (tóm tắt):**

| Thành phần | Vai trò |
|------------|---------|
| Next.js (App Router) | Giao diện, API routes, Server Actions |
| Appwrite | Xác thực, cơ sở dữ liệu, lưu trữ file |
| Cloudflare R2 (qua API `api/r2/*`) | Upload / tải / migrate file |
| Lemon Squeezy | Thanh toán, webhook đăng ký |
| `@music-i18n/musicxml-player` | Phát MusicXML, render bản nhạc |

---

## 2. Tài khoản, đăng nhập và quyền

### 2.1 Xác thực

- **Đăng ký / đăng nhập** email–mật khẩu: `/{locale}/signup`, `/{locale}/login`.
- **OAuth:** Google (hàm `loginWithOAuth` trong `AuthContext` dùng provider `google`).
- **Xác minh email:** `/{locale}/verify` sau khi đăng ký.
- **Phiên:** Trình duyệt giữ session Appwrite; không có bảo vệ route ở middleware Next — các trang nhạy cảm (ví dụ admin) kiểm tra quyền phía client và chuyển hướng khi cần.

### 2.2 Vai trò (RBAC)

Vai trò lưu dưới dạng **nhãn (labels)** trên user Appwrite. Các helper trong `src/lib/auth/roles.ts`:

| Nhãn | Ý nghĩa ngắn gọn |
|------|------------------|
| `admin` | Quyền cao nhất; quản trị đầy đủ |
| `contentmanager` | Quản lý nội dung (cùng nhóm quyền admin cho nhiều thao tác) |
| `creator` | Được tạo dự án / nội dung mới |
| `wikieditor` | Chỉnh sửa wiki (kết hợp với admin theo quy tắc helper) |

**Hành vi chính:**

- `canAccessAdmin` / `canManageContent`: `admin` hoặc `contentmanager` (truy cập `/admin/*`, quản lý dự án–tập hợp rộng).
- `canCreate`: `admin`, `contentmanager`, hoặc `creator`.
- `canEditWiki`: `admin` hoặc `wikieditor`.

### 2.3 Gói dịch vụ (billing)

Độc lập với nhãn vai trò. Sau khi đăng nhập, client gọi `GET /api/subscription?userId=...` và gán **service tier**: `free` | `pro` | `studio`. Một số màn hình (ví dụ trình phát) hiển thị **nâng cấp** khi tính năng yêu cầu gói trả phí.

---

## 3. Dự án (project) — trọng tâm sản phẩm

### 3.1 Trình chỉnh sửa

- **Route:** `/{locale}/p/[projectId]`
- **Chức năng:** Chỉnh sửa metadata dự án, tải lên file (MusicXML / luồng DAW), xem trước với thành phần như `MusicXMLVisualizer`, shell chỉnh sửa (`EditorShell`).

### 3.2 Chế độ chơi (play-along)

- **Route:** `/{locale}/play/[projectId]`
- **Chức năng (PlayShell):** Điều khiển phát; hiển thị ký hiệu; bàn phím ảo; hiệu chỉnh micro (`MicCalibrationWizard`, `useMicProfile`); ghi âm (`useAudioRecorder`); **chấm điểm** (`useScoreEngine`); gamification (lễ kỷ niệm XP); yêu thích; chia sẻ; đếm lượt phát; giao diện tối/sáng.

### 3.3 Phiên live

- **Route:** `/{locale}/live/[projectId]` — phiên biểu diễn / live gắn với một dự án.

### 3.4 Nhúng (embed)

- **Route:** `/{locale}/embed` — player tối giản cho nhúng iframe; thường kèm tham số dự án (ví dụ `?p=`).

### 3.5 Chia sẻ & SEO

- **Route:** `/{locale}/s` — trang chia sẻ với metadata Open Graph.
- Dự án công khai có thể được khám phá từ Discover (mục 4).

**Dữ liệu:** Collection `projects` và bucket `uploads` (Appwrite); logic trong `src/lib/appwrite/projects.ts`, `upload.ts`.

---

## 4. Khám phá, playlist và hồ sơ

### 4.1 Discover

- **Route:** `/{locale}/discover`
- Duyệt dự án đã xuất bản, playlist, bộ lọc, mục yêu thích (khi đã đăng nhập).

### 4.2 Collection (playlist)

- **Route:** `/{locale}/collection/[playlistId]` — xem tập / playlist.
- **Cài đặt:** `/{locale}/collection/[playlistId]/settings`

### 4.3 Hồ sơ người dùng

- **Route:** `/{locale}/u/[userId]` — trang hồ sơ công khai.

**Dữ liệu:** `playlists`, `favorites` và các thao tác trong `playlists.ts`, `favorites.ts`.

---

## 5. Feed xã hội

- **Luồng:** `/{locale}/feed`
- **Chi tiết bài:** `/{locale}/feed/post/[postId]`

**Chức năng:** Bài viết, bình luận, phản ứng, theo dõi; thông báo; báo cáo nội dung (moderation).

**Dữ liệu:** `posts`, `comments`, `reactions`, `follows`, `notifications`, `reports` — `src/lib/appwrite/social.ts`, `notifications.ts`, `reports.ts`.

---

## 6. Wiki âm nhạc

- **Hub:** `/{locale}/wiki`
- **Danh mục & chi tiết (slug):**
  - Nghệ sĩ: `wiki/artists`, `wiki/artists/[slug]`
  - Tác phẩm: `wiki/compositions`, `wiki/compositions/[slug]`
  - Thể loại: `wiki/genres`, `wiki/genres/[slug]`
  - Nhạc cụ: `wiki/instruments`, `wiki/instruments/[slug]`

**Đa ngôn ngữ:** Bản dịch thực thể wiki qua `wikiTranslations.ts` và collections wiki trong Appwrite.

**Tìm kiếm:** API `POST/GET` tùy triển khai tại `api/wiki-search`.

**Quản trị wiki:** `/{locale}/admin/wiki` (người có quyền `canEditWiki` / admin).

---

## 7. Dashboard người dùng

- **Tổng quan:** `/{locale}/dashboard` — dự án, playlist, thư mục dự án (`project-folders`).
- **Tham gia lớp bằng mã:** `/{locale}/dashboard/join` — nhập mã; gọi `joinClassroom`; xử lý mã dạng `INV-` (kích hoạt) vs mã khác (chờ duyệt) theo logic trang.
- **Yêu thích:** `/{locale}/dashboard/favorites`
- **Bộ sưu tập:** `/{locale}/dashboard/collections`
- **Phân tích:** `/{locale}/dashboard/analytics`

### Khóa học (phía creator)

- **Danh sách:** `/{locale}/dashboard/courses`
- **Không gian creator:** `/{locale}/dashboard/courses/creator`
- **Sửa khóa học:** `/{locale}/dashboard/courses/[courseId]/edit`

---

## 8. Khóa học & bài học (học viên)

- **Cổng khóa học:** `/{locale}/c/[courseId]` — `CourseGatewayClient` (điều kiện đăng ký / truy cập).
- **Bài học:** `/{locale}/c/[courseId]/[lessonId]` — `LessonGuardClient`, `LessonActiveClient` (bảo vệ và trạng thái bài học).

**Dữ liệu:** Collections `courses`, `enrollments`, `lessons`, `progress` — `courses.ts`, `lessons.ts`.

---

## 9. Sheet music, PDF và setlist

- **Hub PDF:** `/{locale}/dashboard/pdfs`
- **Danh sách setlist:** `/{locale}/dashboard/pdfs/setlists`
- **Chi tiết setlist:** `/{locale}/dashboard/pdfs/setlist/[id]`
- **Sửa setlist:** `/{locale}/dashboard/pdfs/setlist/[id]/edit`
- **Xem PDF:** `/{locale}/dashboard/pdfs/view/[id]`

**Chức năng:** Tải PDF bản nhạc, thư mục, thumbnail, yêu thích, “mở gần đây”, **bản đồ điều hướng** (nav maps) trên bản nhạc, **setlist** (danh sách mục JSON).

**API:** `api/sheet-music/[id]`; bucket `sheet_pdfs`.

---

## 10. Lớp học (classroom)

- **Danh sách / trung tâm:** `/{locale}/classroom`
- **Tạo lớp:** `/{locale}/classroom/create`
- **Tham gia bằng mã (URL):** `/{locale}/classroom/join/[code]`
- **Chi tiết lớp:** `/{locale}/classroom/[id]`
- **Giao bài:** `/{locale}/classroom/[id]/assign`
- **Bài tập:** `/{locale}/classroom/[id]/assignment/[aid]`

**Chức năng:** Thành viên, mời, mã lớp; bài tập; nộp bài (kèm recording nếu có); phản hồi giáo viên; tài liệu lớp (chia sẻ sheet vào lớp).

**Dữ liệu:** `classrooms`, `classroom_members`, `classroom_invites`, `assignments`, `submissions`, `submission_feedback`, `classroom_materials`; bucket `classroom_recordings` khi có ghi âm.

---

## 11. Gamification

- **API:** `api/gamification/session`, `api/gamification/daily-challenge`
- **Logic:** `gamification.ts` — XP, cấp, session luyện tập; `daily-challenge.ts` — thử thách hằng ngày (chọn dự án publish theo ngày).
- **UI:** Ví dụ `GamificationCelebration` trên trình phát sau session.

**Dữ liệu:** `practice_sessions`, `user_stats`, `platform_config`.

---

## 12. Thanh toán và đăng ký

- **Checkout:** `api/checkout`
- **Đồng bộ đăng ký:** `api/subscription`, `api/subscription/sync`
- **Webhook:** `api/webhooks/lemonsqueezy`

**Dữ liệu:** `products`, `purchases`, `entitlements`; đồng bộ gói qua `subscriptions.ts` và trạng thái hiển thị trong `AuthContext`.

---

## 13. Trang marketing và hướng dẫn

- **Trang chủ:** `/{locale}/` (`page.tsx`)
- **Giới thiệu:** `/{locale}/about`
- **Bảng giá:** `/{locale}/pricing`
- **Hướng dẫn:** `/{locale}/guide`, `/{locale}/user-guide`

---

## 14. Admin

- **Trung tâm:** `/{locale}/admin`
- **Nổi bật (featured):** `/{locale}/admin/featured`
- **Duyệt nội dung:** `/{locale}/admin/review`
- **Import:** `/{locale}/admin/import`
- **Wiki:** `/{locale}/admin/wiki`

**Server Actions:** `src/app/actions/admin.ts` và các action trong `src/app/actions/` (thông báo, tiến độ, wiki, v.v.).

---

## 15. API và tích hợp phụ trợ

Các route handler chính dưới `src/app/api/` (mô tả theo mục đích vận hành):

| API | Mục đích |
|-----|----------|
| `import-musicxml`, `import-musicxml/preview` | Nhập / xem trước MusicXML |
| `ai-enrich` | Làm giàu metadata hoặc nội dung bằng AI (theo triển khai) |
| `wiki-search` | Tìm kiếm wiki |
| `sheet-music/[id]` | Truy cập metadata / luồng sheet theo id |
| `files/[fileId]` | Truy cập file |
| `r2/upload`, `r2/download/[fileId]`, `r2/migrate` | Lưu trữ đối tượng trên R2 |
| `reports` | Báo cáo / kiểm duyệt |
| `gamification/*` | Xem mục 11 |
| `checkout`, `subscription`, `subscription/sync`, `webhooks/lemonsqueezy` | Xem mục 12 |

**Server Actions** (không liệt kê hết): quản trị, thông báo, tiến độ, bài nộp, phản hồi, wiki, user — dùng cho thao tác server an toàn từ UI.

---

## 16. Đa ngôn ngữ và SEO

- **Locale:** `en`, `vi`, `zh-CN`, `zh-TW`, `es`, `fr`, `de`, `ja`, `ko` — cấu hình `src/i18n/routing.ts`.
- **Bản dịch:** Thư mục `messages/*.json`; `en.json` làm nền, locale khác ghi đè (merge sâu trong `getRequestConfig`).
- **Middleware:** `next-intl` gắn locale vào URL.
- **SEO:** `src/app/sitemap.ts`, `robots.ts`, `wiki-sitemap` (theo cấu hình dự án).

---

## Phụ lục A — Bảng tra cứu route → mô tả ngắn

| Route (sau `/{locale}/`) | Mô tả ngắn |
|---------------------------|------------|
| `(root)` | Trang chủ / landing |
| `about` | Giới thiệu |
| `pricing` | Bảng giá |
| `login` | Đăng nhập |
| `signup` | Đăng ký |
| `verify` | Xác minh tài khoản / email |
| `discover` | Khám phá nội dung |
| `feed` | Feed xã hội |
| `feed/post/[postId]` | Chi tiết bài viết |
| `p/[projectId]` | Chỉnh sửa dự án |
| `play/[projectId]` | Chơi nhạc / play-along |
| `live/[projectId]` | Phiên live |
| `embed` | Player nhúng |
| `s` | Trang chia sẻ (OG) |
| `collection/[playlistId]` | Xem playlist |
| `collection/[playlistId]/settings` | Cài đặt playlist |
| `u/[userId]` | Hồ sơ người dùng |
| `wiki` | Hub wiki |
| `wiki/artists`, `wiki/artists/[slug]` | Nghệ sĩ |
| `wiki/compositions`, `wiki/compositions/[slug]` | Tác phẩm |
| `wiki/genres`, `wiki/genres/[slug]` | Thể loại |
| `wiki/instruments`, `wiki/instruments/[slug]` | Nhạc cụ |
| `guide`, `user-guide` | Hướng dẫn |
| `dashboard` | Bảng điều khiển người dùng |
| `dashboard/join` | Tham gia lớp bằng mã (từ dashboard) |
| `dashboard/favorites` | Yêu thích |
| `dashboard/collections` | Bộ sưu tập |
| `dashboard/analytics` | Phân tích |
| `dashboard/courses` | Khóa học |
| `dashboard/courses/creator` | Không gian creator khóa học |
| `dashboard/courses/[courseId]/edit` | Sửa khóa học |
| `dashboard/pdfs` | Hub PDF / sheet |
| `dashboard/pdfs/setlists` | Danh sách setlist |
| `dashboard/pdfs/setlist/[id]` | Chi tiết setlist |
| `dashboard/pdfs/setlist/[id]/edit` | Sửa setlist |
| `dashboard/pdfs/view/[id]` | Xem PDF |
| `c/[courseId]` | Cổng khóa học |
| `c/[courseId]/[lessonId]` | Bài học |
| `classroom` | Danh sách lớp |
| `classroom/create` | Tạo lớp |
| `classroom/join/[code]` | Tham gia lớp qua URL mã |
| `classroom/[id]` | Chi tiết lớp |
| `classroom/[id]/assign` | Giao bài |
| `classroom/[id]/assignment/[aid]` | Chi tiết bài tập |
| `admin` | Trang admin |
| `admin/featured` | Nội dung nổi bật |
| `admin/review` | Duyệt nội dung |
| `admin/import` | Import |
| `admin/wiki` | Quản trị wiki |

---

## Phụ lục B — Thuật ngữ kỹ thuật (đối chiếu nhanh)

| Thuật ngữ | Ghi chú |
|-----------|---------|
| Project | Một “bài / tác phẩm” làm việc trong editor + player |
| Play-along | Chế độ vừa phát vừa luyện (mic, điểm số) |
| Playlist / Collection | Tập hợp dự án hoặc mục được sắp xếp |
| Service tier | `free` / `pro` / `studio` — gói trả phí |
| Appwrite labels | Chuỗi vai trò trên user (`admin`, …) |

---

*Tài liệu được sinh từ cấu trúc mã nguồn trong repository `backing-and-score`. Không có route `academy` trong tree hiện tại; tính năng có thể thay đổi theo từng phiên bản.*
