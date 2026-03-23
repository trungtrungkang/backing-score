# Backing & Score — Tài Liệu Phân Tích Thiết Kế Hệ Thống

**Phiên bản:** 3.0 (Public Beta)  
**Cập nhật:** 2026-03-23  
**Tác giả:** Đội ngũ kỹ thuật Backing & Score

---

## Mục Lục

1. [Tổng Quan Kiến Trúc Hệ Thống](#1-tổng-quan-kiến-trúc-hệ-thống)
2. [Sơ Đồ Kiến Trúc Tầng (Layered Architecture)](#2-sơ-đồ-kiến-trúc-tầng)
3. [Ngăn Xếp Công Nghệ & Thư Viện](#3-ngăn-xếp-công-nghệ--thư-viện)
4. [Thiết Kế Cơ Sở Dữ Liệu (Data Model)](#4-thiết-kế-cơ-sở-dữ-liệu)
5. [Hệ Thống Xác Thực & Phân Quyền](#5-hệ-thống-xác-thực--phân-quyền)
6. [Audio Engine — Thiết Kế Xử Lý Tín Hiệu](#6-audio-engine--thiết-kế-xử-lý-tín-hiệu)
7. [Wait Mode — Thiết Kế Cơ Chế Đánh Giá](#7-wait-mode--thiết-kế-cơ-chế-đánh-giá)
8. [Content Authoring System (Editor)](#8-content-authoring-system-editor)
9. [Interactive Player — Thiết Kế Trình Phát](#9-interactive-player--thiết-kế-trình-phát)
10. [Academy — Thiết Kế Module Giáo Dục](#10-academy--thiết-kế-module-giáo-dục)
11. [Social — Thiết Kế Hệ Thống Cộng Đồng](#11-social--thiết-kế-hệ-thống-cộng-đồng)
12. [Discovery & Playlists — Thiết Kế Khám Phá](#12-discovery--playlists--thiết-kế-khám-phá)
13. [Live Collaboration — Thiết Kế Cộng Tác](#13-live-collaboration--thiết-kế-cộng-tác)
14. [Đa Ngôn Ngữ (i18n) — Thiết Kế Quốc Tế Hóa](#14-đa-ngôn-ngữ--thiết-kế-quốc-tế-hóa)
15. [Hạ Tầng Triển Khai & Lưu Trữ](#15-hạ-tầng-triển-khai--lưu-trữ)
16. [Thiết Kế Mở Rộng — Bách Khoa Toàn Thư](#16-thiết-kế-mở-rộng--bách-khoa-toàn-thư)
17. [Thiết Kế Mở Rộng — Phân Tích & Thích Ứng](#17-thiết-kế-mở-rộng--phân-tích--thích-ứng)
18. [Thiết Kế Mở Rộng — Thanh Toán & Kiếm Tiền](#18-thiết-kế-mở-rộng--thanh-toán--kiếm-tiền)
19. [Đánh Giá Rủi Ro & Hạn Chế](#19-đánh-giá-rủi-ro--hạn-chế)

---

## 1. Tổng Quan Kiến Trúc Hệ Thống

### 1.1 Triết Lý Thiết Kế

Backing & Score được xây dựng theo nguyên tắc **Client-Heavy Architecture** (Kiến trúc nặng phía Client):

- **Xử lý âm thanh (Audio Engine):** Hoàn toàn chạy trên trình duyệt người dùng thông qua Web Audio API. Không có round-trip nào tới server cho việc phân tích âm thanh, đảm bảo độ trễ < 20ms.
- **Server-side:** Chỉ chịu trách nhiệm lưu trữ dữ liệu (CRUD), xác thực người dùng, và phục vụ file tĩnh. Sử dụng Appwrite làm BaaS (Backend-as-a-Service).
- **Rendering:** Kết hợp Server-Side Rendering (SSR) cho SEO và Client-Side Rendering (CSR) cho các giao diện tương tác cao.

### 1.2 Nguyên Tắc Kiến Trúc

| Nguyên tắc | Mô tả |
|---|---|
| Tối giản server-side | Giảm chi phí vận hành bằng cách xử lý audio/MIDI phía client |
| Tách biệt quan tâm | Mỗi module (Editor, Player, Academy, Social) hoạt động độc lập |
| Quyền cấp document | Appwrite document-level permissions thay vì role-based ACL |
| Progressive Enhancement | Ứng dụng hoạt động cơ bản không cần Microphone/MIDI, tăng cường khi có |

---

## 2. Sơ Đồ Kiến Trúc Tầng

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                         │
│  Next.js App Router │ React Server Components │ Tailwind + shadcn  │
│                                                                     │
│  Trang:  / │ /discover │ /academy │ /feed │ /dashboard │ /wiki*    │
│  Layout: [locale]/layout.tsx (Header, LanguageSwitcher, Theme)      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                       APPLICATION LAYER                             │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │  Editor   │ │  Player  │ │ Academy  │ │  Social  │ │  Live    │ │
│  │  Shell    │ │  Shell   │ │ (Courses │ │ (Feed,   │ │  Shell   │ │
│  │          │ │ Controls │ │  Lessons)│ │  Follow) │ │          │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ │
│       │            │            │            │            │        │
│  ┌────▼────────────▼────────────▼────────────▼────────────▼─────┐  │
│  │                    HOOKS LAYER                                │  │
│  │  useScoreEngine │ useMicInput │ useMidiInput                  │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                         DATA LAYER                                  │
│                                                                     │
│  src/lib/appwrite/                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │projects.ts│ │courses.ts│ │social.ts │ │playlists │              │
│  │          │ │lessons.ts│ │          │ │favorites │              │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘              │
│       └──────┬─────┴──────┬─────┴──────┬─────┘                     │
│              │  client.ts (Appwrite SDK Instance)   │               │
│              │  constants.ts (Collection IDs)       │               │
│              │  types.ts (TypeScript Interfaces)    │               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                     INFRASTRUCTURE LAYER                            │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │ Appwrite Cloud   │  │ Appwrite Storage│  │ Vercel Edge      │    │
│  │ (DB, Auth, Func) │  │ (Media Files)   │  │ (CDN, SSR)       │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
│                                                                     │
│  Tương lai: cân nhắc chuyển media sang Cloudflare R2 (zero egress) │
└─────────────────────────────────────────────────────────────────────┘

* /wiki = Tính năng dự kiến (Music Encyclopedia)
```

---

## 3. Ngăn Xếp Công Nghệ & Thư Viện

### 3.1 Dependencies Chính

| Thư viện | Phiên bản | Vai trò |
|---|---|---|
| `next` | ^16.1.6 | Framework web (App Router, RSC) |
| `react` / `react-dom` | ^19.2.4 | UI library |
| `appwrite` | ^23.0.0 | Client SDK — xác thực, CSDL, lưu trữ |
| `node-appwrite` | ^22.1.3 | Server SDK — Server Actions |
| `next-intl` | ^4.8.3 | Đa ngôn ngữ (i18n) |
| `@tiptap/*` | ^3.20.4 | Rich text editor (ProseMirror) |
| `verovio` | ^6.1.0 | Renderer bản nhạc từ MusicXML → SVG |
| `pitchfinder` | ^2.3.4 | Thuật toán nhận diện cao độ (pitch detection) |
| `@tonejs/midi` | ^2.0.28 | Phân tích / tạo file MIDI |
| `@soundtouchjs/audio-worklet` | ^1.0.7 | Điều chỉnh nhịp độ âm thanh (time-stretching) |
| `@xmldom/xmldom` | ^0.8.11 | Phân tích XML (MusicXML parsing) |
| `jszip` | ^3.10.1 | Nén/giải nén MXL (MusicXML compressed) |
| `canvas-confetti` | ^1.9.4 | Hiệu ứng pháo hoa Gamification |
| `sonner` | ^2.0.7 | Toast notifications |
| `lucide-react` | ^0.577.0 | Bộ icon |

### 3.2 UI Components

| Thư viện | Vai trò |
|---|---|
| `tailwindcss` + `tailwind-merge` | Utility-first CSS |
| `@radix-ui/*` | Accessible primitives (Dialog, Dropdown, Slider, Tabs, Tooltip, Popover) |
| `class-variance-authority` | Component variant management |
| `next-themes` | Dark/Light mode toggle |
| `react-draggable` | Drag-and-drop cho timeline editing |

### 3.3 Testing

| Thư viện | Vai trò |
|---|---|
| `vitest` ^4.1.0 | Test runner |
| `@testing-library/react` | Component testing |
| `jsdom` | Browser simulation |

---

## 4. Thiết Kế Cơ Sở Dữ Liệu

### 4.1 Sơ Đồ Quan Hệ Thực Thể (ER Diagram)

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    users     │       │   projects   │       │  playlists   │
│ (Appwrite    │◄──┐   │              │   ┌──►│              │
│  Auth)       │   │   │ userId ──────┼───┘   │ ownerId      │
│              │   │   │ name         │       │ name         │
│              │   │   │ mode         │       │ projectIds[] │
│              │   │   │ payload(JSON)│       │ isPublished  │
│              │   │   │ published    │       └──────────────┘
│              │   │   │ tags[]       │
│              │   │   │ instruments[]│       ┌──────────────┐
│              │   │   │ difficulty   │       │  favorites   │
│              │   │   │ durationSec  │       │              │
│              │   │   └──────────────┘       │ userId       │
│              │   │                          │ targetType   │
│              │   │   ┌──────────────┐       │ targetId     │
│              │   ├──►│   courses    │       └──────────────┘
│              │   │   │              │
│              │   │   │ creatorId    │       ┌──────────────┐
│              │   │   │ title        │       │ enrollments  │
│              │   │   │ priceCents   │   ┌──►│              │
│              │   │   │ published    │   │   │ userId       │
│              │   │   │ category     │   │   │ courseId     │
│              │   │   │ difficulty   │   │   │ enrolledAt   │
│              │   │   └───────┬──────┘   │   └──────────────┘
│              │   │           │          │
│              │   │   ┌───────▼──────┐   │   ┌──────────────┐
│              │   │   │   lessons    │   │   │   progress   │
│              │   │   │              │   │   │              │
│              │   │   │ courseId     │   │   │ userId       │
│              │   │   │ title       │   │   │ courseId     │
│              │   │   │ orderIndex  │   │   │ lessonId     │
│              │   │   │ contentRaw  │   │   │ waitModeScore│
│              │   │   │ (Tiptap JSON)│  │   │completedSnip│
│              │   │   │ published   │   │   │ unlocked     │
│              │   │   └─────────────┘   │   └──────────────┘
│              │   │                     │
│              │   │   ┌──────────────┐  │   ┌──────────────┐
│              │   ├──►│    posts     │  │   │   comments   │
│              │   │   │              │  │   │              │
│              │   │   │ authorId     │  │   │ postId       │
│              │   │   │ content      │◄─┼───│ authorId     │
│              │   │   │ attachType   │  │   │ content      │
│              │   │   │ attachId     │  │   └──────────────┘
│              │   │   └──────────────┘  │
│              │   │                     │   ┌──────────────┐
│              │   │   ┌──────────────┐  │   │  reactions   │
│              │   ├──►│   follows    │  │   │              │
│              │   │   │              │  │   │ targetType   │
│              │   │   │ followerId   │  │   │ targetId     │
│              │   │   │ followingId  │  │   │ userId       │
│              │   │   └──────────────┘  │   │ type         │
│              │   │                     │   └──────────────┘
└──────────────┘   │
                   └─── Tất cả liên kết qua userId / creatorId / authorId
```

### 4.2 Chi Tiết Document Schema

#### `projects` — Dự án / Bản nhạc

| Field | Type | Mô tả |
|---|---|---|
| `userId` | string | ID chủ sở hữu (Appwrite user) |
| `name` | string | Tên dự án |
| `mode` | enum: `practice` \| `arrange` \| `chart` | Chế độ dự án |
| `payload` | string (JSON) | Toàn bộ dữ liệu dự án (tracks, arrangement, sections) |
| `payloadVersion` | integer | Phiên bản schema payload |
| `published` | boolean | Trạng thái xuất bản công khai |
| `publishedAt` | datetime | Thời điểm xuất bản |
| `coverUrl` | string | URL ảnh bìa |
| `description` | string | Mô tả dự án |
| `creatorEmail` | string | Email tác giả |
| `tags[]` | string[] | Thẻ phân loại (thể loại, nhạc cụ) |
| `instruments[]` | string[] | Danh sách nhạc cụ sử dụng |
| `difficulty` | integer | Mức độ khó (1-5) |
| `durationSec` | integer | Thời lượng (giây) |

**Quyền truy cập:** Document-level permissions  
- Bản nháp: chỉ owner đọc/sửa/xóa  
- Đã xuất bản: `Role.any()` đọc, owner sửa/xóa

#### `courses` — Khóa học

| Field | Type | Mô tả |
|---|---|---|
| `creatorId` | string | ID người tạo khóa học |
| `title` | string | Tên khóa học |
| `description` | string | Mô tả |
| `priceCents` | integer | Giá (cent), 0 = miễn phí |
| `coverUrl` | string | Ảnh bìa |
| `published` | boolean | Trạng thái xuất bản |
| `category` | string | Danh mục (Music Theory, Piano, Guitar...) |
| `difficulty` | string | Cấp độ (Beginner, Intermediate, Advanced) |

#### `lessons` — Bài học

| Field | Type | Mô tả |
|---|---|---|
| `courseId` | string | ID khóa học cha |
| `title` | string | Tên bài học |
| `orderIndex` | integer | Thứ tự trong khóa học |
| `contentRaw` | string (JSON) | Nội dung Tiptap JSON (rich text + nhúng nhạc) |
| `published` | boolean | Trạng thái xuất bản |

#### `progress` — Tiến trình học viên

| Field | Type | Mô tả |
|---|---|---|
| `userId` | string | ID học viên |
| `courseId` | string | ID khóa học |
| `lessonId` | string | ID bài học |
| `waitModeScore` | integer | Điểm cao nhất đạt được (0-100) |
| `completedSnippets[]` | string[] | Danh sách snippetId đã hoàn thành (≥80 điểm) |
| `unlocked` | boolean | Bài học tiếp theo đã mở khóa chưa |
| `completedAt` | datetime | Thời điểm hoàn thành |

**Logic mở khóa:** `unlocked = true` khi `completedSnippets.length >= totalSnippets` trong bài học đó. Ngưỡng tính hoàn thành: **≥ 80 điểm**.

#### `playlists` — Bộ sưu tập

| Field | Type | Mô tả |
|---|---|---|
| `ownerId` | string | ID chủ sở hữu |
| `name` | string | Tên playlist |
| `description` | string | Mô tả |
| `isPublished` | boolean | Công khai / riêng tư |
| `coverImageId` | string | ID ảnh bìa (Appwrite Storage) |
| `projectIds[]` | string[] | Danh sách ID dự án |

#### `posts`, `comments`, `reactions`, `follows` — Xã hội

| Collection | Trường chính | Ghi chú |
|---|---|---|
| `posts` | authorId, content, attachmentType, attachmentId | attachmentType: `project` \| `playlist` \| `none` |
| `comments` | postId, authorId, content | Liên kết 1-n với posts |
| `reactions` | targetType, targetId, userId, type | Đa hình: target = post \| comment \| project \| playlist |
| `follows` | followerId, followingId | Quan hệ một chiều, có unique constraint |

#### `favorites` — Yêu thích

| Field | Type | Mô tả |
|---|---|---|
| `userId` | string | ID người dùng |
| `targetType` | enum: `project` \| `playlist` | Loại đối tượng |
| `targetId` | string | ID đối tượng |

---

## 5. Hệ Thống Xác Thực & Phân Quyền

### 5.1 Xác Thực (Authentication)

```
Đăng ký (/signup) → Appwrite account.create()
    ↓
Gửi email xác minh → account.createVerification()
    ↓
Xác minh (/verify) → account.updateVerification()
    ↓
Đăng nhập (/login) → account.createEmailPasswordSession()
    ↓
Session cookie tự động quản lý bởi Appwrite SDK
```

### 5.2 Phân Quyền (Authorization)

Hệ thống sử dụng **Document-level Permissions** của Appwrite thay vì RBAC truyền thống:

| Hành động | Permission Rule |
|---|---|
| Tạo dự án | Owner: read + update + delete |
| Xuất bản dự án | Thêm `Role.any()` read |
| Hủy xuất bản | Xóa `Role.any()` read, giữ owner permissions |
| Đăng bài Feed | `Role.any()` read (công khai), owner update + delete |
| Xem bài người khác | `Role.any()` read |
| Follow | `Role.any()` read, follower delete |

---

## 6. Audio Engine — Thiết Kế Xử Lý Tín Hiệu

### 6.1 Pipeline Xử Lý

```
┌───────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Input Source      │     │  Processing      │     │  Output        │
│                   │     │                  │     │                │
│  Microphone ──────┼────►│  AnalyserNode    │     │  Pitch (Hz)    │
│  (getUserMedia)   │     │  FFT (2048)      │────►│  Note Name     │
│                   │     │  Autocorrelation │     │  Confidence %  │
│  MIDI Keyboard ──►│     │  (pitchfinder)   │     │                │
│  (WebMIDI API)    │     │                  │     │  → ScoreEngine │
└───────────────────┘     └──────────────────┘     └────────────────┘
```

### 6.2 Thư Viện Xử Lý

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| Thu âm | `navigator.mediaDevices.getUserMedia` | Capture audio stream |
| Phân tích tần số | Web Audio `AnalyserNode` + `pitchfinder` | Chuyển đổi sóng âm → tần số Hz |
| MIDI parsing | WebMIDI API + `@tonejs/midi` | Note-On/Off events |
| Time-stretching | `@soundtouchjs/audio-worklet` | Thay đổi nhịp độ không đổi cao độ |
| Ký hiệu nhạc | `verovio` + `@xmldom/xmldom` | MusicXML → SVG rendering |

### 6.3 Ràng Buộc Thiết Kế
- **Không gửi audio lên server** — toàn bộ xử lý client-side
- **Độ trễ mục tiêu:** < 20ms (analyser → pitch detection → UI feedback)
- **Fallback:** Nếu không có Mic/MIDI, người dùng vẫn dùng được Player ở chế độ phát lại thông thường

---

## 7. Wait Mode — Thiết Kế Cơ Chế Đánh Giá

### 7.1 State Machine

```
                    ┌─────────────────┐
                    │   IDLE          │
                    │ (Player dừng)   │
                    └────────┬────────┘
                             │ User bấm Play + Wait Mode ON
                             ▼
                    ┌─────────────────┐
               ┌───►│   WAITING       │◄──────────────┐
               │    │ (Chờ input)     │               │
               │    └────────┬────────┘               │
               │             │ Phát hiện âm thanh      │
               │             ▼                        │
               │    ┌─────────────────┐               │
               │    │   EVALUATING    │               │
               │    │ (So sánh pitch) │               │
               │    └───┬────────┬────┘               │
               │        │        │                    │
               │   Đúng │        │ Sai               │
               │        ▼        ▼                    │
               │  ┌──────────┐ ┌──────────┐           │
               │  │ ADVANCE  │ │ RETRY    │───────────┘
               │  │ (Tiến    │ │ (Giữ vị  │
               │  │  nốt)    │ │  trí)    │
               │  └────┬─────┘ └──────────┘
               │       │
               │       │ Còn nốt tiếp
               └───────┘
                       │ Hết bài
                       ▼
              ┌─────────────────┐
              │   COMPLETED     │
              │ (Hiển thị điểm) │
              └─────────────────┘
```

### 7.2 Thuật Toán Đánh Giá

```typescript
// Pseudo-code logic trong useScoreEngine
function evaluateNote(detectedPitch: number, expectedNote: MusicNote): boolean {
  const expectedFreq = noteToFrequency(expectedNote);  // VD: C4 = 261.63 Hz
  const cents = 1200 * Math.log2(detectedPitch / expectedFreq);
  return Math.abs(cents) <= TOLERANCE_CENTS;  // Mặc định: ±50 cents
}
```

### 7.3 Tích Hợp Với Academy (Progress Tracking)

```
Wait Mode kết thúc
    ↓
Tính điểm score (0-100)
    ↓
Gọi Server Action: saveWaitModeScore()
    ↓
score ≥ 80?  ──Yes──► Thêm snippetId vào completedSnippets[]
    │                     ↓
    │              completedSnippets.length >= totalSnippets?
    │                     ↓ Yes
    │              unlocked = true → Mở khóa bài học tiếp theo
    │
    └──No──► Lưu điểm, khuyến khích thử lại
```

---

## 8. Content Authoring System (Editor)

### 8.1 Cấu Trúc Component

```
EditorShell (57KB — component lớn nhất)
├── TransportBar       — Điều khiển phát lại (play/pause/BPM/metronome/loop)
├── TimelineRuler      — Thước đo nhịp/phách
├── TrackList           — Danh sách track với controls (volume/pan/mute/solo)
│   └── Waveform       — Hiển thị dạng sóng cho mỗi track
├── MusicXMLVisualizer  — Render bản nhạc SVG từ MusicXML
├── PianoRollRegion     — MIDI piano roll view
├── MeasureMapEditor    — Chỉnh sửa cấu trúc nhịp
├── TiptapEditor        — Rich text editor cho nội dung bài học
│   └── extensions/     — Custom Tiptap extensions (nhúng nhạc)
├── ProjectSelectorModal— Chọn dự án để nhúng
└── GamificationProvider— Context cho điểm/streak/thành tích
```

### 8.2 Payload Structure (ProjectDocument.payload)

```json
{
  "version": 1,
  "viewType": "practice",
  "tracks": [
    {
      "id": "track-1",
      "name": "Piano",
      "instrument": "piano",
      "audioFileId": "abc123",
      "volume": 0.8,
      "pan": 0,
      "muted": false,
      "solo": false
    }
  ],
  "musicxml": "<score-partwise>...</score-partwise>",
  "arrangement": { ... },
  "sectionLibrary": [ ... ],
  "bpm": 120,
  "timeSignature": "4/4"
}
```

### 8.3 Luồng Tạo Nội Dung

```
Creator mở Dashboard
    ↓
Tạo Project mới (name, mode, tags)
    ↓
EditorShell mở ra
    ↓
    ├── Upload audio files → Appwrite Storage
    ├── Import MusicXML → verovio renders SVG preview
    ├── Viết nội dung rich text (nếu lesson)
    ├── Cấu hình Wait Mode sections
    └── Chỉnh sửa tracks, BPM, time signature
    ↓
Lưu → JSON.stringify(payload) → Appwrite updateDocument
    ↓
Xuất bản → Thêm Permission Role.any() read → Hiển thị trên Discover
```

---

## 9. Interactive Player — Thiết Kế Trình Phát

### 9.1 Hai Loại Player

| Player | Route | Mục đích | Kích thước |
|---|---|---|---|
| `SnippetPlayer` | Nhúng trong bài học / Discover | Phát đoạn nhạc ngắn trong context | 36KB |
| `PlayShell` + `PlayerControls` | `/play/[projectId]` | Toàn màn hình, đầy đủ tính năng | 8KB + 37KB |

### 9.2 Luồng Phát Lại

```
Người dùng mở /play/[projectId]
    ↓
getProject(projectId) → load ProjectDocument
    ↓
JSON.parse(payload) → extract tracks, musicxml, bpm
    ↓
    ├── Tạo AudioContext + AudioBufferSourceNode cho mỗi track
    ├── Render MusicXML → SVG (verovio)
    └── Khởi tạo useScoreEngine
    ↓
Phát lại:
    ├── Mỗi track phát audio đồng bộ theo BPM
    ├── Con trỏ di chuyển trên bản nhạc
    ├── Nếu Wait Mode ON → tắt backing, chờ input
    └── Mixer: người dùng mute/solo/volume từng track
```

---

## 10. Academy — Thiết Kế Module Giáo Dục

### 10.1 Luồng Dữ Liệu

```
/academy
    ↓ getPublishedCourses()
Danh sách khóa học
    ↓ User chọn khóa
/c/[courseId]
    ↓ getCourseById() + getLessonsByCourse() + checkEnrollment()
    ↓ getStudentProgress(userId, courseId)
    
Sidebar: danh sách bài học với biểu tượng khóa/mở
    ↓ User chọn bài
Nội dung bài: TiptapViewer render contentRaw
    ↓ Gặp SnippetPlayer nhúng
    ↓ User bật Wait Mode
    ↓ Hoàn thành → saveWaitModeScore()
    ↓ unlocked = true → mở bài tiếp theo
```

### 10.2 Mô Hình Tiến Trình

- Mỗi bài học có thể chứa **nhiều snippet** yêu cầu thực hành
- Mỗi snippet hoàn thành (≥80 điểm) được thêm vào `completedSnippets[]`
- Bài học unlock khi **tất cả snippet** trong bài đều hoàn thành
- Điểm cao nhất được lưu (không ghi đè điểm thấp hơn)

---

## 11. Social — Thiết Kế Hệ Thống Cộng Đồng

### 11.1 Timeline Algorithm

```
getTimeline(limit=20, cursor?)
    ↓
1. Lấy danh sách followingIds (giới hạn 500)
2. authorIds = [currentUser, ...followingIds].slice(0, 100)
3. Query posts: WHERE authorId IN authorIds, ORDER BY $createdAt DESC
4. Cursor-based pagination cho infinite scroll
```

**Hạn chế hiện tại:** Appwrite giới hạn mảng `equal()` ở ~100 phần tử. Khi user follow >100 người, cần giải pháp thay thế (fan-out on write hoặc dedicated timeline service).

### 11.2 Reactions — Thiết Kế Đa Hình

```
reactions collection:
  targetType: "post" | "comment" | "project" | "playlist"
  targetId: <ID của target>
  userId: <ID người react>
  type: "like" (mở rộng được: "love", "fire", ...)

toggleReaction():
  → Kiểm tra đã react chưa (query unique combination)
  → Nếu đã có: xóa (unlike)
  → Nếu chưa: tạo mới (like)
```

---

## 12. Discovery & Playlists — Thiết Kế Khám Phá

### 12.1 Discovery Query Flow

```
/discover
    ↓ listPublished(tagFilters?, authorId?)
    ↓ Query: published = true, ORDER BY publishedAt DESC, LIMIT 50
    ↓ Nếu có tagFilters: thêm Query.contains("tags", [...])
    ↓ Nếu có authorId: thêm Query.equal("userId", authorId)
```

### 12.2 Playlist Publish/Unpublish Flow

```
Xuất bản:
  Permission → [Role.any() read, Role.user(owner) update/delete]

Hủy xuất bản:
  Permission → [Role.user(owner) read/update/delete]
  (Xóa Role.any() → playlist biến mất khỏi listing công khai)
```

---

## 13. Live Collaboration — Thiết Kế Cộng Tác

### 13.1 Trạng Thái Hiện Tại

- `LiveShell` component (17.5KB) đã triển khai UI cơ bản
- Route `/live/[projectId]` hoạt động
- **Chưa có real-time sync** giữa các người tham gia

### 13.2 Thiết Kế Dự Kiến

```
Phương án 1: Appwrite Realtime (WebSocket)
  → databases.subscribe() để lắng nghe thay đổi document
  → Đồng bộ playback state qua shared document

Phương án 2: WebRTC (Peer-to-Peer)
  → Kết nối trực tiếp giữa các client
  → Latency thấp hơn, phù hợp cho jam session
```

---

## 14. Đa Ngôn Ngữ — Thiết Kế Quốc Tế Hóa

### 14.1 Kiến Trúc

```
messages/
├── en.json    (English — ngôn ngữ gốc)
├── vi.json    (Tiếng Việt)
├── fr.json    (Français)
├── de.json    (Deutsch)
├── es.json    (Español)
├── ja.json    (日本語)
├── ko.json    (한국어)
├── zh-CN.json (简体中文)
└── zh-TW.json (繁體中文)

Routing: /[locale]/page → next-intl plugin tự động resolve
Middleware: src/middleware.ts → redirect / locale detection
```

### 14.2 Cấu Trúc Message Keys

```json
{
  "Nav": { "home": "...", "discover": "...", ... },
  "Home": { "heroTitle": "...", "betaBadge": "...", ... },
  "Guide": { "badge": "...", "s1Title": "...", ... },
  "Academy": { "welcomeTitle": "...", ... },
  "Dashboard": { ... },
  "Auth": { ... }
}
```

---

## 15. Hạ Tầng Triển Khai & Lưu Trữ

### 15.1 Sơ Đồ Triển Khai

```
┌─────────────────────────────────────────────────┐
│                  INTERNET                        │
└──────────┬──────────────────────┬────────────────┘
           │                      │
┌──────────▼──────────┐ ┌────────▼────────────────┐
│  Vercel Edge CDN    │ │  Appwrite Cloud/Self-host│
│                     │ │                          │
│  Next.js SSR/SSG    │ │  MariaDB (Documents)     │
│  Static Assets      │ │  Auth (Sessions, Users)  │
│  API Routes         │ │  Storage (File metadata) │
│  Server Actions     │ │  Functions (Triggers)    │
└─────────────────────┘ └─────────────────────────┘

  * Storage: Appwrite Storage (tích hợp sẵn)
    Audio files (.mp3/.wav), Cover images, MusicXML files
    Tương lai: cân nhắc chuyển sang Cloudflare R2 (zero egress)
```

### 15.2 Ước Tính Chi Phí Vận Hành

| Dịch vụ | Chi phí ước tính (tháng) |
|---|---|
| Vercel (Hobby/Pro) | $0-20 |
| Appwrite Cloud (Starter) | $0-15 |
| Appwrite Storage | Bao gồm trong gói Appwrite |
| Domain | ~$1 |
| **Tổng** | **$1-36/tháng** |

---

## 16. Thiết Kế Mở Rộng — Bách Khoa Toàn Thư

> **Trạng thái:** Đã triển khai Phase 1-3 ✅ | Content Localization: Đang thiết kế

### 16.1 Collections Hiện Tại

```
wiki_artists       → { name, bio, birthDate, nationality, roles[], slug, imageUrl, coverUrl, ... }
wiki_instruments   → { name, family, description, tuning, range, origin, imageUrl }
wiki_compositions  → { title, year, period, keySignature, tempo, difficulty, genreId, description, slug }
wiki_genres        → { name, description, parentGenreId, era, slug }
```

### 16.2 Rich Text Editor

- **TipTap** (ProseMirror-based) cho các field `bio` và `description`
- Toolbar: Headings, formatting, alignment, lists, blockquote, code, links, images, YouTube embeds
- **Wiki Link Picker** — nút 📖 trên toolbar cho phép tìm và chèn link đến các entity wiki khác
- `RichTextRenderer` — render HTML content với prose styling, intercept click để route qua Next.js i18n

### 16.3 Admin CMS (`/admin/wiki`)

- Giao diện tabbed (Artists, Instruments, Compositions, Genres)
- CRUD qua server actions (`src/app/actions/wiki.ts`)
- Phân quyền: `admin` hoặc `wiki_editor` label
- Nút "Manage Content" trên Wiki hub cho authorized users

### 16.4 Content Localization — Translation Overlay

```
wiki_translations  → Collection mới (chưa triển khai)
  ├── entityId     (string) — ID document gốc
  ├── entityType   (string) — "artist" | "instrument" | "composition" | "genre"
  ├── locale       (string) — mã ngôn ngữ (vi, ja, fr, ...)
  ├── field        (string) — tên field (bio, description, name, ...)
  ├── value        (string) — nội dung đã dịch (hỗ trợ HTML)
  └── Indexes: [entityId+locale+field] (unique), [entityId+locale]
```

**Logic hiển thị:**
1. Load document gốc (English mặc định)
2. Query `wiki_translations` theo `entityId + locale`
3. Overlay các field đã dịch lên document gốc
4. Field chưa dịch → fallback tiếng Anh

### 16.5 Routes & SEO

| Route | Mô tả | SEO |
|---|---|---|
| `/wiki` | Hub + search | — |
| `/wiki/artists/[slug]` | Chi tiết nghệ sỹ | `generateMetadata` + JSON-LD `Person` |
| `/wiki/instruments/[slug]` | Chi tiết nhạc cụ | `generateMetadata` |
| `/wiki/compositions/[slug]` | Chi tiết tác phẩm | `generateMetadata` + JSON-LD `MusicComposition` |
| `/wiki/genres/[slug]` | Thể loại | `generateMetadata` |
| `/wiki-sitemap.ts` | Dynamic sitemap | 4 entity types × 9 locales |

### 16.6 Indexing & Performance

| Chiến lược | Mô tả |
|---|---|
| Appwrite Indexes | Trên `slug`, `name`, `title` (fulltext) cho search |
| Unified Search | `WikiSearchDialog` (Header) + Wiki Link Picker (TipTap) |
| Middleware | Catch-all matcher redirect locale-less URLs |

---

## 17. Thiết Kế Mở Rộng — Phân Tích & Thích Ứng

> **Trạng thái:** Ý tưởng | **Mục tiêu:** Q4 2026 → 2027

### 17.1 Analytics Collections (Dự Kiến)

```
practice_sessions → { userId, projectId, startedAt, duration, score, noteAccuracy[] }
creator_analytics → { creatorId, courseId, enrollments, completionRate, avgScore }
```

### 17.2 Adaptive Learning (Dự Kiến)

```
Mô hình hiện tại: Strict Linear (tuần tự)
    ↓
Giai đoạn 2: Free-path (tự do chọn bài)
    ↓
Giai đoạn 3: Adaptive (hệ thống đề xuất dựa trên dữ liệu)
    → Sử dụng noteAccuracy[] để xác định điểm yếu
    → Đề xuất bài tập bổ sung tự động
```

---

## 18. Thiết Kế Mở Rộng — Thanh Toán & Kiếm Tiền

> **Trạng thái:** Ý tưởng | **Mục tiêu:** Q4 2026

### 18.1 Kiến Trúc Thanh Toán (Dự Kiến)

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Learner │────►│ Stripe API   │────►│  Platform    │
│  (Buyer) │     │ (Checkout)   │     │  Account     │
└──────────┘     └──────┬───────┘     └──────┬───────┘
                        │                    │
                        │              ┌─────▼───────┐
                        └─────────────►│  Creator    │
                          Connect      │  Payout     │
                          (70-80%)     └─────────────┘
```

### 18.2 Collections Mới (Dự Kiến)

```
subscriptions → { userId, planId, status, startDate, endDate }
transactions  → { buyerId, creatorId, courseId, amount, platformFee, stripeId }
payouts       → { creatorId, amount, status, paidAt }
```

---

## 19. Đánh Giá Rủi Ro & Hạn Chế

### 19.1 Rủi Ro Kỹ Thuật

| Rủi ro | Ảnh hưởng | Giải pháp |
|---|---|---|
| Browser không hỗ trợ WebMIDI | Mất tính năng MIDI input | Fallback sang Microphone; WebMIDI polyfill |
| Microphone permission bị từ chối | Không dùng được Wait Mode | UI rõ ràng giải thích quyền; cho phép vẫn dùng Player thường |
| Payload JSON quá lớn (multi-track) | Chậm khi load/save | Lazy loading, nén payload, tách track data |
| Appwrite query giới hạn 100 items | Timeline social bị cắt | Fan-out on write hoặc Meilisearch |

### 19.2 Hạn Chế Thiết Kế Hiện Tại

| Hạn chế | Mô tả | Kế hoạch xử lý |
|---|---|---|
| Không có offline mode | Cần internet để load/save | Service Worker cache cho assets phổ biến |
| Payload là JSON blob | Khó query nội dung bên trong | Tách metadata riêng, giữ payload cho rendering |
| Social timeline đơn giản | Chỉ hiện bài từ người follow | Thêm algorithm recommendation (trending, suggested) |
| Live chưa real-time | Chỉ có UI, chưa sync | Appwrite Realtime hoặc WebRTC |
| Chưa có search engine | Chỉ dùng Appwrite queries | Tích hợp Meilisearch |

---

*Tài liệu này được thiết kế để phục vụ mục đích review kỹ thuật toàn diện. Mọi thay đổi kiến trúc cần được cập nhật đồng bộ vào tài liệu này.*
