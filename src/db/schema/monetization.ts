import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

// 1. Sản phẩm đăng bán
export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  creatorId: text('creator_id').notNull().references(() => users.id),
  targetType: text('target_type', { length: 32 }).notNull(), // 'course' hoặc 'pdf'
  targetId: text('target_id').notNull(), 
  priceCents: integer('price_cents').notNull(),
  lemonSqueezyVariantId: text('lemon_squeezy_variant_id', { length: 64 }).notNull(),
  status: text('status', { enum: ['draft', 'active', 'archived'] }).notNull().default('draft'),
});

// 2. Doanh thu (Purchases - Webhook từ LemonSqueezy trả về)
export const purchases = sqliteTable('purchases', {
  orderId: text('order_id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  productId: text('product_id').notNull().references(() => products.id),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency', { length: 16 }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 3. Giấy phép sở hữu (Entitlements)
export const entitlements = sqliteTable('entitlements', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetType: text('target_type', { length: 32 }).notNull(), // 'course' / 'pdf'
  targetId: text('target_id').notNull(),
  sourceProductId: text('source_product_id').notNull().references(() => products.id),
  grantedAt: integer('granted_at', { mode: 'timestamp' }).notNull(),
});

// 4. Thuê bao định kỳ (Subscriptions) - LemonSqueezy Pro/Studio Tier
export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(), // ID trả về từ LemonSqueezy (lemonSqueezySubscriptionId)
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status', { length: 32 }).notNull(), // active, past_due, canceled
  planId: text('plan_id').notNull(), // variantId
  planName: text('plan_name'),
  productId: text('product_id'),
  orderId: text('order_id'),
  customerId: text('customer_id'),
  userEmail: text('user_email'),
  currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }).notNull(),
  cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).notNull().default(false),
});
