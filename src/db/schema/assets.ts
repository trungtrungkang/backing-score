import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

// Quản lý các file vật lý đã upload lên R2 (thay thế Storage Management của Appwrite)
export const driveAssets = sqliteTable('drive_assets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  originalName: text('original_name').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  contentType: text('content_type').notNull(),
  r2Key: text('r2_key').notNull(),
  usedCount: integer('used_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
