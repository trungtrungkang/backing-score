# PDF Phase 2 — 3 Features Design

## 1. Classroom Share PDF

### 1.1 Tổng quan

Teacher share PDF sheet music cho học sinh trong lớp. Hai use case:
- **Materials tab**: Share PDF tham khảo (không gắn assignment)
- **Assignment attachment**: Gắn PDF vào bài tập

### 1.2 Schema Changes

#### New collection: `classroom_materials`

```typescript
interface ClassroomMaterialDocument {
  $id: string;
  $createdAt: string;
  classroomId: string;     // Classroom nào
  sheetMusicId: string;    // PDF nào (ref → sheet_music)
  sharedById: string;      // Teacher nào share
  note?: string;           // Ghi chú (e.g., "Luyện trang 2-3")
}
```

#### Modify: `AssignmentDocument`

```diff
 export interface AssignmentDocument {
   ...existing fields...
+  sheetMusicId?: string;  // Optional PDF attachment
 }
```

### 1.3 UI Flow

#### A) Teacher share PDF → Classroom

```
Teacher vào PDF Library
  → Menu ⋮ trên PDF → "Share to Classroom"
  → Dialog: chọn classroom(s) + optional ghi chú
  → Create ClassroomMaterialDocument
  → Toast: "Shared to Piano Class 2026"
```

#### B) Classroom: Materials Tab (MỚI)

```
Classroom Detail Tabs:
[Assignments] [Members] [Materials] [Progress] [Settings]
                          ↑ NEW TAB

Materials Tab:
┌──────────────────────────────────────────────────┐
│ 📄 Materials                    [+ Share PDF]     │
├──────────────────────────────────────────────────┤
│ 🎵 Chopin Nocturne Op.9 No.2    4p  │ Open │ ⋮  │
│    "Luyện trang 2-3" — Ms. Hà                    │
│                                                   │
│ 🎵 Bach Cello Suite No.1        8p  │ Open │ ⋮  │
│    — Ms. Hà                                       │
└──────────────────────────────────────────────────┘
```

- **Teacher**: thấy nút [+ Share PDF], menu ⋮ có "Remove"
- **Student**: read-only, xem PDF qua viewer (không download)
- **"Open"**: mở PDF viewer `/dashboard/pdfs/view/[id]` (read-only mode cho student)

#### C) Assignment + PDF

```
Create Assignment:
├── Title, Description, Deadline
├── Source Project (audio backing track)
└── 📄 Attach Sheet Music (optional)    ← NEW
    └── Picker: chọn PDF từ thư viện teacher
        → Hiện thumbnail + title
```

Assignment detail page:
```
┌──────────────────────────────────────────────────┐
│ Assignment: Practice C Major Scale                │
│ Due: Apr 5, 2026                                  │
│                                                   │
│ 📄 Sheet Music: C Major Scale (2 pages)           │
│    [Open PDF →]                                   │
│                                                   │
│ 🎵 [Play Practice →]                             │
└──────────────────────────────────────────────────┘
```

### 1.4 Permission Model

| Hành động | Teacher | Student |
|---|---|---|
| Share PDF to classroom | ✅ | ❌ |
| Remove shared PDF | ✅ | ❌ |
| View shared PDF | ✅ | ✅ |
| Download PDF | ❌ | ❌ |
| Attach PDF to assignment | ✅ | ❌ |

### 1.5 Effort: ~2 ngày

| Task | Effort |
|---|---|
| Appwrite: create `classroom_materials` collection | 30 phút |
| Appwrite: add `sheetMusicId` to assignments | 15 phút |
| Types + CRUD functions | 1 giờ |
| Materials tab UI | 3 giờ |
| "Share to Classroom" dialog in PDF library | 2 giờ |
| Assignment form + detail: PDF picker | 2 giờ |
| Read-only viewer mode cho students | 1 giờ |
| i18n (9 languages) | 1 giờ |

---

## 2. Navigation Map (MVP)

### 2.1 Tổng quan

Mở rộng bookmark hiện tại thành **named sections** với **navigation sequence** để xử lý bản nhạc có repeat/D.C./D.S./Coda.

### 2.2 Approach: "Named Bookmarks + Sequence"

**Phase hiện tại**: Bookmarks chỉ lưu `Set<pageNumber>` trong localStorage, không có tên, không có thứ tự đọc.

**MVP mới**: Bookmarks có tên + thứ tự đọc tùy chỉnh.

### 2.3 Data Model

```typescript
// Thay thế Set<number> đơn giản
interface NamedBookmark {
  id: string;          // nanoid
  page: number;        // 1-based page
  name: string;        // "Verse", "Chorus", "Coda"
  color?: string;      // badge color
}

interface NavigationSequence {
  // Lộ trình đọc thực tế — mỗi step ref đến 1 bookmark
  steps: string[];     // Array of bookmark IDs theo thứ tự đọc
}

// Lưu localStorage (không cần DB cho MVP)
// Key: `pdf-nav-${title}`
// Value: JSON { bookmarks: NamedBookmark[], sequence: NavigationSequence }
```

