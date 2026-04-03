# KIẾN TRÚC V5: GAMIFICATION & MONETIZATION SCHEMA

Tài liệu này hoàn thiện bức tranh ánh xạ cơ sở dữ liệu từ Appwrite sang **Drizzle ORM (SQL)** cho hai mảnh ghép cuối cùng và rất quan trọng của ứng dụng: **Hệ thống Gamification (Trò chơi hóa)** và **Monetization (Kiếm tiền/Thanh toán)**.

Các tập lệnh gốc được tham chiếu: `setup-gamification-collections.mjs`, `setup-monetization-collections.mjs` và hệ thống Subscription.

---

## 1. Gamification (Trò chơi hóa & Thống kê)

Gamification giúp giữ chân người dùng (Retention) và tạo động lực học tập. Trong V5 SQL, chúng ta liên kết chặt chẽ tiến trình này với bảng `users` và `projects`.

```typescript
// src/db/schema/gamification.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { users } from './auth';
import { projects } from './drive';

// Thống kê tổng quan của User (Tương đương 'user_stats')
// Ở SQL, ta có thể dùng trigger để tự động update bảng này!
export const userStats = sqliteTable('user_stats', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  totalXp: integer('total_xp').notNull().default(0),
  level: integer('level').notNull().default(1),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastPracticeDate: text('last_practice_date', { length: 10 }), // YYYY-MM-DD
  totalPracticeMs: integer('total_practice_ms').notNull().default(0),
  badges: text('badges', { mode: 'json' }), // Mảng các text huy hiệu đạt được
});

// Lịch sử luyện tập (Tương đương 'practice_sessions')
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
  inputType: text('input_type', { length: 10 }), // 'midi', 'audio'
});

// Cấu hình nền tảng (Tương đương 'platform_config')
// Dành cho việc lưu các quy tắc game (XP per minute, streak multiplier...) mà Admin có thể đổi không cần sửa code.
export const platformConfig = sqliteTable('platform_config', {
  key: text('key', { length: 50 }).primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
});
```

---

## 2. Monetization & Subscriptions (Thanh toán & Gói cước)

Mô hình V4 tích hợp chặt chẽ với LemonSqueezy thông qua Appwrite. Ở V5, Dizzle sẽ đảm nhận việc lưu trữ các chứng từ Mua bán lẻ (Purchases) và Cấp quyền truy cập (Entitlements). 

Đặc biệt lưu ý: Dữ liệu này **cực kỳ nhạy cảm**, việc chuyển sang SQL giúp tránh tình trạng thất thoát dữ liệu do thiết lập phân quyền (Permissions) sai lệch trên cổng NoSQL.

```typescript
// src/db/schema/monetization.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

// 1. Danh mục Sản phẩm (Products)
// Gồm thông tin map với ID sản phẩm trên LemonSqueezy
export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  creatorId: text('creator_id').notNull().references(() => users.id),
  targetType: text('target_type', { length: 32 }).notNull(), // 'course', 'pdf', 'booking'
  targetId: text('target_id').notNull(), // ID của khóa học hoặc PDF tương ứng
  priceCents: integer('price_cents').notNull(), // Lưu bằng đơn vị Cents
  lemonSqueezyVariantId: text('lemon_squeezy_variant_id', { length: 64 }).notNull(),
  status: text('status', { enum: ['draft', 'active', 'archived'] }).notNull().default('draft'),
});

// 2. Lịch sử Mua hàng (Purchases)
export const purchases = sqliteTable('purchases', {
  orderId: text('order_id').primaryKey(), // ID trả về từ LemonSqueezy Webhook
  userId: text('user_id').notNull().references(() => users.id),
  productId: text('product_id').notNull().references(() => products.id), // Lưu vết sản phẩm mua
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency', { length: 16 }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 3. Cấp quyền Truy cập (Entitlements)
// Khi User mua thành công 1 Course, Webhook sẽ chèn 1 dòng vào đây.
// Hàm Guard sẽ check bảng này để xem user có quyền mở Course ra hay không.
export const entitlements = sqliteTable('entitlements', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetType: text('target_type', { length: 32 }).notNull(), // Mở khóa 'course' hay 'pdf'
  targetId: text('target_id').notNull(),
  sourceProductId: text('source_product_id').notNull().references(() => products.id),
  grantedAt: integer('granted_at', { mode: 'timestamp' }).notNull(),
});

// 4. Subscriptions (Gói cước tháng/năm)
// Bảng này phục vụ cho Tier 'free' / 'pro' / 'studio'
export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(), // Subscription ID từ LemonSqueezy
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status', { length: 32 }).notNull(), // 'active', 'past_due', 'canceled'
  planId: text('plan_id').notNull(), // Xác định pro hay studio tier
  currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }).notNull(),
  cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).notNull().default(false),
});
```

---

## 3. Tổng kết Bản thiết kế D1 V5

Đến thời điểm này, toàn bộ 4 mảng trọng yếu nhất của hệ thống Backing & Score đều đã được định nghĩa trên nền tảng Database Architecture SQL V5:

1. **`01-infrastructure-and-auth.md`:** Xương sống hệ thống và Better-Auth `users`.
2. **`02-database-schema-map.md`:** Khối Âm nhạc (`projects`, `playlists`), EdTech (`classrooms`) và Social.
3. **`03-wiki-metadata-schema.md`:** Mạng lưới Bách khoa Âm nhạc (Polymorphic EAV & Pivot tables).
4. **`04-gamification-and-monetization.md`:** Định danh trải nghiệm game và Bảo vệ dòng tiền hệ thống. 

*(100% rác dữ liệu ảo từ NoSQL đã bị triệt tiêu thông qua khóa ngoại SQL)*.
