# PDF Sheet Music — Progress Review

So sánh [pdf_sheet_music_design.md](file:///Users/jefftrung/projects/paperclip/lotusa/projects/backing-and-score/docs/main/pdf_sheet_music_design.md) với trạng thái hiện tại.

---

## Phase 1 — MVP Library + Viewer

| # | Mục tiêu | Trạng thái | Ghi chú |
|---|----------|:----------:|---------|
| 1 | Appwrite collections: `sheet_music`, `sheet_music_folders` | ✅ | Đã có |
| 2 | `pdfjs-dist` installation | ✅ | Dùng `pdf-utils.ts` custom loader |
| 3 | Sidebar: "PDFs" root + expandable folder tree | ✅ | `DashboardSidebar.tsx` |
| 4 | Library page: upload, grid/list, folders, search | ✅ | `/dashboard/pdfs/page.tsx` (32KB) |
| 5 | Folder page | ✅ | `folder/[folderId]/page.tsx` |
| 6 | Viewer: page nav, zoom, fit-width | ✅ | `PdfViewer.tsx` |
| 7 | Keyboard shortcuts (←→, +−, F, W) | ✅ | Full keyboard support |
| 8 | Performance Mode (fullscreen, tap-to-turn) | ✅ | + exit button cho touch |
| 9 | Half-Page Turn mode | ✅ | + boundary checks |
| 10 | Auto-Scroll with speed control | ✅ | +/- stepper, sub-pixel fix |
| 11 | Bookmarks (sections, quick-jump) | ✅ | localStorage-based |
| 12 | Mobile optimization | ✅ | iOS fixes, swipe, fixed footer |
| 13 | i18n (9 languages) | ✅ | All `messages/*.json` |

> [!TIP]
> **Phase 1: 13/13 hoàn thành ✅**

---

## Phase 2 — Enhanced Navigation

| # | Mục tiêu | Trạng thái | Ghi chú |
|---|----------|:----------:|---------|
| 1 | Navigation Map (D.C., D.S., Coda) | ❌ | Thiết kế xong, chưa code |
| 2 | Setlist Mode (ghép nhiều PDF) | ❌ | Chưa bắt đầu |
| 3 | Classroom integration (share PDF) | ❌ | Schema planned (`sheetMusicId` on Assignment) |
| 4 | Ecosystem links (`relatedProjectId`) | ❌ | DB field có, UI chưa |
| 5 | Dark mode (invert PDF colors) | ❌ | Chưa bắt đầu |
| 6 | Two-page side-by-side view | ✅ | Spread view, auto-disable mobile |
| 7 | Foot pedal support | ✅ | Remappable keys + visual feedback |
| 8 | Wake Lock API | ❌ | Chưa implement |

> [!NOTE]
> **Phase 2: 2/8 hoàn thành** — Spread View và Pedal đã xong (kéo từ Phase 2 lên Phase 1)

---

## Phase 3 — Advanced Features

| # | Mục tiêu | Trạng thái | Ghi chú |
|---|----------|:----------:|---------|
| 1 | Measure Markers (Smart Row) | ❌ | Thiết kế xong |
| 2 | Audio sync (playhead trên PDF) | ❌ | Cần measure markers trước |
| 3 | Annotation (highlight, notes) | ❌ | |
| 4 | Offline caching (Service Worker) | ❌ | |
| 5 | PDF download (Premium) | ❌ | |
| 6 | Shared annotations (Classroom) | ❌ | |

---

## Phase 4 — Monetization

| # | Mục tiêu | Trạng thái |
|---|----------|:----------:|
| 1 | Publish to marketplace | ❌ |
| 2 | Preview mode (N trang đầu) | ❌ |
| 3 | Purchase flow (LemonSqueezy) | ❌ |
| 4 | Product abstraction layer | ❌ |
| 5 | Discover "Sheets" tab | ❌ |

---

## Bonus: Đã implement nhưng KHÔNG có trong design doc

Những tính năng thêm ngoài roadmap:

| Feature | Mô tả |
|---------|-------|
| **Built-in Metronome** | BPM +/- stepper, tap tempo, time signature (2/4, 3/4, 4/4, 6/8) |
| **Swipe gestures** | Swipe left/right để chuyển trang trên touch |
| **Exit fullscreen button** | Floating button cho touch devices |
| **Fit Height mode** | View mode thứ 3, zoom page fit viewport height |
| **Three-dot menu** | Mobile-optimized condensed toolbar |
| **Popover migration** | Shadcn/Radix Popover cho tất cả dropdown |
| **Last page memory** | LocalStorage lưu trang cuối cùng đã xem |
| **Drag-drop to folder** | Kéo thả PDF vào folder trên library page |

---

## Đề xuất ưu tiên tiếp theo

### Quick Wins (dễ, giá trị cao)

| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 1 | **Wake Lock API** | ⭐ 30 phút | Màn hình không tắt khi biểu diễn |
| 2 | **Dark mode PDF** | ⭐⭐ 1 giờ | CSS `filter: invert(1)` trên canvas |
| 3 | **Auto-scroll tempo presets** | ⭐ 30 phút | Largo/Andante/Moderato/Allegro buttons |

### Medium Effort (1-2 ngày)

| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 4 | **Classroom share PDF** | ⭐⭐⭐ | Giáo viên share sheet cho học sinh |
| 5 | **Navigation Map (MVP)** | ⭐⭐⭐ | Bookmark-based section jump |
| 6 | **Setlist Mode** | ⭐⭐⭐ | Ghép nhiều PDF thành 1 concert flow |

### Long-term (1-2 tuần+)

| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 7 | **Measure Markers** | ⭐⭐⭐⭐ | Đánh dấu ô nhịp, sync audio |
| 8 | **Annotation** | ⭐⭐⭐⭐ | Ghi chú, highlight trên PDF |
| 9 | **Offline caching** | ⭐⭐⭐ | Service Worker cho offline access |

> [!IMPORTANT]
> **Đề xuất:** Wake Lock API và Dark mode nên làm sớm — rất ít effort nhưng cải thiện trải nghiệm biểu diễn đáng kể. Navigation Map MVP (bookmarks) đã có nền tảng bookmarks hiện tại, chỉ cần mở rộng.