### 2.4 UI — Bookmark Panel (nâng cấp)

```
Click 🔖 icon → Popover mở rộng:

┌──────────────────────────────────────┐
│ 📑 Sections              [+ Add]     │
├──────────────────────────────────────┤
│                                      │
│  Page 1:                             │
│  ┌──────────────────────────────┐    │
│  │ 🟢 Intro      │ [Go] [×]    │    │
│  │ 🔵 Verse      │ [Go] [×]    │    │
│  └──────────────────────────────┘    │
│                                      │
│  Page 2:                             │
│  ┌──────────────────────────────┐    │
│  │ 🟡 Chorus     │ [Go] [×]    │    │
│  │ 🔴 Bridge     │ [Go] [×]    │    │
│  └──────────────────────────────┘    │
│                                      │
│  Page 3:                             │
│  ┌──────────────────────────────┐    │
│  │ 🟣 Coda       │ [Go] [×]    │    │
│  └──────────────────────────────┘    │
│                                      │
├──────────────────────────────────────┤
│ 🗺️ Reading Order           [Edit]   │
│                                      │
│  1. Intro → 2. Verse → 3. Chorus    │
│  → 4. Verse (repeat) → 5. Chorus    │
│  → 6. Coda                          │
│                                      │
│  [▶ Follow Sequence]                │
└──────────────────────────────────────┘
```

### 2.5 Add Section Dialog

```
[+ Add] → inline form trên bookmark panel:

  Section name: [Verse      ]
  Color: 🟢 🔵 🟡 🔴 🟣 ⬜
  Page: [current page ▾]
  [Save]
```

### 2.6 Reading Order Editor

```
Click [Edit] trên Reading Order:

Drag-drop list:
┌──────────────────────────────────────┐
│ ≡ 1. Intro (p.1)           [×]      │
│ ≡ 2. Verse (p.1)           [×]      │
│ ≡ 3. Chorus (p.2)          [×]      │
│ ≡ 4. Verse (p.1)  ← repeat [×]     │
│ ≡ 5. Chorus (p.2)          [×]      │
│ ≡ 6. Coda (p.3)            [×]      │
│                                      │
│ [+ Add Step]  (dropdown: chọn section)│
│ [Save Order]                         │
└──────────────────────────────────────┘
```

### 2.7 "Follow Sequence" Mode

Khi bật:
- Navigation arrows (← →) đi theo sequence thay vì page number
- Auto-scroll nhảy theo sequence khi đến cuối section
- Visual banner nhỏ ở top: `▶ Step 3/6: Chorus (p.2)`
- Khi đến cuối sequence → dừng / loop lại từ đầu

### 2.8 Effort: ~2 ngày

| Task | Effort |
|---|---|
| Data model + localStorage migration | 1 giờ |
| Named bookmark CRUD (add/edit/delete) | 2 giờ |
| Bookmark panel UI redesign | 3 giờ |
| Reading order editor (drag-drop) | 3 giờ |
| "Follow Sequence" navigation logic | 3 giờ |
| Visual step indicator banner | 1 giờ |
| i18n (9 languages) | 1 giờ |

---

## 3. Setlist Mode

### 3.1 Tổng quan

Ghép nhiều PDF thành 1 chuỗi liên tục — cho concerts, gigs, worship sets.

### 3.2 Data Model

```typescript
interface Setlist {
  id: string;          // nanoid
  name: string;        // "Concert 28/3/2026"
  items: SetlistItem[];
  createdAt: string;
}

interface SetlistItem {
  sheetMusicId: string;  // ref → sheet_music.$id
  title: string;         // denormalized for display
  pageCount: number;     // denormalized
}

// Lưu localStorage (MVP) hoặc Appwrite collection (Phase 2)
// Key: `setlists`
// Value: JSON Setlist[]
```

### 3.3 UI — Setlist Manager

#### Library integration: tab mới

```
Library Tabs: [All PDFs] [Favorites ❤] [Recent] [Setlists 📋]
                                                  ↑ NEW TAB

Setlists Tab:
┌──────────────────────────────────────────────────┐
│ 📋 Setlists                     [+ New Setlist]   │
├──────────────────────────────────────────────────┤
│                                                   │
│ ┌───────────────────────────────────────────┐    │
│ │ 🎼 Concert 28/3/2026                      │    │
│ │ 3 pieces • 15 pages total                 │    │
│ │ [▶ Open]                    [Edit] [Delete]│    │
│ └───────────────────────────────────────────┘    │
│                                                   │
│ ┌───────────────────────────────────────────┐    │
│ │ 🎼 Sunday Worship                         │    │
│ │ 5 pieces • 22 pages total                 │    │
│ └───────────────────────────────────────────┘    │
│                                                   │
└──────────────────────────────────────────────────┘
```

