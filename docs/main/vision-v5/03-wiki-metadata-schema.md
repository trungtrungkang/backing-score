# KIẾN TRÚC V5: WIKI & METADATA SCHEMA

Tài liệu này ánh xạ Hệ thống Bách khoa toàn thư Âm nhạc (Wiki Collections) từ kịch bản Appwrite sang **Drizzle ORM**.

Hệ thống Wiki trong Backing & Score bao gồm các thực thể cốt lõi tạo nên mạng lưới tri thức âm nhạc toàn cầu. Các thực thể này được liên kết chặt chẽ vào các bản nhạc (`projects`).

## 1. Drizzle Schema cho Thực thể Wiki (Entities)

Thay vì lưu thành 5 collections riêng rẽ trong NoSQL, chúng ta định nghĩa các bảng SQL có quan hệ ràng buộc bằng Khóa Học (Foreign Keys), đảm bảo toàn vẹn dữ liệu cho mọi Wiki entry.

```typescript
// src/db/schema/wiki.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// 1. Nghệ sĩ & Nhạc sĩ (Artists & Composers)
export const wikiArtists = sqliteTable('wiki_artists', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(), // URL-friendly
  name: text('name').notNull(),
  nameOriginal: text('name_original'), // Tên gốc (chữ Hán, Kanji...)
  bio: text('bio', { length: 16384 }),
  birthDate: text('birth_date', { length: 32 }),
  deathDate: text('death_date', { length: 32 }),
  nationality: text('nationality', { length: 128 }),
  roles: text('roles', { mode: 'json' }), // Ví dụ: ["composer", "performer"]
  imageUrl: text('image_url', { length: 2048 }),
  coverUrl: text('cover_url', { length: 2048 }),
});

// 2. Nhạc cụ (Instruments)
export const wikiInstruments = sqliteTable('wiki_instruments', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  family: text('family', { length: 128 }), // Nhạc cụ dây, gõ, phím...
  description: text('description', { length: 4096 }),
  imageUrl: text('image_url', { length: 2048 }),
  tuning: text('tuning', { length: 256 }),
});

// 3. Thể loại (Genres)
export const wikiGenres = sqliteTable('wiki_genres', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description', { length: 4096 }),
  /**
   * SELF-REFERENTIAL FOREIGN KEY: 
   * Thể loại con trỏ tới Thể loại cha (Ví dụ: "Romantic" là con của "Classical")
   */
  parentGenreId: text('parent_genre_id').references((): any => wikiGenres.id), 
  era: text('era', { length: 128 }),
});

// 4. Tác phẩm (Compositions)
export const wikiCompositions = sqliteTable('wiki_compositions', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  year: integer('year'),
  period: text('period', { length: 128 }), 
  genreId: text('genre_id').references(() => wikiGenres.id), 
  keySignature: text('key_signature', { length: 32 }),
  description: text('description', { length: 4096 }),
});
```

---

## 2. Hệ thống Đa Ngôn Ngữ (Translations)

Kịch bản setup Appwrite cũ dùng Collection `translations` với cấu trúc Entity-Attribute-Value (EAV). Drizzle mô phỏng lại phương pháp này vô cùng hiệu quả:

```typescript
// Bảng lưu chuỗi dịch (EAV Pattern đa ngôn ngữ)
export const wikiTranslations = sqliteTable('wiki_translations', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull(), // Trỏ trôi nổi (Polymorphic) tới Artist/Instrument/Genre
  entityType: text('entity_type', { enum: ['artist', 'instrument', 'genre', 'composition'] }).notNull(),
  locale: text('locale', { length: 10 }).notNull(), // 'vi', 'en', 'zh'
  field: text('field', { length: 64 }).notNull(), // 'bio', 'description'
  value: text('value', { length: 16384 }).notNull(),
});
```

*(Lưu ý: Dữ liệu EAV Polymorphic nên hạn chế dùng Foreign Key ở cấp DB để tránh phức tạp hóa, chúng ta sẽ quản lý bằng mã ứng dụng).*

---

## 3. Liên kết Wiki vào Projects (Khử Rác Mảng)

Trong file `setup-appwrite-wiki-links.mjs`, các biến `wikiComposerIds` và `wikiInstrumentIds` được lưu dưới dạng mảng Text vô định nội tuyến (Array String) bên trong `projects`.

Khi di dời sang V5 SQLite, chúng ta bóc tách các mảng này thành các **bảng phụ Pivot** có hiệu ứng CASCADE, đồng bộ chặt chẽ với Bảng `projects` đã tạo ở phần trước.

```typescript
import { projects } from './drive';

// 3.1 Bảng Trung Gian Projects <-> Tác Phẩm & Thể Loại
// Do quan hệ là 1-n (1 Project chỉ thuộc 1 Composition/Genre), ta chèn cột ForeignKey thẳng vào projects:
/*
  ALTER TABLE projects ADD COLUMN wiki_genre_id text REFERENCES wiki_genres(id);
  ALTER TABLE projects ADD COLUMN wiki_composition_id text REFERENCES wiki_compositions(id);
*/

// 3.2 Bảng Pivot: Projects <-> Nhiều Nhạc Sĩ/Nghệ Sĩ
export const projectWikiComposers = sqliteTable('project_wiki_composers', {
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  artistId: text('artist_id').notNull().references(() => wikiArtists.id, { onDelete: 'cascade' }),
});

// 3.3 Bảng Pivot: Projects <-> Nhiều Nhạc Cụ
export const projectWikiInstruments = sqliteTable('project_wiki_instruments', {
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  instrumentId: text('instrument_id').notNull().references(() => wikiInstruments.id, { onDelete: 'cascade' }),
});
```

*Sức mạnh của Drizzle*: Khi xóa một Nhạc Cụ khỏi Thư viện Wiki, tự động toàn bộ Label Nhạc cụ đó ở các bản nhạc đính kèm sẽ bốc hơi sạch sẽ nhờ tính năng `onDelete: 'cascade'`. Không để lại rác `["id_123_da_xoa"]` trong mốc tìm kiếm của User!
