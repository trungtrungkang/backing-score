import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { users } from './auth';
import { projects } from './drive';
import { courses } from './courses';

// 1. Lớp học chính
export const classrooms = sqliteTable('classrooms', {
  id: text('id').primaryKey(),
  teacherId: text('teacher_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  coverImage: text('cover_image'),
  instrumentFocus: text('instrument_focus', { length: 50 }),
  level: text('level', { length: 50 }),
  courseId: text('course_id').references(() => courses.id, { onDelete: 'set null' }), // Bám sát theo 1 course nếu có
  classCode: text('class_code', { length: 16 }).notNull().unique(), // Mã join
  status: text('status', { length: 20 }).notNull().default('active'), // active, archived
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 2. Thành viên Lớp học
export const classroomMembers = sqliteTable('classroom_members', {
  id: text('id').primaryKey(),
  classroomId: text('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userName: text('user_name').notNull(), // Snapshot tên lúc join
  role: text('role', { length: 20 }).notNull().default('student'), // teacher, student
  status: text('status', { length: 20 }).notNull().default('pending'), // pending, active, removed
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull(),
});

// 3. Mã mời
export const classroomInvites = sqliteTable('classroom_invites', {
  id: text('id').primaryKey(),
  code: text('code', { length: 32 }).notNull().unique(),
  classroomId: text('classroom_id').references(() => classrooms.id, { onDelete: 'cascade' }),
  courseId: text('course_id').references(() => courses.id, { onDelete: 'cascade' }),
  teacherId: text('teacher_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  studentName: text('student_name'),
  status: text('status', { length: 20 }).notNull().default('active'), // active, used, revoked
  usedById: text('used_by_id').references(() => users.id, { onDelete: 'set null' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 4. Tài nguyên Lớp học
export const classroomMaterials = sqliteTable('classroom_materials', {
  id: text('id').primaryKey(),
  classroomId: text('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  sheetMusicId: text('sheet_music_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  sharedById: text('shared_by_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 5. Bài tập
export const assignments = sqliteTable('assignments', {
  id: text('id').primaryKey(),
  classroomId: text('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  sourceType: text('source_type', { length: 32 }).notNull(), // library, upload, discover
  sourceId: text('source_id').notNull(), // Không khóa ngoại vì có thể trỏ đi nơi khác
  sheetMusicId: text('sheet_music_id').references(() => projects.id, { onDelete: 'set null' }), // Cột trỏ tường minh vào project
  type: text('type', { length: 32 }).notNull().default('practice'), // practice, assessment, performance
  waitModeRequired: integer('wait_mode_required', { mode: 'boolean' }).notNull().default(false),
  deadline: text('deadline', { length: 32 }), // ISO String
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 6. Bài nộp của học viên
export const submissions = sqliteTable('submissions', {
  id: text('id').primaryKey(),
  assignmentId: text('assignment_id').notNull().references(() => assignments.id, { onDelete: 'cascade' }),
  classroomId: text('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  studentId: text('student_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  studentName: text('student_name'),
  recordingFileId: text('recording_file_id'), // File thu âm Appwrite Storage
  accuracy: real('accuracy'), // % chính xác
  tempo: integer('tempo'), // Tempo đã chơi
  attempts: integer('attempts').notNull().default(0), // Số lần thử
  status: text('status', { length: 32 }).notNull().default('draft'), // draft, submitted, reviewed
  submittedAt: integer('submitted_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 7. Chấm điểm giáo viên
export const submissionFeedback = sqliteTable('submission_feedback', {
  id: text('id').primaryKey(),
  submissionId: text('submission_id').notNull().references(() => submissions.id, { onDelete: 'cascade' }),
  teacherId: text('teacher_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  teacherName: text('teacher_name'),
  content: text('content').notNull(), // Nhận xét
  grade: real('grade'), // Điểm số
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 8. Phiên học trực tuyến (Live Sessions)
export const liveSessions = sqliteTable('live_sessions', {
  id: text('id').primaryKey(), // Trùng khớp với LiveKit Room Name
  classroomId: text('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  hostId: text('host_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  activeProjectId: text('active_project_id').references(() => projects.id, { onDelete: 'set null' }),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp' }), // NULL nghĩa là lớp đang diễn ra
});

// 9. Điểm danh trực tuyến (Live Attendances)
export const liveAttendances = sqliteTable('live_attendances', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => liveSessions.id, { onDelete: 'cascade' }),
  studentId: text('student_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull(),
  leftAt: integer('left_at', { mode: 'timestamp' }),
});
