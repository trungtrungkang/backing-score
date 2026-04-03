import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const projectFolders = sqliteTable('project_folders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // parentId lưu Tree structure, trỏ nội bộ thư mục lồng nhau
  parentId: text('parent_id'), 
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  projectType: text('project_type', { length: 20 }).notNull().default('backing_track'), // 'backing_track' hoặc 'sheet_music'
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Khi xoá 1 Folder, project sẽ trôi ra ngoài chứ không bị xoá theo (onDelete: set null).
  folderId: text('folder_id').references(() => projectFolders.id, { onDelete: 'set null' }),
  
  title: text('title').notNull(),
  coverUrl: text('cover_url'),
  
  // Storage JSON dành riêng cho SQLite: Bọc lại mảng Timemap, Instrument JSON
  payload: text('payload', { mode: 'json' }).notNull(), 
  
  isPublished: integer('is_published', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});
