import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { projects } from './drive';

// 1. Nghệ sĩ & Nhạc sĩ
export const wikiArtists = sqliteTable('wiki_artists', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(), // URL-friendly
  name: text('name').notNull(),
  nameOriginal: text('name_original'), 
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
  family: text('family', { length: 128 }), // Dây, gõ, phím...
  description: text('description', { length: 4096 }),
  imageUrl: text('image_url', { length: 2048 }),
  tuning: text('tuning', { length: 256 }),
});

// 3. Thể loại (Genres)
// AnyRef fix cho Self-Referential (Thể loại con trỏ Thể loại cha)
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

export const wikiGenres = sqliteTable('wiki_genres', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description', { length: 4096 }),
  // Đệ quy
  parentGenreId: text('parent_genre_id').references((): AnySQLiteColumn => wikiGenres.id), 
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

// 5. Đa ngôn ngữ EAV Pattern
export const wikiTranslations = sqliteTable('wiki_translations', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull(),
  entityType: text('entity_type', { enum: ['artist', 'instrument', 'genre', 'composition'] }).notNull(),
  locale: text('locale', { length: 10 }).notNull(), // 'vi', 'en', 'zh'
  field: text('field', { length: 64 }).notNull(), // 'bio', 'description'
  value: text('value', { length: 16384 }).notNull(),
});

// ============================================
// BẢNG PIVOT: Liên Kết Bản Nhạc (Projects) với Kiến thức (Wiki)
// ============================================

export const projectWikiComposers = sqliteTable('project_wiki_composers', {
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  artistId: text('artist_id').notNull().references(() => wikiArtists.id, { onDelete: 'cascade' }),
});

export const projectWikiInstruments = sqliteTable('project_wiki_instruments', {
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  instrumentId: text('instrument_id').notNull().references(() => wikiInstruments.id, { onDelete: 'cascade' }),
});

export const projectWikiGenres = sqliteTable('project_wiki_genres', {
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  genreId: text('genre_id').notNull().references(() => wikiGenres.id, { onDelete: 'cascade' }),
});

