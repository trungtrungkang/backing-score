import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { users } from './auth';
import { projects } from './drive';

// Thống kê tổng quan User
export const userStats = sqliteTable('user_stats', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  totalXp: integer('total_xp').notNull().default(0),
  level: integer('level').notNull().default(1),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastPracticeDate: text('last_practice_date', { length: 10 }), // YYYY-MM-DD
  totalPracticeMs: integer('total_practice_ms').notNull().default(0),
  badges: text('badges', { mode: 'json' }), // Mảng danh hiệu
});

// Nhật ký thực hành âm nhạc
export const practiceSessions = sqliteTable('practice_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  durationMs: integer('duration_ms').notNull(),
  
  maxSpeed: real('max_speed'),
  waitModeScore: integer('wait_mode_score'),
  flowModeScore: integer('flow_mode_score'),
  inputType: text('input_type', { length: 10 }), // 'midi' hay 'audio'
});

// Biến môi trường Dynamic Configuration
export const platformConfig = sqliteTable('platform_config', {
  key: text('key', { length: 50 }).primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
});
