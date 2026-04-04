import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';
import { projects } from './drive';
import { setlists } from './collections';
import { courses } from './courses';
import { classrooms } from './classroom';
import { wikiArtists } from './wiki';
// (Ta không import toàn bộ Wiki để tránh Vòng lặp. Nghệ sĩ (wikiArtists) là ví dụ Đại diện)

// 1. Phân nhánh Xuyên tâm (Exclusive Arcs) cho Tính năng Yêu Thích
export const favorites = sqliteTable('favorites', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // -- CÁC CỘT PHÂN NHÁNH TRỰC TIẾP (Chỉ 1 cột được khác NULL) --
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  setlistId: text('setlist_id').references(() => setlists.id, { onDelete: 'cascade' }),
  courseId: text('course_id').references(() => courses.id, { onDelete: 'cascade' }),
  wikiArtistId: text('wiki_artist_id').references(() => wikiArtists.id, { onDelete: 'cascade' }),
  
  // -- Lưu lại vết tích kiểu vũ trụ cũ để dễ query frontend --
  targetTypeBackup: text('target_type_backup'), 
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 2. Bài viết (Posts)
export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  authorId: text('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content'),
  
  // -- Phân nhánh file đính kèm --
  attachedProjectId: text('attached_project_id').references(() => projects.id, { onDelete: 'cascade' }),
  attachedSetlistId: text('attached_setlist_id').references(() => setlists.id, { onDelete: 'cascade' }),
  
  visibility: text('visibility', { length: 32 }).notNull().default('public'), // public, followers, classroom
  classroomId: text('classroom_id').references(() => classrooms.id, { onDelete: 'cascade' }), // Nếu post thuộc group lớp
  isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
  
  // -- Biến đếm (Denormalized) --
  reactionLike: integer('reaction_like').notNull().default(0),
  reactionLove: integer('reaction_love').notNull().default(0),
  reactionHaha: integer('reaction_haha').notNull().default(0),
  reactionWow: integer('reaction_wow').notNull().default(0),
  reactionTotal: integer('reaction_total').notNull().default(0),
  commentsCount: integer('comments_count').notNull().default(0),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 3. Bình luận
export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 4. Reactions (Cảm xúc - Tương tự Favorite)
export const reactions = sqliteTable('reactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { length: 32 }).notNull(), // like, love, haha, wow
  
  // -- Phân nhánh Xuyên tâm (Exclusive Arcs) --
  postId: text('post_id').references(() => posts.id, { onDelete: 'cascade' }),
  commentId: text('comment_id').references(() => comments.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  setlistId: text('setlist_id').references(() => setlists.id, { onDelete: 'cascade' }),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 5. Followers (Theo dõi)
export const follows = sqliteTable('follows', {
  id: text('id').primaryKey(),
  followerId: text('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  followingId: text('following_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 6. Thông báo
export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), // Người nhận
  actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }), // Ai tạo ra thông báo?
  
  sourceUserId: text('source_user_id'),
  sourceUserName: text('source_user_name'),
  targetType: text('target_type'),
  targetName: text('target_name'),
  targetId: text('target_id'),

  type: text('type', { length: 32 }).notNull(), // like, comment, follow...
  message: text('message'),
  read: integer('read', { mode: 'boolean' }).notNull().default(false),
  
  // Trỏ tới Entity tạo ra Notification (Phân nhánh)
  postId: text('post_id').references(() => posts.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 7. Báo cáo Tố cáo (Reports)
export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(),
  reporterId: text('reporter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  status: text('status', { length: 32 }).notNull().default('pending'), // pending, resolved, rejected
  
  // Phân nhánh Mồi
  postId: text('post_id').references(() => posts.id, { onDelete: 'cascade' }),
  commentId: text('comment_id').references(() => comments.id, { onDelete: 'cascade' }),
  userIdReported: text('user_id_reported').references(() => users.id, { onDelete: 'cascade' }), // Tố cáo gian lận user
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
