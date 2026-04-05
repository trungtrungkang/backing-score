import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';
import { projects } from './drive';

// Tương đương collection 'playlists' / 'setlists'
export const setlists = sqliteTable('setlists', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  isPublished: integer('is_published', { mode: 'boolean' }).notNull().default(false),
  coverImageId: text('cover_image_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

/**
 * PIVOT TABLE: THAY THẾ CHO MẢNG JSON CỦA APPWRITE
 * Tuyệt tác "Khử Rác": Khi dự án âm nhạc bị xoá, toàn bộ Setlist Item liên quan tự động chìm vào dĩ vãng!
 */
export const setlistItems = sqliteTable('setlist_items', {
  id: text('id').primaryKey(),
  setlistId: text('setlist_id').notNull().references(() => setlists.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  orderIndex: integer('order_index').notNull(), 
});

import { relations } from 'drizzle-orm';

export const setlistsRelations = relations(setlists, ({ many }) => ({
  items: many(setlistItems),
}));

export const setlistItemsRelations = relations(setlistItems, ({ one }) => ({
  setlist: one(setlists, {
    fields: [setlistItems.setlistId],
    references: [setlists.id],
  }),
  project: one(projects, {
    fields: [setlistItems.projectId],
    references: [projects.id],
  }),
}));

// Overlays: Hệ sinh thái đa tầng (Bookmarks + Sequence + Tranh vẽ) cho Sheet Music
export const sheetOverlays = sqliteTable('sheet_overlays', {
  id: text('id').primaryKey(),
  sheetMusicId: text('sheet_music_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('My Notes'),
  isPublished: integer('is_published', { mode: 'boolean' }).notNull().default(false),
  bookmarks: text('bookmarks', { mode: 'json' }).notNull(), // JSON Array of Bookmarks
  sequence: text('sequence', { mode: 'json' }).notNull(), // JSON Array of UUIDs
  annotations: text('annotations', { mode: 'json' }).notNull().default('[]'), // JSON Array of Drawings
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

// Favorites: Đánh dấu yêu thích chung cho Project / Sheet Music
export const favorites = sqliteTable('favorites', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
