# Backing & Score — Đặc Tả Tính Năng Sản Phẩm

**Phiên bản:** 4.0 (Public Beta)  
**Cập nhật lần cuối:** 2026-03-27  
**Nền tảng:** Web (Next.js) & Responsive trên di động  
**Backend:** Appwrite (Cơ Sở Dữ Liệu, Xác Thực, Lưu Trữ)

---

## Mục Lục

1. [Tổng Quan Kiến Trúc](#1-tổng-quan-kiến-trúc)
2. [Hệ Thống Xử Lý Âm Thanh (Audio Engine)](#2-hệ-thống-xử-lý-âm-thanh-audio-engine)
3. [Hệ Thống Biên Soạn Nội Dung (Editor)](#3-hệ-thống-biên-soạn-nội-dung-editor)
4. [Trình Phát Tương Tác (Player)](#4-trình-phát-tương-tác-player)
5. [Wait Mode — Cơ Chế Đánh Giá Thực Hành](#5-wait-mode--cơ-chế-đánh-giá-thực-hành)
6. [Khám Phá & Thư Viện Nội Dung](#6-khám-phá--thư-viện-nội-dung)
7. [Học Viện (Module EdTech)](#7-học-viện-module-edtech)
8. [Tính Năng Xã Hội & Cộng Đồng](#8-tính-năng-xã-hội--cộng-đồng)
9. [Bảng Điều Khiển & Quản Lý Dự Án](#9-bảng-điều-khiển--quản-lý-dự-án)
10. [Phiên Cộng Tác Trực Tuyến (Live)](#10-phiên-cộng-tác-trực-tuyến-live)
11. [Trình Phát Nhúng (Embed)](#11-trình-phát-nhúng-embed)
12. [Đa Ngôn Ngữ (i18n)](#12-đa-ngôn-ngữ-i18n)
13. [Xác Thực & Hồ Sơ Người Dùng](#13-xác-thực--hồ-sơ-người-dùng)
14. [Bách Khoa Toàn Thư Âm Nhạc ✅](#14-bách-khoa-toàn-thư-âm-nhạc-)
15. [Thanh Toán & Thuê Bao](#15-thanh-toán--thuê-bao)
16. [Thông Báo](#16-thông-báo)
17. [Tính Năng Dự Kiến — Phân Tích Nâng Cao](#17-tính-năng-dự-kiến--phân-tích-nâng-cao)
18. [Tính Năng Dự Kiến — Học Tập Thích Ứng](#18-tính-năng-dự-kiến--học-tập-thích-ứng)

---

## 1. Tổng Quan Kiến Trúc

Backing & Score là một nền tảng âm nhạc tương tác được xây dựng trên kiến trúc xử lý nặng phía client. Hệ thống ủy thác các tác vụ xử lý tín hiệu âm thanh tốn tài nguyên tính toán cho thiết bị người dùng (trình duyệt), trong khi server chỉ đảm nhiệm lưu trữ dữ liệu và xác thực người dùng.

**Ngăn xếp công nghệ:**

| Tầng | Công nghệ |
|---|---|
| Framework Frontend | Next.js (App Router, Server Components) |
| Giao diện | Tailwind CSS + shadcn/ui |
| Backend / BaaS | Appwrite (Database, Auth, Storage, Functions) |
| Lưu trữ Media | Appwrite Storage (tương lai: Cloudflare R2) |
| Xử lý Âm thanh | Web Audio API + WebMIDI API (phía client) |
| Soạn thảo Rich Text | Tiptap (nền ProseMirror) với extension tùy chỉnh |
| Ký hiệu Âm nhạc | Phân tích MusicXML + renderer SVG tùy chỉnh |
| Triển khai | Vercel (Frontend) + Appwrite Cloud/Tự host |

**Các Collection dữ liệu (Appwrite):**

| Collection | Chức năng |
|---|---|
| `projects` | Bản nhạc, phối khí, và sheet thực hành |
| `playlists` | Bộ sưu tập dự án do người dùng tạo |
| `favorites` | Đánh dấu yêu thích dự án và playlist |
| `courses` | Metadata khóa học Học Viện |
| `lessons` | Bài học riêng lẻ trong khóa học |
| `posts` | Bài đăng trong Feed Cộng đồng |
| `comments` | Bình luận trên bài đăng |
| `reactions` | Biểu cảm / thích trên bài đăng, bình luận, dự án |
| `follows` | Quan hệ theo dõi giữa người dùng |
| `wiki_artists` | Mục bách khoa nhạc sĩ / nhà soạn nhạc |
| `wiki_instruments` | Mục bách khoa nhạc cụ |
| `wiki_compositions` | Mục bách khoa tác phẩm âm nhạc |
| `wiki_genres` | Mục bách khoa thể loại nhạc |
| `wiki_translations` | Bản dịch theo field cho nội dung wiki |

---

## 2. Hệ Thống Xử Lý Âm Thanh (Audio Engine)

Đây là yếu tố khác biệt cốt lõi của nền tảng. Toàn bộ phân tích âm thanh chạy hoàn toàn trên thiết bị người dùng, không cần kết nối server.

### 2.1 Đầu vào Microphone (`useMicInput`)
- Thu âm thời gian thực qua `navigator.mediaDevices.getUserMedia()`
- Nhận diện cao độ (pitch) dựa trên phép biến đổi FFT sử dụng `AnalyserNode` của Web Audio API
- Thuật toán tự tương quan (autocorrelation) để trích xuất tần số cơ bản
- Có thể cấu hình tần suất lấy mẫu (sample rate) và kích thước cửa sổ FFT
- Ngưỡng cổng nhiễu (noise gate) để loại bỏ tạp âm môi trường

### 2.2 Đầu vào MIDI (`useMidiInput`)
- Tích hợp WebMIDI API cho bàn phím MIDI phần cứng / controller
- Phân tích sự kiện Note-On / Note-Off
- Hỗ trợ độ nhạy lực nhấn phím (velocity)
- Định tuyến MIDI đa kênh

### 2.3 Score Engine (`useScoreEngine`)
- Hook điều phối trung tâm, đồng bộ các thành phần:
  - Phát nhạc đệm (backing tracks đa nhạc cụ)
  - So sánh thời gian thực giữa cao độ phát hiện được và nốt nhạc kỳ vọng
  - Logic tiến trình bản nhạc (di chuyển con trỏ khi đàn đúng)
  - Cơ chế tạm dừng / tiếp tục của Wait Mode
  - Tính toán độ chính xác nhịp phách
  - Tạo điểm đánh giá và phản hồi cho người dùng

---

## 3. Hệ Thống Biên Soạn Nội Dung (Editor)

Một phiên bản DAW tối giản (Digital Audio Workstation) chạy trên trình duyệt, cho phép người sáng tạo xây dựng nội dung âm nhạc tương tác mà không cần kỹ năng lập trình.

### 3.1 Editor Shell (`EditorShell`)
- Không gian làm việc dự án đầy đủ với timeline, danh sách track, và thanh điều khiển phát lại
- Ba chế độ dự án:
  - **Practice** — sheet thực hành đơn nhạc cụ kèm nhạc đệm
  - **Arrange** — không gian phối khí đa track
  - **Chart** — chế độ bảng hợp âm / lead sheet

### 3.2 Trình Soạn Thảo Rich Text (`TiptapEditor`)
- Trình soạn thảo rich text nền ProseMirror (framework Tiptap)
- Extension tùy chỉnh để nhúng đoạn nhạc tương tác
- Các khối nội dung: văn bản, tiêu đề, hình ảnh, ký hiệu nhạc, video embed
- Sẵn sàng xuất bản cho nội dung bài học Học Viện

### 3.3 Trình Hiển Thị MusicXML (`MusicXMLVisualizer`)
- Phân tích và hiển thị file MusicXML dưới dạng bản nhạc tương tác (SVG)
- Tô sáng từng nốt đồng bộ với con trỏ phát lại
- Hỗ trợ hiển thị đa bè (multi-voice)
- Co giãn linh hoạt theo kích thước màn hình

### 3.4 Hệ Thống Đa Track (`TrackList`)
- Thêm / xóa track nhạc cụ
- Điều khiển từng track: âm lượng, cân bằng trái-phải (pan), tắt tiếng (mute), solo
- Hiển thị dạng sóng (waveform) theo từng track
- Tải lên file âm thanh cho mỗi track (qua Appwrite Storage)

### 3.5 Thanh Điều Khiển Phát Lại (`TransportBar`)
- Nút Phát / Tạm dừng / Dừng / Lặp lại
- Điều chỉnh nhịp độ (BPM)
- Bật / tắt máy nhịp (metronome)
- Kéo thanh trượt vị trí phát lại
- Bật / tắt Wait Mode

### 3.6 Các Thành Phần Editor Bổ Sung

| Thành phần | Chức năng |
|---|---|
| `PianoRollRegion` | Hiển thị nốt nhạc kiểu piano roll (MIDI) |
| `TimelineRuler` | Thước đo nhịp / phách theo timeline với chức năng zoom |
| `Waveform` | Hiển thị dạng sóng âm thanh cho mỗi track |
| `MeasureMapEditor` | Chỉnh sửa nhịp và cấu trúc ô nhịp |
| `GamificationProvider` | Context provider cho dữ liệu chuỗi ngày luyện tập / điểm / thành tích |
| `ProjectSelectorModal` | Modal để chèn dự án hiện có thành đoạn nhạc nhúng |

---

## 4. Trình Phát Tương Tác (Player)

Giao diện phát lại dành cho người dùng cuối, phục vụ luyện tập với nội dung đã xuất bản.

### 4.1 Snippet Player (`SnippetPlayer`)
- Trình phát nhúng, độc lập cho từng đoạn nhạc riêng lẻ
- Sử dụng bên trong bài học Học Viện và trang Khám Phá
- Điều khiển: phát, tạm dừng, điều chỉnh nhịp độ, bộ trộn track
- Phản hồi trực quan: tô sáng nốt nhạc, thanh tiến trình

### 4.2 Trình Phát Toàn Màn Hình (`PlayShell` + `PlayerControls`)
- Môi trường luyện tập toàn màn hình (`/play/[projectId]`)
- Bảng trộn âm thanh (mixer) đa track
- Kích hoạt đầu vào Microphone / MIDI
- Bật/tắt Wait Mode với chỉ báo trực quan
- Bảng thống kê hiệu suất luyện tập

---

## 5. Wait Mode — Cơ Chế Đánh Giá Thực Hành

Tính năng đặc trưng giúp phân biệt Backing & Score với các nền tảng phát lại thụ động.

### 5.1 Cơ Chế Hoạt Động
1. Người dùng kích hoạt Wait Mode trên bất kỳ bản nhạc nào
2. Toàn bộ nhạc đệm (backing tracks) bị tắt tiếng
3. Con trỏ bản nhạc di chuyển theo từng nốt
4. Tại mỗi vị trí nốt, hệ thống **tạm dừng** và **chờ** người dùng phát ra cao độ chính xác qua Microphone hoặc MIDI
5. Hệ Thống Nhận Diện Cao Độ xác thực đầu vào theo thời gian thực:
   - Cao độ chính xác (trong ngưỡng dung sai cấu hình được) → con trỏ tiến tới
   - Cao độ sai hoặc im lặng → con trỏ giữ nguyên vị trí
6. Khi hoàn thành một đoạn nhạc, hệ thống tạo báo cáo thống kê tổng hợp

### 5.2 Thông Số Kỹ Thuật
- Dung sai cao độ: cấu hình được (mặc định ±50 cent)
- Độ trễ mục tiêu: < 20ms từ âm thanh đến nhận diện
- Nguồn đầu vào: Microphone (nhạc cụ analog, giọng hát) hoặc MIDI (keyboard số)
- Xử lý: hoàn toàn phía client (Web Audio API)

### 5.3 Nền Tảng Sư Phạm
Wait Mode triển khai mô hình **Thực Hành Có Chủ Đích** (Deliberate Practice):
- Phản hồi sửa lỗi tức thời
- Bắt buộc chính xác trước khi tiến trình
- Củng cố trí nhớ cơ bắp (Muscle Memory) thông qua lặp lại
- Không có chế độ "tự chạy" — yêu cầu tham gia chủ động

---

## 6. Khám Phá & Thư Viện Nội Dung

### 6.1 Trang Khám Phá (`/discover`)

Trang Discover sử dụng **giao diện phân loại theo mục** (tương tự Spotify/Netflix) với các section cuộn ngang:

| Mục | Icon | Nguồn dữ liệu | Sắp xếp |
|---|---|---|---|
| **Nổi bật** | ⭐ | Admin chọn (`featured=true`) | `featuredAt` giảm dần |
| **Mới thêm gần đây** | 🆕 | Tất cả project đã publish | `publishedAt` giảm dần |
| **Thịnh hành** | 🔥 | Lượt phát cao | `playCount` giảm dần |
| **Được yêu thích nhất** | 🔖 | Nhiều favorite nhất | `favoriteCount` giảm dần |
| **Bộ sưu tập** | 📚 | Playlist đã publish | Mới nhất |
| **Tất cả bản nhạc** | 📖 | Grid đầy đủ + bộ lọc | Nhiều tùy chọn sắp xếp |

**Chiến lược chống trùng lặp:** Các bài Featured chỉ hiện ở section Featured, tự động loại khỏi các section khác. Các section còn lại có thể có bài trùng.

**Khi tìm kiếm:** Các section được ẩn, chỉ hiện grid "Tất cả bản nhạc" với kết quả tìm kiếm.

**Component tái sử dụng:** `HorizontalScroll` — container cuộn ngang hỗ trợ cảm ứng, snap cuộn, mũi tên điều hướng tự ẩn và gradient mờ dần ở 2 đầu.

### 6.2 Bộ Sưu Tập / Playlist (`/collection/[playlistId]`)
- Bộ sưu tập dự án do người dùng tạo
- Hiển thị công khai hoặc riêng tư
- Danh sách dự án có thứ tự kèm ảnh bìa

### 6.3 Chi Tiết Dự Án (`/p/[projectId]`)
- Hiển thị đầy đủ metadata dự án
- Trình phát nhúng xem trước
- Liên kết đến hồ sơ tác giả
- Hành động: Yêu thích / Thêm vào Playlist
- Chia sẻ / Nhúng
- "Sao chép về Dự án của tôi" để phối lại (tạo bản sao riêng tư)

---

## 7. Học Viện (Module EdTech)

### 7.1 Danh Mục Khóa Học (`/academy`)
- Danh sách khóa học với bộ lọc danh mục
- Thẻ khóa học: tiêu đề, người tạo, cấp độ, miễn phí / có phí
- Nút đăng ký

### 7.2 Chi Tiết Khóa Học & Bài Học (`/c/[courseId]`)
- Thanh bên điều hướng bài học (cấu trúc tuần tự)
- Nội dung bài học hiển thị qua `TiptapViewer`
- Thành phần `SnippetPlayer` nhúng trong nội dung bài học
- Cổng yêu cầu thực hành: một số bài học yêu cầu hoàn thành Wait Mode để mở khóa bài tiếp theo
- Theo dõi tiến trình theo từng người dùng

### 7.3 Tạo Khóa Học (Bảng Điều Khiển)
- Creator xây dựng khóa học qua Bảng Điều Khiển (`/dashboard/courses`)
- Trình soạn thảo bài học: rich text + chèn đoạn nhạc
- Metadata khóa học: tiêu đề, mô tả, cấp độ, giá bán
- Bật / tắt xuất bản

---

## 8. Tính Năng Xã Hội & Cộng Đồng

### 8.1 Bảng Tin (`/feed`)
- Dòng thời gian hiển thị bài đăng từ người dùng đang theo dõi
- Loại bài đăng: văn bản, đính kèm dự án, đính kèm playlist
- Biểu cảm (thích, emoji)
- Chuỗi bình luận

### 8.2 Hồ Sơ Người Dùng (`/u/[userId]`)
- Trang hồ sơ công khai
- Dự án, playlist, và khóa học đã xuất bản
- Theo dõi / Hủy theo dõi
- Số lượng người theo dõi và đang theo dõi

### 8.3 Mô Hình Dữ Liệu
- **Bài đăng (Posts):** nội dung văn bản, tùy chọn đính kèm (tham chiếu dự án hoặc playlist)
- **Bình luận (Comments):** văn bản liên kết với một bài đăng
- **Biểu cảm (Reactions):** đa hình (có thể gắn vào bài đăng, bình luận, dự án, playlist)
- **Theo dõi (Follows):** quan hệ một chiều follower→following

---

## 9. Bảng Điều Khiển & Quản Lý Dự Án

### 9.1 Trang Chính (`/dashboard`)
- Tổng quan dự án của người dùng (bản nháp và đã xuất bản)
- Nút thao tác nhanh: tạo dự án mới, mở trình soạn thảo

### 9.2 Quản Lý Dự Án
- Tạo dự án qua modal: tên, chế độ (practice/arrange/chart), thẻ tag
- Quy trình: chỉnh sửa, sao chép, xóa
- Quy trình xuất bản: đặt ảnh bìa, mô tả, thẻ tag → hiển thị công khai trên Discover
- Lọc theo thẻ tag

### 9.3 Các Mục Con

| Đường dẫn | Nội dung |
|---|---|
| `/dashboard/collections` | Quản lý playlist / bộ sưu tập |
| `/dashboard/courses` | Quản lý khóa học đã tạo |
| `/dashboard/favorites` | Xem nội dung đã đánh dấu yêu thích |

---

## 10. Phiên Cộng Tác Trực Tuyến (Live)

### 10.1 Live Shell (`/live/[projectId]`)
- Chỉnh sửa / xem dự án cộng tác thời gian thực
- Trạng thái phát lại đồng bộ giữa các người tham gia
- Tình huống sử dụng: dạy nhạc từ xa, luyện tập nhóm nhạc
- Trạng thái: **Triển khai giai đoạn đầu** — giao diện cốt lõi đã xây dựng, đồng bộ thời gian thực đang phát triển

---

## 11. Trình Phát Nhúng (Embed)

### 11.1 Trang Nhúng (`/embed`)
- Trình phát gọn nhẹ, tương thích iframe
- Dùng để nhúng đoạn nhạc tương tác vào trang web bên ngoài
- Giao diện tối giản (chỉ có nút điều khiển + bản nhạc)
- Tạo URL chia sẻ từ trang chi tiết dự án

---

## 12. Đa Ngôn Ngữ (i18n)

### 12.1 Các Ngôn Ngữ Hỗ Trợ (9)
| Mã | Ngôn ngữ |
|---|---|
| `en` | English |
| `vi` | Tiếng Việt |
| `fr` | Français |
| `de` | Deutsch |
| `es` | Español |
| `ja` | 日本語 |
| `ko` | 한국어 |
| `zh-CN` | 简体中文 |
| `zh-TW` | 繁體中文 |

### 12.2 Triển Khai
- Thư viện `next-intl` cho dịch thuật dựa trên message
- Định tuyến có tiền tố locale (`/[locale]/...`)
- Thành phần chuyển đổi ngôn ngữ trong header toàn cục
- Tất cả nhãn giao diện, nội dung trang, và hướng dẫn đều được dịch

---

## 13. Xác Thực & Hồ Sơ Người Dùng

### 13.1 Quy Trình Xác Thực
- Đăng ký bằng Email + mật khẩu (`/signup`)
- Xác minh email (`/verify`)
- Đăng nhập với quản lý phiên (`/login`)
- Nền tảng: Appwrite Auth (session cookies)

### 13.2 Bảng Quản Trị (`/admin`)
- Bảng điều khiển quản trị nền tảng
- Công cụ kiểm duyệt nội dung
- **Quản lý nội dung nổi bật** (`/admin/featured`) — bật/tắt cờ `featured` trên các project đã publish, có tìm kiếm và UI tối ưu
- **Làm giàu dữ liệu AI** (`/admin/review`) — tự động phân tích project bằng Gemini API
- **Nhập MusicXML hàng loạt** (`/admin/import`) — nhập nhiều bản nhạc từ file MusicXML
- **Wiki CMS** (`/admin/wiki`) — quản lý nội dung bách khoa toàn thư

---

## 14. Bách Khoa Toàn Thư Âm Nhạc ✅

> **Trạng thái:** Đã triển khai (Phase 2.5, 3, 6, 8) | Bản địa hóa nội dung: Đang thiết kế

### 14.1 Thực Thể Dữ Liệu (Appwrite Collections)

| Thực thể | Trường chính |
|---|---|
| `wiki_artists` | name, bio (rich text), birthDate, nationality, roles[], imageUrl, coverUrl, slug |
| `wiki_instruments` | name, family, description (rich text), tuning, range, origin, imageUrl |
| `wiki_compositions` | title, year, period, keySignature, tempo, difficulty, genreId, description (rich text), slug |
| `wiki_genres` | name, description (rich text), parentGenreId, era, slug |

### 14.2 Liên Kết Dự Án ↔ Thực Thể Wiki

Dự án có quan hệ trực tiếp với thực thể wiki qua các trường:

| Trường | Kiểu | Mô tả |
|---|---|---|
| `wikiGenreId` | string | ID thể loại (chọn 1) |
| `wikiInstrumentIds` | string[] | ID nhạc cụ (chọn nhiều) |
| `wikiCompositionId` | string | ID tác phẩm (chọn 1) |
| `wikiComposerIds` | string[] | ID nhà soạn nhạc (chọn nhiều) |

Các trường này thay thế hệ thống tag dạng text tự do cho phân loại thể loại/nhạc cụ. `tags[]` chỉ còn dùng cho cấp độ khó.

### 14.3 Bộ Chọn Tag (Editor)

Trình soạn thảo dự án (`EditorShell`) có bộ chọn tag dạng tab với 5 danh mục:

| Tab | Emoji | Kiểu chọn | Tìm kiếm |
|---|---|---|---|
| Nhạc cụ | 🎹 | Chọn nhiều | ✅ |
| Thể loại | 🎵 | Chọn một | — |
| Tác phẩm | 📄 | Chọn một | ✅ |
| Nhà soạn nhạc | 👤 | Chọn nhiều | ✅ |
| Độ khó | 📊 | Chọn một | — |

Mỗi tab hiện badge đếm số lượng đã chọn, sử dụng màu chủ đạo riêng (amber, emerald, sky, violet, blue).

### 14.4 Trang Hướng Tới Người Dùng

**Trung Tâm Wiki** (`/wiki`):
- Thẻ danh mục dẫn đến trang listing
- Tìm kiếm toàn cục cho nghệ sĩ và tác phẩm
- Link "Quản lý nội dung" cho wiki editor

**Trang Chi Tiết** (giao diện premium với hero section + sidebar):
- `/wiki/artists/[slug]` — Tím chủ đạo, sidebar Quick Facts, PracticeCard
- `/wiki/instruments/[slug]` — Vàng hổ phách, sidebar Thông số kỹ thuật
- `/wiki/compositions/[slug]` — Xanh dương nhạt, sidebar Metadata, PracticeCard
- `/wiki/genres/[slug]` — Xanh lục, sidebar Thể loại con

**Trang Danh Sách** (tìm kiếm + bộ lọc + grid):
- `/wiki/artists` — Lọc theo quốc tịch, vai trò
- `/wiki/instruments` — Lọc theo họ nhạc cụ (dạng chip)
- `/wiki/compositions` — Lọc theo thể loại, thời kỳ, độ khó
- `/wiki/genres` — Dạng cây (thể loại cha → con) + chip thời đại

### 14.5 Tích Hợp Thực Hành (Practice Integration)

Component `PracticeCard` kết nối nội dung wiki với dự án có thể chơi:
- Hiển thị các track thực hành đã publish liên kết với tác phẩm hoặc nghệ sĩ
- CTA nổi bật (gradient card) cho dự án chính
- Danh sách compact cho các track bổ sung
- Hỗ trợ màu chủ đạo (sky, violet, amber, emerald, gold)
- Dẫn trực tiếp đến `/play/[projectId]`

API helpers:
- `listProjectsByComposition(compositionId, limit)` — query dự án theo tác phẩm
- `listProjectsByArtist(artistId, limit)` — query dự án theo nhà soạn nhạc

> **Lưu ý:** Chỉ dự án đã publish mới hiển thị. Bản nháp bị ẩn.

### 14.6 Trình Soạn Thảo Rich Text (TipTap)
- Editor WYSIWYG đầy đủ cho trường bio/description trong Admin CMS
- Toolbar: headings, định dạng, căn chỉnh, danh sách, trích dẫn, code block, links, ảnh, YouTube embed
- **Wiki Link Picker** (nút 📖) — tìm kiếm inline để chèn link đến entity wiki khác
- `RichTextRenderer` — render HTML tương thích locale, intercept click nội bộ qua Next.js router

### 14.7 Admin CMS (`/admin/wiki`)
- Giao diện tabbed cho 4 loại thực thể
- Form tạo/sửa inline với auto-generate slug
- CRUD qua server actions với auth guard `requireWikiEditor()`
- Truy cập bởi vai trò `admin` và `wiki_editor`

### 14.8 SEO
- `generateMetadata` trên tất cả trang chi tiết
- JSON-LD structured data (`Person`, `MusicComposition`)
- Dynamic sitemap (`wiki-sitemap.ts`) cho tất cả locales
- Unified Search Dialog trong Header navigation

### 14.9 Bản Địa Hóa Nội Dung (Đang thiết kế)

**Kiến trúc: Translation Overlay**

| Thành phần | Mô tả |
|---|---|
| Collection `wiki_translations` | Lưu bản dịch theo field: `entityId`, `entityType`, `locale`, `field`, `value` |
| Ngôn ngữ mặc định | Tiếng Anh (lưu trực tiếp trên document gốc) |
| Fallback | Nếu chưa có bản dịch, hiển thị nội dung tiếng Anh |
| Tích hợp CMS | Tab chọn ngôn ngữ trong Admin CMS để tạo/sửa bản dịch |
| Tương lai | Dịch tự động bằng AI (OpenAI, DeepL) với kiểm duyệt thủ công |

### 14.10 Vai Trò Người Dùng Wiki

| Vai trò | Quyền hạn |
|---|---|
| `admin` | Toàn quyền CMS, gán vai trò wiki_editor |
| `wiki_editor` | Tạo, sửa, xóa nội dung wiki; truy cập qua "Quản lý nội dung" trên trang Wiki |

---

## 15. Thanh Toán & Thuê Bao ✅

> **Trạng thái:** Đã triển khai | **Nhà cung cấp thanh toán:** LemonSqueezy

### 15.1 Mô Hình Doanh Thu (Hiện tại)
- **Gói Miễn phí:** Duyệt thoải mái, phát tối đa 3 bài/ngày
- **Thuê bao Premium:** Phát không giới hạn, Wait Mode, xuất PDF/MusicXML, truy cập đầy đủ Academy, không quảng cáo
- Gói Tháng ($4.99) và Năm ($39.99, tiết kiệm 33%)

### 15.2 Triển Khai Kỹ Thuật

| Thành phần | Mô tả |
|---|---|
| Checkout API | `/api/checkout` — tạo phiên thanh toán LemonSqueezy |
| Webhook | `/api/webhooks/lemonsqueezy` — xử lý sự kiện thuê bao |
| Đồng bộ thuê bao | `/api/subscription/sync` — đồng bộ trạng thái với Appwrite |
| Chặn tính năng | `UpgradePrompt` — hiện khi hết lượt phát hoặc bật Wait Mode (gói miễn phí) |
| Dashboard | `SubscriptionCard` — hiện trạng thái gói, link quản lý thanh toán |
| Trang giá | `/pricing` — so sánh Free vs Premium, chuyển đổi tháng/năm |

---

## 16. Thông Báo ✅

> **Trạng thái:** Đã triển khai

### 16.1 Chuông Thông Báo Trong Ứng Dụng
- Chuông thông báo thời gian thực trên header
- Loại thông báo: thích, theo dõi, bình luận, báo cáo đã xử lý
- Đánh dấu đã đọc tất cả
- Thời gian tương đối ("Vừa xong")
- Nhấn vào để chuyển đến nội dung liên quan

---

## 17. Tính Năng Dự Kiến — Phân Tích Nâng Cao

> **Trạng thái:** Ý tưởng | **Mục tiêu:** Q4 2026

### 17.1 Bảng Phân Tích Cho Creator
- Theo khóa học: số lượt đăng ký, tỷ lệ hoàn thành bài học, điểm bỏ học
- Theo dự án: lượt phát, thời lượng luyện tập trung bình, tỷ lệ yêu thích
- Tương tác người dùng: bản đồ nhiệt thời gian sử dụng

### 17.2 Phân Tích Tiến Trình Học Viên
- Lịch sử luyện tập cá nhân
- Báo cáo độ chính xác từng nốt từ các phiên Wait Mode
- Tiến trình kỹ năng theo thời gian (biểu đồ trực quan)
- Xác định điểm yếu (ô nhịp / nốt nhạc cụ thể có tỷ lệ lỗi cao)

---

## 18. Tính Năng Dự Kiến — Học Tập Thích Ứng

> **Trạng thái:** Ý tưởng | **Mục tiêu:** 2027

### 18.1 Các Mô Hình Đang Đánh Giá
- **Tiến trình Tuyến tính Nghiêm ngặt** — mô hình hiện tại (mở khóa bài học tuần tự)
- **Tự do Lựa chọn** — học viên chọn bất kỳ bài học nào theo thứ tự tùy ý
- **Thích ứng** — hệ thống đề xuất bài học tiếp theo dựa trên dữ liệu hiệu suất

### 18.2 Mở Rộng Gamification
- Chuỗi ngày luyện tập (streak) với phần thưởng đăng nhập + luyện tập hàng ngày
- Bảng xếp hạng (tùy chọn tham gia, theo khóa học hoặc theo nhạc cụ)
- Huy hiệu thành tích (hoàn thành bài đầu tiên, chuỗi 7 ngày, v.v.)
- `GamificationProvider` đã được khung sẵn trong mã nguồn

---

## Phụ Lục A: Các Chế Độ Dự Án

| Chế độ | Mô tả | Tình huống sử dụng chính |
|---|---|---|
| `practice` | Sheet đơn nhạc cụ + backing tracks | Luyện tập theo nhạc đệm |
| `arrange` | Không gian phối khí đa track | Phối nhạc hoàn chỉnh |
| `chart` | Bảng hợp âm / lead sheet | Tham khảo khi diễn tập |

## Phụ Lục B: Vai Trò Người Dùng

| Vai trò | Quyền hạn |
|---|---|
| Khách (chưa đăng nhập) | Duyệt Discover, xem hồ sơ công khai, xem Trang chủ / Hướng dẫn |
| Người dùng Đã đăng ký | Phát dự án, đăng ký khóa học, tạo dự án, quản lý yêu thích / playlist, tính năng xã hội |
| Creator | Tất cả quyền người dùng + xuất bản dự án, tạo / bán khóa học |
| Wiki Editor | Tạo, sửa, xóa nội dung wiki qua Admin CMS |
| Quản trị viên | Quản lý toàn bộ nền tảng, kiểm duyệt nội dung, quản lý nội dung nổi bật, gán vai trò |

## Phụ Lục C: Các Trường Mới Trong Schema Dự Án (v4.0)

| Trường | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `featured` | boolean | `false` | Cờ nổi bật do admin đặt |
| `featuredAt` | datetime | — | Thời điểm được đánh dấu nổi bật |
| `favoriteCount` | integer | `0` | Số lượt yêu thích (đồng bộ tự động) |
| `playCount` | integer | `0` | Số lượt phát (tăng mỗi lần phát) |