#### Create/Edit Setlist Dialog

```
┌──────────────────────────────────────────────────┐
│ 📋 Edit Setlist                                   │
│                                                   │
│ Name: [Concert 28/3/2026              ]           │
│                                                   │
│ Songs:                                            │
│ ┌──────────────────────────────────────────┐     │
│ │ ≡ 1. Chopin Nocturne Op.9 No.2    4p [×]│     │
│ │ ≡ 2. Bach Cello Suite No.1        8p [×]│     │
│ │ ≡ 3. Canon in D                   3p [×]│     │
│ └──────────────────────────────────────────┘     │
│ Total: 15 pages                                   │
│                                                   │
│ [+ Add from Library]                              │
│                                                   │
│ [Save]                              [Cancel]      │
└──────────────────────────────────────────────────┘
```

- Drag-drop để sắp xếp thứ tự
- [+ Add from Library] → picker hiện toàn bộ PDFs

#### Setlist Viewer (mở rộng PdfViewer)

```
┌──────────────────────────────────────────────────┐
│ 📋 Concert 28/3/2026                              │
├──────────────────────────────────────────────────┤
│                                                   │
│  ┌─── Chopin Nocturne Op.9 No.2 ──────────┐     │
│  │ Page 1/4                                │     │
│  │ [sheet music content]                   │     │
│  │                                         │     │
│  └─────────────────────────────────────────┘     │
│  ... (scroll continues)                           │
│  ┌─── Bach Cello Suite No.1 ──────────────┐     │
│  │ Page 1/8                                │     │
│  │ [sheet music content]                   │     │
│  └─────────────────────────────────────────┘     │
│                                                   │
├──────────────────────────────────────────────────┤
│ ◀ │ 5 of 15 (Cello Suite p.1) │ ▶    │ auto │   │
└──────────────────────────────────────────────────┘
```

- **Đánh số trang liên tục**: 1→15 (không reset mỗi bài)
- **Song divider**: thanh separator nhỏ giữa các bài
- **Page indicator**: hiện cả trang tổng + tên bài đang xem
- Tất cả features viewer hiện tại đều hoạt động (auto-scroll, metronome, pedal...)

### 3.4 Route

```
/dashboard/pdfs/setlist/[setlistId]  → Setlist Viewer
```

### 3.5 PdfViewer Props Extension

```typescript
// Hiện tại:
<PdfViewer pdfUrl={url} title={title} numPages={n} />

// Mở rộng cho setlist:
<PdfViewer
  mode="setlist"
  setlistItems={[
    { pdfUrl: url1, title: "Chopin...", numPages: 4 },
    { pdfUrl: url2, title: "Bach...", numPages: 8 },
    { pdfUrl: url3, title: "Canon...", numPages: 3 },
  ]}
/>
```

### 3.6 Effort: ~3 ngày

| Task | Effort |
|---|---|
| Data model + localStorage CRUD | 1 giờ |
| Setlist manager page (list + create/edit) | 4 giờ |
| Library tab integration | 1 giờ |
| Setlist viewer route + page | 2 giờ |
| PdfViewer multi-PDF support | 4 giờ |
| Page counter logic (cross-PDF numbering) | 2 giờ |
| Song dividers + visual indicators | 1 giờ |
| i18n (9 languages) | 1 giờ |

---

## Tổng kết

| Feature | Effort | Priority |
|---------|--------|----------|
| Classroom Share PDF | ~2 ngày | 🔴 Cao — cần cho use case giảng dạy |
| Navigation Map MVP | ~2 ngày | 🟡 Trung bình — cải thiện UX cho nhạc có repeat |
| Setlist Mode | ~3 ngày | 🟢 Nice-to-have — cho performers |

> [!IMPORTANT]
> **Đề xuất thứ tự**: Classroom Share → Navigation Map → Setlist
> 
> Classroom Share gắn liền với use case giảng dạy (core business). Navigation Map cải thiện trải nghiệm hàng ngày cho mọi user. Setlist serve niche nhỏ hơn (performers) nên ưu tiên sau.

## Open Questions

> [!WARNING]
> 1. **Setlist storage**: localStorage (MVP, mất khi clear browser) hay Appwrite collection (cần thêm backend setup)?
> 2. **Navigation Map**: Có cần đồng bộ cross-device không? Nếu có → cần lưu Appwrite thay vì localStorage.
> 3. **Classroom Materials**: Permission model nào cho student xem PDF? Copy file hay chỉ grant read access qua Appwrite permissions?
