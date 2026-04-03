import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';
import { projects } from './drive';

// 1. Giáo trình (Courses)
export const courses = sqliteTable('courses', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  coverUrl: text('cover_url'),
  difficulty: text('difficulty', { length: 20 }), // beginner, intermediate, advanced
  priceCents: integer('price_cents').notNull().default(0), // 0 means free
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 2. Bài giảng (Lessons)
export const lessons = sqliteTable('lessons', {
  id: text('id').primaryKey(),
  courseId: text('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  orderIndex: integer('order_index').notNull().default(0),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }), // Bài giảng có thể tham chiếu tới 1 project
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 3. Ghi danh (Enrollments)
export const enrollments = sqliteTable('enrollments', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: text('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  enrolledAt: integer('enrolled_at', { mode: 'timestamp' }).notNull(),
});

// 4. Tiến trình (Progress)
export const progress = sqliteTable('progress', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lessonId: text('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  status: text('status', { length: 20 }).notNull(), // completed, in_progress
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
