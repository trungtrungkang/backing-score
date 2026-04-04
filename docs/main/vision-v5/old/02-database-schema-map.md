# KIẾN TRÚC V5: DATABASE SCHEMA MAP (DRIZZLE ORM)

Tài liệu này ánh xạ cấu trúc Collection NoSQL của Appwrite (từ V4) trở thành sơ đồ SQL Relational Schema sử dụng **Drizzle ORM** chạy trên nền **Cloudflare D1**. Kiến trúc mới giải quyết bài toán cốt lõi là rác dữ liệu ảo (Phantom Data) thông qua các Khóa ngoại (Foreign Keys).

## 1. Bản đồ tổng quát (Overall Architecure)

Thay vì hàng tá files rời rạc trong Appwrite, chúng ta chia Schema Drizzle theo Domain Logic. Toàn bộ nằm tại thư mục `src/db/schema/`:
- `auth.ts`: Users, Sessions, Accounts (Better-Auth).
- `drive.ts`: Trái tim phần nhạc cụ (Projects, Ghi chú, Asset R2).
- `courses.ts`: Lớp học, Bài tập, Khóa học (EdTech Component).
- `social.ts`: Tương tác, Bài viết xã hội.
- `gamification.ts`: Chơi game, Thống kê cá nhân XP.

*(Xem `01-infrastructure-and-auth.md` để biết về bảng `users`)*

---

## 2. Lớp Dữ liệu Âm nhạc - `drive.ts` (Projects và Folders)

Thay thế file `setup-vision-v4-schema.mjs` cũ.

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

// Tương đương collection 'project_folders'
export const projectFolders = sqliteTable('project_folders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  parentId: text('parent_id'), // Hỗ trợ Folder lồng đệ quy (Recursive)
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Tương đương collection 'projects' - Trái tim hệ thống
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  folderId: text('folder_id').references(() => projectFolders.id, { onDelete: 'set null' }),
  
  title: text('title').notNull(),
  coverUrl: text('cover_url'),
  
  // DỮ LIỆU ĐỘC ĐÁO: Bọc lại mảng Timemap, Instrument JSON thay vì đập vỡ nó.
  // SQLite hỗ trợ parse và query sâu vào JSON.
  payload: text('payload', { mode: 'json' }).notNull(), 
  
  isPublished: integer('is_published', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});
```

---

## 3. Lớp Gom Nhóm - `collections.ts` (Playlists & Setlists)

Đây là nơi sức mạnh SQL tỏa sáng! Thay vì lưu mảng JSON thủ công `projectIds: ["abc", "123"]` như cũ ở V4, chúng ta bóc nó thành **Pivot Tables** với Khóa ngoại `CASCADE`.

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';
import { projects } from './drive';

// Tương đương collection 'playlists' / 'setlists'
export const setlists = sqliteTable('setlists', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Pivot Table giải quyết bài toán Rác Ẩn "Phantom Data"
// THAY THẾ CHO TRƯỜNG 'items' JSON THÔ TRONG APPWRITE KHI XƯA.
export const setlistItems = sqliteTable('setlist_items', {
  id: text('id').primaryKey(),
  setlistId: text('setlist_id').notNull().references(() => setlists.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  orderIndex: integer('order_index').notNull(), // Phục vụ thay đổi thứ tự bài
});

// ====> Phép Màu: Khi một `Project` bên bảng Projects bị xóa => Drizzle/SQLite tự động quét bảng `setlist_items` và Xóa Vĩnh Viễn dòng project_id tương ứng đó. Bạn không phải code Cleanup Appwrite bằng tay rườm rà nữa!
```

---

## 4. Lớp Lớp Học - `courses.ts` (Classrooms & EdTech)

Lược dịch từ `setup-classroom-collections.mjs`.

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const classrooms = sqliteTable('classrooms', {
  id: text('id').primaryKey(),
  teacherId: text('teacher_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  classCode: text('class_code', { length: 16 }).notNull().unique(), // Cho học sinh tự quét mã join
  status: text('status', { length: 20 }).default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Người dùng tham gia lớp
export const classroomMembers = sqliteTable('classroom_members', {
  id: text('id').primaryKey(),
  classroomId: text('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { length: 20 }).default('student'),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull(),
});
// (Các bảng assignments, submissions, feedback thiết kế tương tự, cắm References về classroomId)
```

---

## 5. Lớp Tương Tác Xã Hội - `social.ts` (Social Hub)

Lược dịch từ `setup-social-collections.mjs`.

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';
import { projects } from './drive';

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  authorId: text('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content'),
  // Phân nhánh Mồi Xuyên tâm (Exclusive Arcs)
  attachedProjectId: text('attached_project_id').references(() => projects.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Bảng "Likes/Hearts" (Appwrite Reactions ngày xưa)
// Đã dẹp bỏ targetType kiểu NoSQL, nay sử dụng Phương án A (Exclusive Arcs)
export const reactions = sqliteTable('reactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { length: 32 }).notNull(), // like, love...
  
  // -- CÁC CỘT PHÂN NHÁNH TRỰC TIẾP (Chỉ 1 cột được khác NULL) --
  postId: text('post_id').references(() => posts.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

---

## Tổng Kết Sự Cải Thoát

Với thiết kế này:
1. **Schema Cứng (Rigid Schema):** Ràng buộc rất mạnh tay. Bạn không thể chèn một cái `teacher_id` không tồn tại trong bảng Users vào Classrooms. Appwrite đôi khi dính lỗi này nếu API thao tác bị chững 1 giây.
2. **Loại bỏ vòng lặp for:** Khi Query Danh Sách (Ví dụ: Liệt kê số Tim thả vào 1 cái Project), bằng Drizzle bạn chỉ ghi mã SQL JOIN và gửi 1 chớp mắt Server Edge là xong, thay vì viết map filter dưới Frontend!
