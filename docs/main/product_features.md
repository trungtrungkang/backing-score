# Backing & Score — Product Feature Specification

**Version:** 4.0 (Public Beta)  
**Last Updated:** 2026-03-27  
**Platform:** Web (Next.js) & Mobile-responsive  
**Backend:** Appwrite (Database, Auth, Storage)

---

## Platform Vision — Four Pillars

Backing & Score is built on four core pillars:

| Pillar | Features | Description |
|---|---|---|
| 🎯 **Practice** | Play Mode · Wait Mode · Mixer | Play along with backing tracks, get real-time pitch feedback |
| 🎓 **Learn** | Academy · Courses · Classroom *(coming soon)* | Structured courses combining theory with hands-on practice |
| 🔍 **Discover** | Discover · Wiki · Collections | Curated music library and music encyclopedia |
| 🤝 **Connect** | Feed · Follow · Notifications | Share and connect with a community of music lovers |

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Audio Engine & Signal Processing](#2-audio-engine--signal-processing)
3. [Content Authoring System (Editor)](#3-content-authoring-system-editor)
4. [Interactive Player](#4-interactive-player)
5. [Wait Mode — Practice Assessment Engine](#5-wait-mode--practice-assessment-engine)
6. [Discovery & Content Library](#6-discovery--content-library)
7. [Academy (EdTech Module)](#7-academy-edtech-module)
8. [Social & Community Features](#8-social--community-features)
9. [User Dashboard & Project Management](#9-user-dashboard--project-management)
10. [Live Collaboration Session](#10-live-collaboration-session)
11. [Embeddable Player](#11-embeddable-player)
12. [Internationalization (i18n)](#12-internationalization-i18n)
13. [Authentication & User Profiles](#13-authentication--user-profiles)
14. [Music Encyclopedia](#14-music-encyclopedia)
15. [Monetization & Subscription](#15-monetization--subscription)
16. [Notifications](#16-notifications)
17. [Planned Features — Advanced Analytics](#17-planned-features--advanced-analytics)
18. [Planned Features — Adaptive Learning](#18-planned-features--adaptive-learning)

---

## 1. Architecture Overview

Backing & Score is a multi-layered interactive music platform built on a client-heavy architecture. The system delegates computationally intensive audio processing to the client device (browser) while maintaining lightweight server-side operations for data persistence and authentication.

**Technology Stack:**

| Layer | Technology |
|---|---|
| Frontend Framework | Next.js (App Router, Server Components) |
| Styling | Tailwind CSS + shadcn/ui |
| Backend / BaaS | Appwrite (Database, Auth, Storage, Functions) |
| Media Storage | Appwrite Storage (future: Cloudflare R2) |
| Audio Processing | Web Audio API + WebMIDI API (client-side) |
| Rich Text | Tiptap (ProseMirror-based) with custom extensions |
| Music Notation | MusicXML parsing + custom SVG renderer |
| Deployment | Vercel (Frontend) + Appwrite Cloud/Self-hosted |

**Data Collections (Appwrite):**

| Collection | Purpose |
|---|---|
| `projects` | Music scores, arrangements, and practice sheets |
| `playlists` | User-curated collections of projects |
| `favorites` | Bookmarked projects and playlists |
| `courses` | Academy course metadata |
| `lessons` | Individual lessons within courses |
| `posts` | Community Feed posts |
| `comments` | Post comments |
| `reactions` | Likes/emoji reactions on posts, comments, projects |
| `follows` | User follow relationships |
| `wiki_artists` | Musician/composer encyclopedia entries |
| `wiki_instruments` | Musical instrument encyclopedia entries |
| `wiki_compositions` | Musical composition encyclopedia entries |
| `wiki_genres` | Music genre encyclopedia entries |
| `wiki_translations` | Per-field translations for wiki content |

---

## 2. Audio Engine & Signal Processing

The core differentiator of the platform. All audio analysis runs entirely on the client device with zero server round-trips.

### 2.1 Microphone Input (`useMicInput`)
- Real-time audio capture via `navigator.mediaDevices.getUserMedia()`
- FFT-based pitch detection using Web Audio API `AnalyserNode`
- Autocorrelation algorithm for fundamental frequency extraction
- Configurable sample rate and FFT window size
- Noise gate threshold to filter ambient noise

### 2.2 MIDI Input (`useMidiInput`)
- WebMIDI API integration for hardware MIDI keyboards/controllers
- Note-On / Note-Off event parsing
- Velocity sensitivity support
- Multi-channel MIDI routing

### 2.3 Score Engine (`useScoreEngine`)
- Central orchestration hook that coordinates:
  - Playback of backing tracks (multi-track audio)
  - Real-time comparison of detected pitch vs. expected note
  - Score progression logic (advance cursor on correct note)
  - Wait Mode pause/resume mechanics
  - Timing accuracy calculation
  - Performance scoring and feedback generation

---

## 3. Content Authoring System (Editor)

A browser-based DAW-lite (Digital Audio Workstation) enabling creators to build interactive music content without programming knowledge.

### 3.1 Editor Shell (`EditorShell`)
- Full-featured project workspace with timeline, track list, and transport controls
- Three project modes:
  - **Practice** — single-instrument practice sheet with backing track
  - **Arrange** — multi-track arrangement workspace
  - **Chart** — chord chart / lead sheet mode

### 3.2 Rich Text Editor (`TiptapEditor`)
- ProseMirror-based rich text editing (Tiptap framework)
- Custom extensions for embedding interactive music snippets
- Content blocks: text, headings, images, music notation, video embeds
- Export-ready for Academy lesson content

### 3.3 MusicXML Visualizer (`MusicXMLVisualizer`)
- Parses and renders MusicXML files as interactive sheet music (SVG)
- Note-level highlighting synchronized with playback cursor
- Multi-voice rendering support
- Responsive scaling for different screen sizes

### 3.4 Multi-Track System (`TrackList`)
- Add/remove instrument tracks
- Per-track controls: volume, pan, mute, solo
- Track-level waveform visualization
- Audio file upload per track (via Appwrite Storage)

### 3.5 Transport Bar (`TransportBar`)
- Play / Pause / Stop / Loop controls
- Tempo adjustment (BPM)
- Metronome toggle
- Playback position scrubbing
- Wait Mode toggle

### 3.6 Additional Editor Components

| Component | Function |
|---|---|
| `PianoRollRegion` | MIDI-style piano roll note view |
| `TimelineRuler` | Measure/beat timeline with zoom |
| `Waveform` | Audio waveform display per track |
| `MeasureMapEditor` | Time signature and measure structure editing |
| `GamificationProvider` | Context provider for streak/score/achievement data |
| `ProjectSelectorModal` | Modal for inserting existing projects as snippets |

---

## 4. Interactive Player

The consumer-facing playback experience for practicing with published content.

### 4.1 Snippet Player (`SnippetPlayer`)
- Embedded, self-contained player for individual music snippets
- Used within Academy lessons and the Discover page
- Controls: play, pause, tempo adjust, track mixer
- Visual feedback: note highlighting, progress indicator

### 4.2 Full Player (`PlayShell` + `PlayerControls`)
- Dedicated full-screen practice environment (`/play/[projectId]`)
- Multi-track mixer console
- Microphone / MIDI input activation
- Wait Mode toggle with visual indicators
- Performance statistics panel

---

## 5. Wait Mode — Practice Assessment Engine

The signature feature that distinguishes Backing & Score from passive media platforms.

### 5.1 Mechanism
1. User activates Wait Mode on any music score
2. All backing tracks (accompaniment) are muted
3. The score cursor advances note-by-note
4. At each note position, the system **pauses** and **waits** for the user to produce the correct pitch via Microphone or MIDI input
5. Pitch Detection Engine validates the input in real-time:
   - Correct pitch (within configurable tolerance) → cursor advances
   - Incorrect pitch or silence → cursor holds position
6. Upon completion of a passage, summary statistics are generated

### 5.2 Technical Parameters
- Pitch tolerance: configurable (default ±50 cents)
- Latency target: < 20ms audio-to-detection
- Input sources: Microphone (analog instruments, voice) or MIDI (digital keyboards)
- Processing: entirely client-side (Web Audio API)

### 5.3 Pedagogical Foundation
Wait Mode implements the **Deliberate Practice** model:
- Immediate corrective feedback
- Forced accuracy before progression
- Muscle memory reinforcement through repetition
- No passive "auto-advance" — active engagement required

---

## 6. Discovery & Content Library

### 6.1 Discover Page (`/discover`)

The Discover page features a **curated, sectioned layout** (similar to Spotify/Netflix) with horizontal scroll sections:

| Section | Icon | Data Source | Sort |
|---|---|---|---|
| **Featured** | ⭐ | Admin-curated (`featured=true`) | `featuredAt` DESC |
| **Recently Added** | 🆕 | All published projects | `publishedAt` DESC |
| **Trending** | 🔥 | High play-count projects | `playCount` DESC |
| **Popular Favorites** | 🔖 | Most favorited projects | `favoriteCount` DESC |
| **Collections** | 📚 | Published playlists | Latest |
| **All Scores** | 📖 | Full filterable grid | Multiple sort options |

**Hybrid Dedup Strategy:** Featured items are exclusive to the Featured section and filtered out of other sections. Other sections may share content.

**Search behavior:** When a search query is active, curated sections are hidden and only the filterable "All Scores" grid is shown.

**Reusable components:** `HorizontalScroll` — touch-friendly, snap-scrolling container with auto-hiding navigation arrows and edge-fade gradients.

### 6.2 Collections / Playlists (`/collection/[playlistId]`)
- User-curated collections of projects
- Public or private visibility
- Ordered project list with cover image

### 6.3 Project Detail (`/p/[projectId]`)
- Full project metadata display
- Embedded player preview
- Author profile link
- Favorite / Add to Playlist actions
- Share / Embed controls
- "Copy to My Projects" for remixing (creates private copy)

---

## 7. Academy (EdTech Module)

### 7.1 Course Catalog (`/academy`)
- Course listing with category filters
- Course cards: title, creator, level, price/free indicator
- Enrollment button

### 7.2 Course Detail & Lesson View (`/c/[courseId]`)
- Sidebar with lesson navigation (sequential structure)
- Lesson content rendered via `TiptapViewer`
- Embedded `SnippetPlayer` components within lesson text
- Practice-required gates: some lessons require Wait Mode completion to unlock the next
- Progress tracking per user

### 7.3 Course Creation (Dashboard)
- Creators build courses through Dashboard (`/dashboard/courses`)
- Lesson editor: rich text + music snippet insertion
- Course metadata: title, description, level, pricing
- Publish/unpublish toggle

---

## 8. Social & Community Features

### 8.1 Feed (`/feed`)
- Chronological timeline of posts from followed users
- Post types: text, project attachment, playlist attachment
- Reactions (like, emoji)
- Comment threads

### 8.2 User Profiles (`/u/[userId]`)
- Public profile page
- Published projects, playlists, and courses
- Follow / Unfollow
- Follower and following counts

### 8.3 Data Model
- **Posts:** content (text), optional attachment (project or playlist reference)
- **Comments:** authored text linked to a post
- **Reactions:** polymorphic (can target posts, comments, projects, playlists)
- **Follows:** directional follower→following relationship

---

## 9. User Dashboard & Project Management

### 9.1 Dashboard Home (`/dashboard`)
- Overview of user's projects (drafts and published)
- Quick-action buttons: create new project, open editor

### 9.2 Project Management
- Modal project creation: name, mode (practice/arrange/chart), tags
- Edit, duplicate, delete workflows
- Publish flow: set cover image, description, tags → make publicly discoverable
- Tag-based filtering

### 9.3 Dashboard Sub-sections

| Route | Content |
|---|---|
| `/dashboard/collections` | Manage playlists/collections |
| `/dashboard/courses` | Manage created courses |
| `/dashboard/favorites` | View bookmarked content |

---

## 10. Live Collaboration Session

### 10.1 Live Shell (`/live/[projectId]`)
- Real-time collaborative editing/viewing of a project
- Shared playback state synchronized across participants
- Use case: remote music lessons, ensemble practice
- Status: **Early implementation** — core UI built, real-time sync in development

---

## 11. Embeddable Player

### 11.1 Embed Page (`/embed`)
- Lightweight, iframe-compatible player view
- Intended for embedding interactive music snippets on external websites
- Minimal UI (play controls + sheet music only)
- Share URL generation from project detail page

---

## 12. Internationalization (i18n)

### 12.1 Supported Languages (9)
| Code | Language |
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

### 12.2 Implementation
- `next-intl` library for message-based translation
- Locale-prefixed routing (`/[locale]/...`)
- Language switcher component in global header
- All UI labels, page copy, and guide content translated

---

## 13. Authentication & User Profiles

### 13.1 Auth Flow
- Email + password registration (`/signup`)
- Email verification (`/verify`)
- Login with session management (`/login`)
- Powered by Appwrite Auth (session cookies)

### 13.2 Admin Panel (`/admin`)
- Administrative dashboard for platform management
- Content moderation tools
- **Featured Content Manager** (`/admin/featured`) — toggle `featured` flag on published projects with search and optimistic UI
- **AI Enrichment** (`/admin/review`) — auto-analyze projects with Gemini API for metadata
- **Batch MusicXML Import** (`/admin/import`) — import multiple scores from MusicXML files
- **Wiki CMS** (`/admin/wiki`) — manage encyclopedia content

---

## 14. Music Encyclopedia ✅

> **Status:** Implemented (Phase 2.5, 3, 6, 8) | Content Localization: In Design

### 14.1 Data Entities (Appwrite Collections)

| Entity | Key Fields |
|---|---|
| `wiki_artists` | name, bio (rich text), birthDate, nationality, roles[], imageUrl, coverUrl, slug |
| `wiki_instruments` | name, family, description (rich text), tuning, range, origin, imageUrl |
| `wiki_compositions` | title, year, period, keySignature, tempo, difficulty, genreId, description (rich text), slug |
| `wiki_genres` | name, description (rich text), parentGenreId, era, slug |

### 14.2 Project ↔ Wiki Entity Links

Projects have direct wiki entity relationships stored as document fields:

| Field | Type | Description |
|---|---|---|
| `wikiGenreId` | string | Single genre ID |
| `wikiInstrumentIds` | string[] | Multiple instrument IDs |
| `wikiCompositionId` | string | Single composition ID |
| `wikiComposerIds` | string[] | Multiple composer/artist IDs |

These fields replace the legacy free-text tag system for genre/instrument classification, while `tags[]` still handles difficulty levels.

### 14.3 Tags Picker (Editor)

The project editor (`EditorShell`) features a tabbed tag picker with 5 categories:

| Tab | Emoji | Selection | Search |
|---|---|---|---|
| Instruments | 🎹 | Multi-select | ✅ |
| Genre | 🎵 | Single-select | — |
| Composition | 📄 | Single-select | ✅ |
| Composer | 👤 | Multi-select | ✅ |
| Difficulty | 📊 | Single-select | — |

Each tab shows a count badge and uses a distinct accent color (amber, emerald, sky, violet, blue).

### 14.4 User-facing Pages

**Wiki Hub** (`/wiki`):
- Category cards linking to listing pages
- Global search across artists and compositions
- "Manage Content" link for wiki editors

**Detail Pages** (premium layouts with hero sections and sidebars):
- `/wiki/artists/[slug]` — Violet theme, Quick Facts sidebar, PracticeCard
- `/wiki/instruments/[slug]` — Amber theme, Specifications sidebar
- `/wiki/compositions/[slug]` — Sky theme, Metadata sidebar, PracticeCard
- `/wiki/genres/[slug]` — Emerald theme, Sub-genres sidebar

**Listing Pages** (search + filters + grid):
- `/wiki/artists` — Filter by nationality, role
- `/wiki/instruments` — Filter by family (chip pills)
- `/wiki/compositions` — Filter by genre, period, difficulty
- `/wiki/genres` — Tree view (parent → children) + era chips

### 14.5 Practice Integration

`PracticeCard` component connects wiki content with playable projects:
- Displays published practice tracks linked to a composition or artist
- Featured CTA with gradient card for the primary project
- Compact list for additional tracks
- Configurable accent colors (sky, violet, amber, emerald, gold)
- Links directly to `/play/[projectId]`

API helpers:
- `listProjectsByComposition(compositionId, limit)` — query published projects by composition
- `listProjectsByArtist(artistId, limit)` — query published projects by composer

> **Note:** Only published projects appear in PracticeCard. Draft projects are hidden.

### 14.6 Rich Text Editor (TipTap)
- Full WYSIWYG editor for bio/description fields in Admin CMS
- Toolbar: headings, formatting, alignment, lists, blockquote, code blocks, links, images, YouTube embeds
- **Wiki Link Picker** (📖 button) — inline search to link to other wiki entities
- `RichTextRenderer` — locale-aware HTML renderer with internal link interception

### 14.7 Admin CMS (`/admin/wiki`)
- Tabbed interface for all 4 entity types
- Inline create/edit forms with auto-slug generation
- CRUD via server actions with `requireWikiEditor()` auth guard
- Accessible by `admin` and `wiki_editor` roles

### 14.8 SEO
- `generateMetadata` on all detail pages
- JSON-LD structured data (`Person`, `MusicComposition`)
- Dynamic sitemap (`wiki-sitemap.ts`) across all locales
- Unified Search Dialog in Header navigation

### 14.9 Content Localization (Planned)

**Architecture: Translation Overlay**

| Component | Description |
|---|---|
| `wiki_translations` collection | Stores per-field translations: `entityId`, `entityType`, `locale`, `field`, `value` |
| Default language | English (stored directly on entity documents) |
| Fallback | If no translation exists for a locale, English content is displayed |
| CMS integration | Locale selector tab in Admin CMS for creating/editing translations |
| Future | AI-assisted translation with human review |

### 14.10 User Roles

| Role | Capabilities |
|---|---|
| `admin` | Full CMS access, assign wiki_editor role |
| `wiki_editor` | Create, edit, delete wiki content; access via "Manage Content" on Wiki hub |

---

## 15. Monetization & Subscription ✅

> **Status:** Implemented | **Payment Provider:** LemonSqueezy

### 15.1 Revenue Model (Current)
- **Free Tier:** Unlimited browsing and playback, Wait Mode 3 sessions/day, social features
- **Premium Subscription:** Unlimited Wait Mode, PDF/MusicXML exports, full Academy access, ad-free experience
- Monthly ($4.99) and Yearly ($39.99, save 33%) pricing

### 15.2 Technical Implementation

| Component | Description |
|---|---|
| Checkout API | `/api/checkout` — creates LemonSqueezy checkout session |
| Webhook | `/api/webhooks/lemonsqueezy` — handles subscription events |
| Subscription Sync | `/api/subscription/sync` — syncs status with Appwrite |
| Gating | `UpgradePrompt` component — triggered on play limit or Wait Mode toggle for free users |
| Dashboard | `SubscriptionCard` — shows plan status, manage billing link |
| Pricing Page | `/pricing` — Free vs Premium comparison with toggle (monthly/yearly) |

### 15.3 Subscription Data (Appwrite)

| Field | Type | Description |
|---|---|---|
| `userId` | string | Appwrite user ID |
| `lemonSqueezyCustomerId` | string | LS customer ID |
| `lemonSqueezySubscriptionId` | string | LS subscription ID |
| `status` | string | `active`, `cancelled`, `expired` |
| `planType` | string | `monthly`, `yearly` |
| `currentPeriodEnd` | datetime | End of current billing period |

---

## 16. Notifications ✅

> **Status:** Implemented

### 16.1 In-App Notification Bell
- Real-time notification bell in the global header
- Notification types: like, follow, comment, report_resolved
- Mark all read functionality
- "Just now" relative timestamps
- Clicking a notification navigates to the relevant content

### 16.2 Data Model

| Field | Type | Description |
|---|---|---|
| `userId` | string | Recipient user ID |
| `type` | enum | `like`, `follow`, `comment`, `report_resolved` |
| `actorId` | string | User who triggered the notification |
| `targetId` | string | ID of the target content |
| `targetName` | string | Display name of the target |
| `read` | boolean | Read status |

---

## 17. Planned Features — Advanced Analytics

> **Status:** Concept | **Target:** Q4 2026

### 17.1 Creator Analytics Dashboard
- Per-course: enrollment count, lesson completion rates, drop-off points
- Per-project: play count, average practice duration, favorite rate
- User engagement: time-spent heatmaps

### 17.2 Learner Progress Analytics
- Personal practice history
- Note-by-note accuracy reports from Wait Mode sessions
- Skill progression over time (chart visualization)
- Weakness identification (specific measures/notes with high error rates)

---

## 18. Planned Features — Adaptive Learning

> **Status:** Concept | **Target:** 2027

### 18.1 Models Under Evaluation
- **Strict Linear Progression** — current model (sequential lesson unlocking)
- **Free-path** — learner chooses any lesson in any order
- **Adaptive** — system recommends next lesson based on performance data

### 18.2 Gamification Extensions
- Practice streaks (daily login + practice rewards)
- Leaderboards (opt-in, per-course or per-instrument)
- Achievement badges (first song completed, 7-day streak, etc.)
- `GamificationProvider` context already scaffolded in codebase

---

## Appendix A: Project Modes

| Mode | Description | Primary Use Case |
|---|---|---|
| `practice` | Single-instrument sheet + backing tracks | Play-along practice |
| `arrange` | Multi-track arrangement workspace | Full song arrangement |
| `chart` | Chord chart / lead sheet format | Rehearsal reference |

## Appendix B: User Roles

| Role | Capabilities |
|---|---|
| Visitor (unauthenticated) | Browse Discover, view public profiles, view Home/Guide |
| Registered User | Play projects, enroll in courses, create projects, manage favorites/playlists, social features |
| Creator | All user features + publish projects, create/sell courses |
| Wiki Editor | Create, edit, delete wiki content via Admin CMS |
| Admin | Full platform management, content moderation, featured content curation, assign roles |

## Appendix C: Project Schema Fields (v4.0 additions)

| Field | Type | Default | Description |
|---|---|---|---|
| `featured` | boolean | `false` | Admin-curated featured flag |
| `featuredAt` | datetime | — | Timestamp when featured |
| `favoriteCount` | integer | `0` | Synced count of favorites |
| `playCount` | integer | `0` | Incremented on each play |
