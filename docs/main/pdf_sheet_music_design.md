# PDF Sheet Music — Thiết Kế Hệ Thống

**Phiên bản:** 2.0  
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
6. [Tích Hợp với Classroom](#6-tích-hợp-với-classroom)
7. [Phân Quyền & Giới Hạn](#7-phân-quyền--giới-hạn)
8. [Components & Libraries](#8-components--libraries)
9. [Roadmap Triển Khai](#9-roadmap-triển-khai)
10. [Rủi Ro & Hạn Chế](#10-rủi-ro--hạn-chế)

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

## 6. Tích Hợp với Classroom

### 6.1 Teacher Share PDF

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

### 6.2 Assignment Attachment

Khi tạo Assignment, teacher có thể attach 1 PDF sheet music:

```
Create Assignment
├── Title, Description, Deadline
├── Source Project (audio backing track)
└── 📄 Attach Sheet Music (optional)
    └── Chọn từ thư viện cá nhân
```

### 6.3 Schema Change — `AssignmentDocument`

| Field mới | Type | Mô tả |
|---|---|---|
| `sheetMusicId` | string (optional) | ID của SheetMusicDocument được attach |

---

## 7. Phân Quyền & Giới Hạn

### 7.1 Permission Matrix

| Hành động | Free | Premium |
|:---|:---:|:---:|
| Upload PDF | ✅ (giới hạn 10 files) | ✅ (không giới hạn) |
| View PDF | ✅ | ✅ |
| Auto-Scroll | ✅ | ✅ |
| Performance Mode | ✅ | ✅ |
| Half-Page Turn | ✅ | ✅ |
| Setlist Mode | ❌ | ✅ |
| Download PDF | ❌ | ✅ |
| Annotation | ❌ | ✅ |

### 7.2 Storage Limits

| Tier | Max files | Max per file | Total storage |
|---|---|---|---|
| Free | 10 | 20MB | 200MB |
| Premium | Unlimited | 50MB | 5GB |

---

## 8. Components & Libraries

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

## 9. Roadmap Triển Khai

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
- [ ] Auto-Scroll with speed control
- [ ] DashboardSidebar: thêm "Sheet Music" menu item
- [ ] Mobile optimization: pinch-zoom, swipe, landscape
- [ ] i18n (10 languages)

### Phase 2 — Enhanced Features (1-2 tuần)

- [ ] Setlist Mode (concatenate multiple PDFs)
- [ ] Classroom integration (share PDF, attach to assignment)
- [ ] Dark mode (invert PDF colors)
- [ ] Two-page side-by-side view (landscape/desktop)
- [ ] Foot pedal support (Bluetooth keyboard events)
- [ ] Wake Lock API (prevent screen sleep)

### Phase 3 — Premium Features (2+ tuần)

- [ ] Annotation (highlight, text notes, freehand drawing)
- [ ] Offline caching (Service Worker)
- [ ] PDF download (Premium only)
- [ ] Shared annotations in Classroom

---

## 10. Rủi Ro & Hạn Chế

| Rủi ro | Ảnh hưởng | Giải pháp |
|---|---|---|
| pdf.js bundle ~500KB | Initial load chậm | Dynamic import, chỉ load ở routes `/sheets/*` |
| PDF nhiều trang → lag | Render chậm trên mobile | Virtualize: chỉ render trang đang hiện + ±1 |
| Copyright content | Legal risk | Terms of Use: user chịu trách nhiệm bản quyền |
| CORS storage | Không render được | Cấu hình Appwrite CORS headers |
| Wake Lock API support | Không phải browser nào cũng hỗ trợ | Feature detection, graceful fallback |

---

*Tài liệu liên quan: [system_design.md](system_design.md) | [product_features.md](product_features.md)*
