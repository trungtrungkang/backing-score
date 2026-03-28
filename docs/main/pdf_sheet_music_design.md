# PDF Sheet Music — Thiết Kế Hệ Thống

**Phiên bản:** 3.0  
**Cập nhật:** 2026-03-28  
**Trạng thái:** Thiết kế — chưa triển khai

> Tài liệu mở rộng của [system_design.md](system_design.md) — Chương 24

---

## Mục Lục

1. [Tổng Quan](#1-tổng-quan)
2. [Thiết Kế Cơ Sở Dữ Liệu](#2-thiết-kế-cơ-sở-dữ-liệu)
3. [Sheet Music Library — Thư Viện PDF](#3-sheet-music-library--thư-viện-pdf)
4. [PDF Viewer — Thiết Kế Trình Xem](#4-pdf-viewer--thiết-kế-trình-xem)
5. [Tối Ưu Cho Người Chơi Nhạc](#5-tối-ưu-cho-người-chơi-nhạc)
6. [Navigation Map — Xử Lý Bản Nhạc Có Lặp Lại](#6-navigation-map--xử-lý-bản-nhạc-có-lặp-lại)
7. [Measure Markers — Đánh Dấu Ô Nhịp & Audio Sync](#7-measure-markers--đánh-dấu-ô-nhịp--audio-sync)
8. [Tích Hợp với Classroom](#8-tích-hợp-với-classroom)
9. [Tích Hợp Ecosystem](#9-tích-hợp-ecosystem)
10. [Monetization — Bán PDF](#10-monetization--bán-pdf)
11. [Phân Quyền & Giới Hạn](#11-phân-quyền--giới-hạn)
12. [Components & Libraries](#12-components--libraries)
13. [Roadmap Triển Khai](#13-roadmap-triển-khai)
14. [Rủi Ro & Hạn Chế](#14-rủi-ro--hạn-chế)

---

## 1. Tổng Quan

### 1.1 Triết Lý

PDF Sheet Music là **module độc lập** trong Backing & Score, tồn tại song song với hệ thống Project/Audio hiện tại. User có **thư viện riêng** để upload, tổ chức, và xem sheet music PDF — giống như một "ebook reader cho nhạc sĩ".

```
┌──────────────────────────────────────────────────────────────┐
│                    Backing & Score Platform                    │
│                                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Projects │  │ Academy  │  │ Social   │  │ Sheet Music  │  │
│  │ (Audio + │  │ (Courses │  │ (Feed,   │  │ Library      │  │
│  │  MusicXML│  │  Lessons)│  │  Follow) │  │ (PDF viewer) │  │
│  │  Editor) │  │          │  │          │  │              │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘  │
│                                                                │
│  Các module KHÔNG phụ thuộc nhau.                             │
│  PDF Sheet Music là citizen ngang hàng, có route riêng.       │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Mục Tiêu

| Mục tiêu | Mô tả |
|---|---|
| **Thư viện cá nhân** | User upload, tổ chức PDF theo folders/tags |
| **Viewer tối ưu cho nhạc sĩ** | Đọc sheet music thuận tiện nhất có thể khi đang chơi nhạc |
| **Offline-ready** | Cache PDF đã xem để có thể dùng khi mất kết nối (Phase 2) |
| **Classroom integration** | Teacher có thể share PDF cho học sinh |

### 1.3 Nguyên Tắc Thiết Kế

| Nguyên tắc | Mô tả |
|---|---|
| **Độc lập** | PDF không gắn vào Project — là entity riêng với lifecycle riêng |
| **Musician-first** | Mọi quyết định UI đặt người chơi nhạc lên đầu (hands-free, page turn, landscape) |
| **Client-side rendering** | PDF render hoàn toàn trên browser, không cần server processing |
| **Progressive** | MVP viewer → auto-scroll → annotation → sharing |

---

## 2. Thiết Kế Cơ Sở Dữ Liệu

### 2.1 Collection: `sheet_music` (Mới)

| Field | Type | Required | Mô tả |
|---|---|---|---|
| `userId` | string | ✅ | Chủ sở hữu |
| `title` | string | ✅ | Tên bản nhạc (user tự đặt hoặc filename) |
| `fileId` | string | ✅ | Appwrite Storage file ID |
| `fileSize` | integer | ✅ | Kích thước file (bytes) |
| `pageCount` | integer | ✅ | Số trang PDF |
| `composer` | string | ❌ | Tên tác giả/nhà soạn nhạc |
| `instrument` | string | ❌ | Nhạc cụ (Piano, Guitar, Violin...) |
| `key` | string | ❌ | Tông giọng (C Major, A Minor...) |
| `tags` | string[] | ❌ | Tags tùy chỉnh |
| `folderId` | string | ❌ | Folder ID để tổ chức |
| `lastOpenedAt` | datetime | ❌ | Mở lần cuối (sort "Recently Viewed") |
| `favorite` | boolean | ❌ | Đánh dấu yêu thích |
| `relatedProjectId` | string | ❌ | Link đến Project (cùng bài nhạc, khác format) |
| `wikiCompositionId` | string | ❌ | Link đến Wiki Composition |
| `priceCents` | integer | ❌ | Giá bán (0 = miễn phí, null = chưa publish) |
| `isPublished` | boolean | ❌ | Hiển thị trên marketplace |
| `previewPages` | integer | ❌ | Số trang cho xem miễn phí (default: 1) |

**Permissions:** Document-level — chỉ owner đọc/sửa/xóa (private by default)

### 2.2 Collection: `sheet_music_folders` (Mới)

| Field | Type | Required | Mô tả |
|---|---|---|---|
| `userId` | string | ✅ | Chủ sở hữu |
| `name` | string | ✅ | Tên folder |
| `order` | integer | ✅ | Thứ tự hiển thị |
| `parentFolderId` | string | ❌ | Nested folders (1 cấp) |

### 2.3 Storage

| Thuộc tính | Giá trị |
|---|---|
| Bucket | `sheet-pdfs` (bucket riêng) |
| Max file size | 20MB |
| MIME types | `application/pdf` only |
| Permissions | Per-user (chỉ owner truy cập) |

### 2.4 TypeScript Types

```typescript
interface SheetMusicDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  userId: string;
  title: string;
  fileId: string;
  fileSize: number;
  pageCount: number;
  composer?: string;
  instrument?: string;
  key?: string;
  tags?: string[];
  folderId?: string | null;
  lastOpenedAt?: string;
  favorite?: boolean;
}

interface SheetMusicFolderDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  userId: string;
  name: string;
  order: number;
  parentFolderId?: string | null;
}
```

---

## 3. Sheet Music Library — Thư Viện PDF

### 3.1 Route Structure

| Route | Mô tả |
|---|---|
| `/dashboard/pdfs` | Thư viện PDF (root — hiện tất cả hoặc "unfiled") |
| `/dashboard/pdfs/folder/[folderId]` | Nội dung 1 folder cụ thể |
| `/dashboard/pdfs/view/[id]` | PDF Viewer (full-screen reader) |

### 3.2 Sidebar Integration — "PDFs" Root Folder

Trong `DashboardSidebar`, "PDFs" là **menu item ngang hàng** với "My Uploads", có **folder con expand/collapse** giống hệt pattern My Uploads:

```
Dashboard Sidebar:
├── ☁️  My Uploads          → /dashboard
│   ├── 📁 Classical        → /dashboard?folder=xxx
│   ├── 📁 Jazz             → /dashboard?folder=yyy
│   └── 📁 Pop              → /dashboard?folder=zzz
│
├── 📄  PDFs                → /dashboard/pdfs         ← MỚI (root folder)
│   ├── 📁 Piano Sheets     → /dashboard/pdfs/folder/aaa
│   ├── 📁 Guitar Tabs      → /dashboard/pdfs/folder/bbb
│   ├── 📁 Lesson Materials → /dashboard/pdfs/folder/ccc
│   └── ＋ New Folder
│
├── 📂  Collections         → /dashboard/collections
├── 🔖  Favorites           → /dashboard/favorites
├── 📊  Analytics           → /dashboard/analytics
├── 🎓  Classroom           → /classroom
├── ──────────────
├── 📖  Creator Courses     → /dashboard/courses
├── 🌐  User Guide          → /guide
└── 👑  Premium             → /pricing
```

**Sidebar behavior:**
- Click "PDFs" → navigate to `/dashboard/pdfs` (hiện all PDFs unfiled + folder list)
- Click arrow `▸` bên cạnh "PDFs" → expand/collapse folder tree
- Folders load từ `sheet_music_folders` collection
- "＋ New Folder" button inline
- Badge hiện tổng số PDF files

### 3.3 Library Page (`/dashboard/pdfs`)

```
┌───────────────────────────────────────────────────────────────┐
│ 📄  PDFs                                         [+ Upload]   │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Lọc: [All] [Favorites ❤] [Recent]     🔍 Search...          │
│                                                               │
│  Folders:                                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │📁Piano  │ │📁Guitar │ │📁Lesson │ │ ＋ New  │            │
│  │ 12 files│ │ 5 files │ │ 3 files │ │ Folder  │            │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│                                                               │
│  All Sheets (unfiled):                                Grid|List│
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 🎵 Chopin Nocturne Op.9 No.2   │ Piano │ 4 pages │ ⋮   │ │
│  │ 🎵 Bach Cello Suite No.1       │ Cello │ 8 pages │ ⋮   │ │
│  │ 🎵 Canon in D (Parts)          │ Ensemble │ 12p  │ ⋮   │ │
│  └──────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

**Features:**
- Upload PDF (drag & drop + file picker, multi-file support)
- 2 view modes: Grid (thumbnail) / List (compact)
- Folder cards + "New Folder" button tại đầu trang
- Sort: Recently viewed / Name A-Z / Date added / Composer
- Filter: By instrument, by tag, favorites
- Search: Full-text search trên title + composer
- Quick actions (menu ⋮): Rename, Move to folder, Delete, Toggle favorite, Open in viewer
- Drag-drop PDF vào folder card để di chuyển

### 3.4 Upload Flow

```
User click [+ Upload] hoặc drag-drop PDF files
    ↓
Validate: type=PDF, size ≤ 20MB
    ↓
Upload → Appwrite Storage (bucket: sheet-pdfs)
    ↓
Extract metadata (filename → title, count pages via pdf.js)
    ↓
Create SheetMusicDocument trong Appwrite
    ↓
Hiện dialog "Edit details" (optional):
  - Title (auto-filled from filename)
  - Composer
  - Instrument
  - Tags
  - Folder (dropdown chọn folder)
    ↓
Done → Sheet xuất hiện trong Library (ở folder đã chọn hoặc unfiled)
```

---

## 4. PDF Viewer — Thiết Kế Trình Xem

### 4.1 Layout Overview

```
┌──────────────────────────────────────────────────────────────┐
│ ← Back to Library    Chopin Nocturne Op.9 No.2    [⛶] [⚙]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                    ┌──────────────────┐                      │
│                    │                  │                      │
│                    │   PDF PAGE       │                      │
│                    │   CONTENT        │                      │
│                    │                  │                      │
│                    │                  │                      │
│                    │                  │                      │
│                    └──────────────────┘                      │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ ◀ Prev │ Page 2 of 8 │ Next ▶ │ Zoom: [−][Fit][+] │ 🔄 Auto│
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Toolbar Features

| Control | Mô tả | Phím tắt |
|---|---|---|
| **Page Prev/Next** | Lật trang | `←` / `→` hoặc `PageUp`/`PageDown` |
| **Zoom In/Out** | Phóng to/thu nhỏ | `+` / `-` hoặc Ctrl+Scroll |
| **Fit Width** | Co giãn theo chiều rộng | `W` |
| **Fit Page** | Co giãn theo toàn trang | `F` |
| **Fullscreen** | Toàn màn hình (ẩn header/sidebar) | `F11` hoặc `Esc` |
| **Auto-Scroll** | Cuộn tự động (tốc độ điều chỉnh) | `Space` toggle |
| **Dark Mode** | Đảo màu PDF (trắng→đen, đen→trắng) | `D` |
| **Two-Page View** | Hiện 2 trang cạnh nhau (landscape) | `2` |

---

## 5. Tối Ưu Cho Người Chơi Nhạc

> Đây là phần quan trọng nhất — viewer phải phục vụ musician đang chơi nhạc, tay đang bận cầm nhạc cụ.

### 5.1 Hands-Free Page Turn

Khi đang chơi nhạc, tay nhạc sĩ bận cầm nhạc cụ → cần cách lật trang không dùng tay:

| Phương thức | Mô tả | Phù hợp với |
|---|---|---|
| **Auto-Scroll** | Cuộn liên tục với tốc độ điều chỉnh được (BPM-based hoặc manual) | Bất kỳ nhạc cụ |
| **Foot Pedal** | Nhận tín hiệu từ Bluetooth pedal (keyboard event) | Pianists, organists |
| **Tap anywhere** | Tap/click bất kỳ đâu trên màn hình = next page | Tablet trên giá nhạc |
| **Timer Page Turn** | Đặt số giây mỗi trang → tự lật | Tempo ổn định |
| **Half-Page Turn** | Cuộn nửa trang thay vì cả trang → luôn nhìn thấy dòng tiếp theo | Tránh bị "mù" khi lật trang |

### 5.2 Auto-Scroll Mode

```
┌──────────────────────────────────────────────────────────┐
│                    AUTO-SCROLL CONTROLS                    │
│                                                            │
│  Speed: ◀ ━━━━━━━●━━━━ ▶    [Pause/Resume]               │
│         Slow            Fast                                │
│                                                            │
│  Preset speeds:                                            │
│  [Largo] [Andante] [Moderato] [Allegro] [Presto]          │
└──────────────────────────────────────────────────────────┘
```

- Tốc độ cuộn mượt (pixel-by-pixel, không giật)
- Preset theo tempo nhạc (Largo ~60BPM → cuộn chậm, Presto ~180BPM → cuộn nhanh)
- Manual speed slider
- Pause/Resume bằng `Space` hoặc tap

### 5.3 Half-Page Turn (Quan trọng!)

Vấn đề lớn nhất khi đọc sheet music: **khi lật trang, nhạc sĩ mất vài giây không nhìn thấy dòng nhạc tiếp theo**. Giải pháp:

```
Thay vì lật nguyên trang:
┌──────────┐     ┌──────────┐
│  Page 1  │ ──► │  Page 2  │   ← Mất context!
│          │     │          │
└──────────┘     └──────────┘

Half-page turn:
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Page 1  │     │▓▓▓▓▓▓▓▓▓▓│     │▓▓▓▓▓▓▓▓▓▓│
│  Top     │ ──► │  Page 1  │ ──► │  Page 2  │
│──────────│     │  Bottom  │     │  Top     │
│  Page 1  │     │──────────│     │──────────│
│  Bottom  │     │  Page 2  │     │  Page 2  │
└──────────┘     │  Top     │     │  Bottom  │
                 └──────────┘     └──────────┘
                 ↑ Overlap zone — luôn nhìn thấy phần tiếp theo
```

### 5.4 Performance Mode (Chế Độ Biểu Diễn)

Khi user tap nút "Performance Mode":
- Ẩn tất cả toolbar/header → chỉ hiện PDF full viewport
- Tap anywhere = next page (hoặc half-page)
- Swipe up = next page
- Màn hình không tắt (wake lock API)
- Dark mode option (giảm ánh sáng khi biểu diễn tối)

### 5.5 Setlist Mode (Phase 2)

Người chơi nhạc thường cần xem **nhiều bài liên tiếp** (concert, gig, worship). Setlist cho phép ghép nhiều PDF thành 1 chuỗi liên tục:

```
Setlist: "Concert 28/3/2026"
├── 1. Chopin Nocturne (4 pages)
├── 2. Bach Cello Suite (8 pages)
├── 3. Canon in D (3 pages)
└── Total: 15 pages, cuộn liên tục
```

---

## 6. Navigation Map — Xử Lý Bản Nhạc Có Lặp Lại

> Auto-scroll tuyến tính chỉ phù hợp bản nhạc không lặp. Đa số bản nhạc thực tế có repeat bars, D.C., D.S., Coda → cần giải pháp khác.

### 6.1 Vấn Đề

Bản nhạc thường có cấu trúc lặp:
- **Repeat bars** `||: ... :||` → chơi đoạn 2 lần
- **D.C. (Da Capo)** → quay về đầu bài
- **D.S. (Dal Segno)** → nhảy đến dấu Segno
- **Coda** → nhảy đến đoạn kết

Auto-scroll cuộn từ trang 1→2→3 không phản ánh lộ trình đọc thực tế.

### 6.2 Giải Pháp: Bookmarks + Navigation Sequence

**Phase 1 (MVP) — Bookmarks:**
- User đặt sẵn 4-5 bookmarks (Verse, Chorus, Bridge, Coda...)
- Tap nhanh bookmarks để nhảy đến section tương ứng
- Quick-jump bar: thanh thumbnail nhỏ ở dưới viewer

**Phase 2 — Navigation Map:**
- User đánh dấu sections trên PDF (tên + vùng chọn)
- Kéo thả sắp xếp **lộ trình đọc thực tế**:

```
Ví dụ: Bản nhạc 3 trang có D.C. al Coda

Lộ trình đọc (Navigation Sequence):
  Step 1: Page 1 — Intro + Verse 1
  Step 2: Page 1 — Verse 2 (repeat)
  Step 3: Page 2 — Chorus
  Step 4: Page 1 — D.C. (quay về đầu)
  Step 5: Page 2 — đến "To Coda"
  Step 6: Page 3 — Coda
```

- Auto-scroll theo navigation sequence → nhảy trang tự động khi cần
- Visual indicator: mũi tên "Jump to page X" khi gần đến điểm nhảy

### 6.3 Data Model

```typescript
interface NavigationStep {
  page: number;        // Trang PDF (0-based)
  sectionName?: string; // "Verse", "Chorus", "Coda"...
  startY?: number;     // Vị trí bắt đầu trên trang (% từ trên)
  endY?: number;       // Vị trí kết thúc (% từ trên)
}

// Lưu trong sheet_music document
interface SheetMusicDocument {
  // ... existing fields ...
  navigationMap?: string; // JSON.stringify(NavigationStep[])
}
```

---

## 7. Measure Markers — Đánh Dấu Ô Nhịp & Audio Sync

> **Phase:** Advanced (Phase 3+) — Tính năng mạnh, cho phép sync PDF với audio playback giống MusicXML.

### 7.1 Khả Thi Kỹ Thuật

**Có thể làm.** Nguyên lý: vẽ overlay layer lên trên PDF canvas.

```
┌──────────────────────────────────────────────┐
│ PDF Page (render bởi pdf.js)                  │
│                                                │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐            │
│  │ M1  │ │ M2  │ │ M3  │ │ M4  │  ← Dòng 1  │
│  └─────┘ └─────┘ └─────┘ └─────┘            │
│                                                │
│  M = Measure marker (user vẽ bounding box)    │
│  Overlay = <div> absolute-positioned trên PDF  │
└──────────────────────────────────────────────┘
```

### 7.2 Zoom Không Ảnh Hưởng

Lưu tọa độ dạng **tỉ lệ %** thay vì pixel:

```typescript
interface MeasureMarker {
  page: number;      // Trang PDF
  measure: number;   // Số ô nhịp
  x: number;         // 0.084 = 8.4% từ trái
  y: number;         // 0.119 = 11.9% từ trên
  width: number;     // 0.218 = chiếm 21.8% chiều rộng
  height: number;    // 0.071 = chiếm 7.1% chiều cao
}

// Render bằng CSS: left: 8.4%, top: 11.9%, width: 21.8%...
// Khi zoom → container thay đổi → tất cả tự scale chính xác
```

### 7.3 Sync Với Audio/Timemap

Khi đã có measure markers + timemap (từ audio sync):

```
MeasureMarker[] + TimemapEntry[] = Playhead trên PDF!

Audio đang chơi → currentTimeMs = 45000
    → Tìm trong timemap: measure 12 bắt đầu tại 44500ms
    → Tìm trong markers: measure 12 ở page 2, vị trí (x=0.5, y=0.3)
    → Highlight marker đó + auto-scroll đến vị trí
```

### 7.4 UX Đánh Dấu — Smart Row Approach

Đánh dấu từng ô nhịp rất mất công (~64 ô nhịp cho bản 4 trang). Giải pháp:

| Approach | Mô tả | Thời gian |
|---|---|---|
| **A) Manual** | Click-drag từng ô nhịp | 5-10 phút |
| **B) Smart Row** ✅ | Đánh dấu cả DÒNG nhạc + nhập số ô nhịp → tự chia đều | 1-2 phút |
| **C) OMR (AI)** | Tự nhận diện ô nhịp từ PDF | Full auto (tương lai) |

**Smart Row (đề xuất cho MVP):**
```
Bước 1: User kéo vùng chọn cho cả DÒNG nhạc (chỉ 8 dòng thay vì 64 ô nhịp)
Bước 2: Nhập "4 ô nhịp" → hệ thống chia đều dòng thành 4 phần
Bước 3: Fine-tune nếu cần (drag border giữa các ô)
```

### 7.5 Độ Khó Đánh Giá

| Khía cạnh | Độ khó |
|---|---|
| Vẽ overlay markers | ⭐⭐ Dễ |
| Lưu/load tọa độ % | ⭐ Rất dễ |
| Zoom/resize responsive | ⭐ Rất dễ (CSS % positioning) |
| Highlight ô nhịp đang chơi | ⭐⭐ Dễ |
| Sync với timemap | ⭐⭐ Dễ (copy logic từ MusicXML engine) |
| Smart Row UX | ⭐⭐⭐ Trung bình |
| OMR auto-detection | ⭐⭐⭐⭐⭐ Cực khó (cần ML pipeline riêng) |

---

## 8. Tích Hợp với Classroom

### 8.1 Teacher Share PDF

Teacher có thể share PDF từ thư viện cá nhân cho cả lớp:

```
Teacher → Sheet Music Library → Chọn PDF → "Share to Classroom"
    ↓
Chọn Classroom
    ↓
PDF xuất hiện trong tab "Materials" / "Tài liệu" của classroom
    ↓
Students xem PDF qua viewer (read-only, không download)
```

### 8.2 Assignment Attachment

Khi tạo Assignment, teacher có thể attach 1 PDF sheet music:

```
Create Assignment
├── Title, Description, Deadline
├── Source Project (audio backing track)
└── 📄 Attach Sheet Music (optional)
    └── Chọn từ thư viện cá nhân
```

### 8.3 Schema Change — `AssignmentDocument`

| Field mới | Type | Mô tả |
|---|---|---|
| `sheetMusicId` | string (optional) | ID của SheetMusicDocument được attach |

---

## 9. Tích Hợp Ecosystem

### 9.1 Cross-References

PDF Sheet Music có thể liên kết với các module khác qua optional fields:

| Liên kết | Field | Mô tả |
|---|---|---|
| PDF ↔ Project | `relatedProjectId` | Cùng bài nhạc, khác format (VD: PDF Chopin ↔ Audio backing Chopin) |
| PDF ↔ Wiki | `wikiCompositionId` | Liên kết với bài viết Wiki Composition |
| PDF ↔ Favorites | Mở rộng `targetType` | Cho phép favorite PDF sheets |
| PDF ↔ Discover | `isPublished` | Published PDFs xuất hiện trên Discover |

### 9.2 Discover Integration (Tương lai)

Khi PDF có `isPublished = true`, hiện trên Discover dưới tab riêng:

```
Discover Tabs: [Scores] [Sheets] [Courses] [Collections]
                         ↑ PDF sheets published
```

---

## 10. Monetization — Bán PDF

> **Phase:** Tương lai — khi marketplace sẵn sàng

### 10.1 Mô Hình Bán

| Mô hình | Mô tả | Khi nào |
|---|---|---|
| **Free upload** | Thư viện cá nhân, không bán | Hiện tại |
| **Subscription-gated** | Premium PDFs chỉ user Premium xem được | Gần |
| **Per-item purchase** | Bán riêng lẻ qua LemonSqueezy | Trung hạn |
| **Bundle** | Combo audio + PDF + notes | Xa |

### 10.2 Per-Item Purchase Flow

```
Creator upload PDF → Set price ($1.99) → Publish
    ↓
Buyer xem preview (1 trang đầu) → Mua → Unlock full PDF + download
```

### 10.3 Product Abstraction Layer (Tương lai)

Để tránh tạo checkout flow riêng cho mỗi loại content, cần "Product" layer thống nhất:

```
                    ┌─────────────┐
                    │   Product   │  ← Abstraction layer
                    │             │
                    │ type:       │
                    │  musicxml   │
                    │  pdf        │
                    │  course     │
                    │  bundle     │
                    │             │
                    │ priceCents  │
                    │ creatorId   │
                    │ sourceId    │
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
     ┌──────────┐   ┌──────────┐   ┌──────────┐
     │ Project  │   │ Sheet    │   │ Course   │
     │ (source) │   │ Music    │   │ (source) │
     └──────────┘   └──────────┘   └──────────┘
```

### 10.4 Purchases Collection (Dự kiến)

```typescript
interface PurchaseDocument {
  buyerId: string;
  sellerId: string;
  itemType: "pdf" | "project" | "course" | "bundle";
  itemId: string;
  pricePaidCents: number;
  lsOrderId?: string;  // LemonSqueezy order ID
  $createdAt: string;
}
```

---

## 11. Phân Quyền & Giới Hạn

### 11.1 Permission Matrix

| Hành động | Free | Premium |
|:---|:---:|:---:|
| Upload PDF | ✅ (giới hạn 10 files) | ✅ (không giới hạn) |
| View PDF | ✅ | ✅ |
| Auto-Scroll | ✅ | ✅ |
| Performance Mode | ✅ | ✅ |
| Half-Page Turn | ✅ | ✅ |
| Bookmarks | ✅ | ✅ |
| Setlist Mode | ❌ | ✅ |
| Navigation Map | ❌ | ✅ |
| Measure Markers | ❌ | ✅ |
| Download PDF | ❌ | ✅ |
| Annotation | ❌ | ✅ |
| Publish/Sell PDF | ❌ | ✅ |

### 11.2 Storage Limits

| Tier | Max files | Max per file | Total storage |
|---|---|---|---|
| Free | 10 | 20MB | 200MB |
| Premium | Unlimited | 50MB | 5GB |

---

## 12. Components & Libraries

### 8.1 Dependencies

| Package | Size | Vai trò |
|---|---|---|
| `react-pdf` v9+ | ~30KB | React wrapper cho pdf.js |
| `pdfjs-dist` v4+ | ~500KB (worker) | Core PDF engine |

### 8.2 File Structure

```
src/
├── app/[locale]/dashboard/pdfs/
│   ├── page.tsx                    — Library page (root view)
│   ├── folder/[folderId]/
│   │   └── page.tsx                — Folder detail view
│   └── view/[id]/
│       └── page.tsx                — PDF Viewer page
├── components/pdf/
│   ├── PdfViewer.tsx               — Main viewer (page render + controls)
│   ├── PdfToolbar.tsx              — Navigation, zoom, mode controls  
│   ├── PdfAutoScroll.tsx           — Auto-scroll engine + speed controls
│   ├── PdfPerformanceMode.tsx      — Fullscreen hands-free mode
│   ├── PdfUploadDialog.tsx         — Upload + metadata form
│   ├── PdfLibraryGrid.tsx          — Grid/List view for library
│   ├── PdfFolderTree.tsx           — Sidebar folder tree (expand/collapse)
│   └── PdfSetlistPlayer.tsx        — Setlist concatenated viewer (Phase 2)
├── lib/appwrite/
│   ├── sheet-music.ts              — CRUD functions
│   └── sheet-music-folders.ts      — Folder management
```

### 8.3 Lazy Loading

```typescript
const PdfViewer = dynamic(
  () => import("@/components/pdf/PdfViewer"),
  { ssr: false, loading: () => <ViewerSkeleton /> }
);
// pdf.js worker chỉ load khi vào /sheets/[id], không ảnh hưởng routes khác
```

---

## 13. Roadmap Triển Khai

### Phase 1 — MVP Library + Viewer (2 tuần)

- [ ] Appwrite collections: `sheet_music`, `sheet_music_folders`
- [ ] `react-pdf` + `pdfjs-dist` installation
- [ ] DashboardSidebar: thêm "PDFs" root item với expandable folder tree
- [ ] Library page (`/dashboard/pdfs`): upload, grid/list view, folders, search
- [ ] Folder page (`/dashboard/pdfs/folder/[folderId]`): hiện PDFs trong folder
- [ ] Viewer page (`/dashboard/pdfs/view/[id]`): page navigation, zoom, fit-width
- [ ] Keyboard shortcuts (←→, +−, F, W)
- [ ] Performance Mode (fullscreen, tap-to-turn)
- [ ] Half-Page Turn mode
- [ ] Auto-Scroll with speed control + tempo presets
- [ ] Bookmarks (đánh dấu sections, quick-jump bar)
- [ ] Mobile optimization: pinch-zoom, swipe, landscape
- [ ] i18n (9 languages)

### Phase 2 — Enhanced Navigation (1-2 tuần)

- [ ] Navigation Map (xử lý bản nhạc có lặp — D.C., D.S., Coda)
- [ ] Setlist Mode (concatenate multiple PDFs)
- [ ] Classroom integration (share PDF, attach to assignment)
- [ ] Ecosystem links: `relatedProjectId`, `wikiCompositionId`
- [ ] Dark mode (invert PDF colors)
- [ ] Two-page side-by-side view (landscape/desktop)
- [ ] Foot pedal support (Bluetooth keyboard events)
- [ ] Wake Lock API (prevent screen sleep)

### Phase 3 — Advanced Features (2+ tuần)

- [ ] Measure Markers (đánh dấu ô nhịp — Smart Row approach)
- [ ] Audio sync (playhead trên PDF qua timemap)
- [ ] Annotation (highlight, text notes, freehand drawing)
- [ ] Offline caching (Service Worker)
- [ ] PDF download (Premium only)
- [ ] Shared annotations in Classroom

### Phase 4 — Monetization (khi marketplace sẵn sàng)

- [ ] Publish PDF to marketplace (`isPublished`, `priceCents`)
- [ ] Preview mode (chỉ hiện N trang đầu cho free)
- [ ] Purchase flow qua LemonSqueezy
- [ ] Product abstraction layer (unified checkout)
- [ ] Discover integration ("Sheets" tab)

---

## 14. Rủi Ro & Hạn Chế

| Rủi ro | Ảnh hưởng | Giải pháp |
|---|---|---|
| pdf.js bundle ~500KB | Initial load chậm | Dynamic import, chỉ load ở routes `/dashboard/pdfs/*` |
| PDF nhiều trang → lag | Render chậm trên mobile | Virtualize: chỉ render trang đang hiện + ±1 |
| Copyright content | Legal risk | Terms of Use: user chịu trách nhiệm bản quyền |
| CORS storage | Không render được | Cấu hình Appwrite CORS headers |
| Wake Lock API support | Không phải browser nào cũng hỗ trợ | Feature detection, graceful fallback |
| Measure markers mất công | User mất 1-2 phút đánh dấu | Smart Row approach giảm 5x effort |
| OMR auto-detection | Cần ML pipeline phức tạp | Để tương lai hoặc dùng API bên thứ ba |

---

*Tài liệu liên quan: [system_design.md](system_design.md) | [product_features.md](product_features.md) | [system_review_2026_03_28.md](system_review_2026_03_28.md)*
