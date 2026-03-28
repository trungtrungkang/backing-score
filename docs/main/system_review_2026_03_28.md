# Backing & Score — Đánh Giá Tổng Thể Hệ Thống

**Ngày:** 2026-03-28  
**Mục tiêu:** Nhìn lại bức tranh toàn cảnh, xác định điểm chưa nhất quán

---

## 1. Bức Tranh Tổng Thể — 10 Modules

```
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKING & SCORE PLATFORM                       │
│                                                                     │
│  CREATOR TOOLS ─────────────────────────────────────────────────── │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Editor   │  │ Academy  │  │Classroom │  │ PDF Sheet Music  │   │
│  │ (Project │  │ (Course  │  │ (Assign, │  │ (Upload, Library │   │
│  │  MusicXML│  │  Lesson) │  │  Grade)  │  │  Viewer)         │   │
│  │  Audio)  │  │          │  │          │  │                  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│       │              │             │                  │             │
│  CONSUMER EXPERIENCE ───────────────────────────────────────────── │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Player   │  │ Academy  │  │Classroom │  │ PDF Viewer       │   │
│  │ (Play,   │  │ (Learn,  │  │ (Practice│  │ (Read, Auto-     │   │
│  │  Wait    │  │  Enroll, │  │  Submit, │  │  scroll, Perform)│   │
│  │  Mode)   │  │  Progress│  │  Record) │  │                  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│       │              │             │                  │             │
│  DISCOVERY & SOCIAL ────────────────────────────────────────────── │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Discover │  │ Wiki     │  │ Feed     │  │ Notifications    │   │
│  │ (Browse, │  │ (Artists,│  │ (Posts,  │  │ (Bell, In-app)   │   │
│  │  Search) │  │  Instrum)│  │  Follow) │  │                  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
│                                                                     │
│  INFRASTRUCTURE ────────────────────────────────────────────────── │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Auth     │  │ i18n     │  │ Payment  │  │ Storage          │   │
│  │ (Login,  │  │ (9 langs)│  │ (Lemon   │  │ (Appwrite)       │   │
│  │  Session)│  │          │  │  Squeezy)│  │                  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Danh Sách Điểm Chưa Nhất Quán

### ⚠️ 2.1 — "Project" quá tải ngữ nghĩa

**Hiện tại:** `Project` vừa là:
- Workspace soạn nhạc (Creator tạo, edit)
- Bản nhạc trên Discover (Consumer browse, play)
- Bài tập trên Classroom (Teacher assign)
- Target cho Favorites, Reactions, Play count

**Vấn đề:** Cùng 1 entity nhưng serve 4 use cases khác nhau → gây nhầm lẫn khi mở rộng (VD: bán content → "project" hay "product"?)

**Đề xuất:** Giữ `Project` (internal) nhưng thêm abstraction layer "Product" cho marketplace/commerce. UI user-facing nên gọi là "Score" hoặc "Track" thay vì "Project".

---

### ⚠️ 2.2 — Favorites chỉ hỗ trợ 2 types

**Hiện tại:** `targetType: "project" | "playlist"` — chỉ favorite project hoặc playlist.

**Thiếu:** Không thể favorite:
- Wiki article (bài viết hay về 1 nhạc sĩ)
- Academy course
- PDF sheet music
- Community post

**Đề xuất:** Mở rộng `targetType` thành polymorphic rộng hơn: `"project" | "playlist" | "course" | "sheet_music" | "wiki_entity"`

---

### ⚠️ 2.3 — Academy vs Classroom — Ranh giới mờ

| | Academy | Classroom |
|---|---|---|
| Mô hình | Self-paced, creator tạo course | Live, teacher quản lý lớp |
| Progress | `progress` collection | `submissions` collection |
| Content | Lessons (TipTap + SnippetPlayer) | Assignments (link đến Project) |
| Enrollment | `enrollments` | `classroom_members` |

**Vấn đề:** 
- Cả hai dạy nhạc nhưng schema/logic hoàn toàn tách biệt
- Teacher muốn dùng Course content trong Classroom → không có kết nối
- Student progress ở 2 nơi khác nhau

**Đề xuất:** Classroom nên có thể **import lessons từ Academy courses** vào assignments. Unify progress tracking dưới 1 hệ thống.

---

### ⚠️ 2.4 — Discover chỉ show Projects

**Hiện tại:** `/discover` chỉ query `projects` collection.

**Thiếu:** Không discover được:
- Academy courses
- Published playlists (có nhưng nhỏ)
- PDF sheets (tương lai)
- Wiki content

**Đề xuất:** Discover nên là unified content hub hoặc có tabs rõ ràng: Scores | Courses | Collections | Sheets.

---

### ⚠️ 2.5 — Permissions không nhất quán

| Module | Permission mechanism |
|---|---|
| Projects | Document-level (`Role.any()` read) |
| Wiki | User labels (`admin`, `wiki_editor`) |
| Classroom | Custom check (`teacherId === user.$id`) |
| Admin | Client-side route guard (chưa có server check) |
| Academy | `creatorId === user.$id` |

**Vấn đề:** 4 cơ chế phân quyền khác nhau. RBAC (§20 system_design) vẫn ở trạng thái "thiết kế".

**Đề xuất:** Triển khai RBAC thống nhất — tất cả module dùng cùng 1 hệ thống permission.

---

### ⚠️ 2.6 — Dashboard sidebar quá đông

**Hiện tại:** 8 items + thêm PDFs = 9 items

```
My Uploads | Collections | Favorites | Analytics | Classroom
Creator Courses | User Guide | Premium | PDFs (mới)
```

**Đề xuất:** Nhóm lại:
```
LIBRARY (My Uploads, PDFs, Collections, Favorites)
TEACH (Classroom, Creator Courses)
OTHER (Analytics, Guide, Premium)
```

---

### ⚠️ 2.7 — PDF Sheet Music chưa kết nối với ecosystem

**Hiện tại (thiết kế):** PDF là module hoàn toàn độc lập.

**Thiếu kết nối:**
- Không link PDF ↔ Project (cùng bài nhạc nhưng 2 format)
- Không link PDF ↔ Wiki Composition
- Không hiện trên Discover
- Không có trong Feed/Social

**Đề xuất:** Thêm optional `relatedProjectId` và `wikiCompositionId` vào `sheet_music` schema để tạo cross-reference.

---

### ⚠️ 2.8 — Monetization roadmap chưa rõ product boundary

| Sellable item hiện tại | Cơ chế |
|---|---|
| Platform subscription | LemonSqueezy recurring |
| Individual project | ❌ Chưa có |
| PDF sheet | ❌ Chưa có |
| Course | Has `priceCents` field nhưng chưa có checkout |
| Bundle | ❌ Chưa có concept |

**Đề xuất:** Cần thiết kế "Product" layer thống nhất trước khi implement per-item sales. Tránh tạo 4 checkout flows riêng cho 4 loại content.

---

## 3. Đề Xuất Kiến Trúc Cải Tiến

### 3.1 Content Layer — Thống nhất "sellable items"

```
                    ┌─────────────┐
                    │   Product   │  ← Abstraction layer mới
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

### 3.2 Unified Favorites

```
favorites → { userId, targetType, targetId }
  targetType: "project" | "playlist" | "course" | "sheet_music" | "wiki_*"
```

### 3.3 Permission — RBAC đồng nhất

```
Middleware → extractUserRole()
  ↓
Route/Action → requireRole("creator" | "teacher" | "admin" | "wiki_editor")
  ↓
Document → Appwrite document-level permissions (giữ nguyên)
```

---

## 4. Độ Ưu Tiên Xử Lý

| # | Vấn đề | Ưu tiên | Effort | Khi nào |
|---|---|---|---|---|
| 1 | Sidebar quá đông (§2.6) | 🔴 Cao | Thấp | Sprint hiện tại |
| 2 | Permissions không nhất quán (§2.5) | 🔴 Cao | Trung bình | Sprint 1 |
| 3 | PDF chưa kết nối ecosystem (§2.7) | 🟡 TB | Thấp | Khi build PDF |
| 4 | Favorites mở rộng (§2.2) | 🟡 TB | Thấp | Sprint 2 |
| 5 | Academy-Classroom overlap (§2.3) | 🟡 TB | Cao | Dài hạn |
| 6 | Discover chỉ show Projects (§2.4) | 🟡 TB | Trung bình | Khi có multi-product |
| 7 | "Product" abstraction (§2.8) | 🟢 Thấp | Cao | Khi cần marketplace |
| 8 | "Project" rename user-facing (§2.1) | 🟢 Thấp | Trung bình | Dài hạn |

---

*Tài liệu phục vụ mục đích review nội bộ. Cập nhật khi có quyết định.*
