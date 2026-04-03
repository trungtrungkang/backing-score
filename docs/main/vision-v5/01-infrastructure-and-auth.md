# KIẾN TRÚC V5: INFRASTRUCTURE & AUTHENTICATION (D1 + BETTER-AUTH)

Tài liệu này xác định nền móng cơ sở hạ tầng (Infrastructure) và chiến lược xác thực (Authentication) cho phiên bản V5 của Backing & Score, đánh dấu sự dịch chuyển từ nền tảng Appwrite (Document/NoSQL) sang kiến trúc Cloudflare D1 (Serverless SQLite) và Better-Auth.

## 1. Cơ sở Hạ tầng Đầu Cuối (Edge Infrastructure)

Kiến trúc V5 loại bỏ hoàn toàn sụ phụ thuộc vào một máy chủ trung tâm (như Appwrite hay Docker Server), và sử dụng 100% mạng lưới Edge (Mạng rải rác toàn cầu).

- **Compute/Application Layer:** Next.js (App Router) chạy trên Vercel Edge hoặc Cloudflare Pages.
- **Database Layer:** Cloudflare D1 (Serverless SQLite).
- **Storage Layer:** Cloudflare R2 (Object Storage cho PDF, Audio, MusicXML).
- **ORM:** Drizzle ORM (Trọng lượng siêu nhẹ, hỗ trợ native cho D1).

*Lợi ích:* Chi phí lưu trữ gần như bằng không với gói Free tier khổng lồ, thời gian phản hồi (Latency) siêu tốc do Database nằm ngay cạnh người dùng. Hỗ trợ tốt nhất cho PWA và tính năng "Offline-First".

## 2. Authentication: Better-Auth thay thế Appwrite Auth

Thành phần quan trọng nhất khi loại bỏ Appwrite là chúng ta phải tự quản lý Identity. Chúng ta chọn **Better-Auth** làm bộ khung Authentication lõi. Khác với Clerk hay Auth0, Better-Auth không giữ Database người dùng của bạn. Dữ liệu nằm hoàn toàn trên bảng Database `users` của D1.

### 2.1 Cấu trúc Bảng Auth trong D1 (Drizzle Schema)

Theo chuẩn mặc định của Better-Auth, D1 phải có 4 bảng này làm xương sống:

```typescript
// src/db/schema/auth.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
    image: text("image"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    
    // Custom field (Ánh xạ từ Appwrite Labels)
    role: text("role", { enum: ["student", "teacher", "creator", "admin"] }).default("student"),
});

export const sessions = sqliteTable("sessions", {
    // Session token để xác thực
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = sqliteTable("accounts", {
    // Quản lý đăng nhập Google, Github...
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    // ...
});
```

### 2.2 Ánh xạ Phân Quyền (RBAC Mapping)

Ở Appwrite V4, vai trò User được gán dưới dạng Mảng Nhãn (Labels: `admin`, `creator`, `contentmanager`). 
Trong hệ thống D1 V5, việc quản lý nhãn trở nên tường minh hơn bằng cột `role` trong bảng `users`. Better-Auth hỗ trợ **Plugins: Organization / Role-Based Access Control** out-of-the-box, cho phép bạn check quyền trực tiếp ở Server Actions của Next.js bằng:

```typescript
const session = await auth.api.getSession({ headers });
if (session?.user.role !== "admin") throw new Error("Chỉ admin mới vào được đây!");
```

## 3. Chiến lược Di Trú Zero-Downtime (Strangler Fig Pattern)

Đây là điều cốt lõi giúp hệ thống chuyển đổi qua V5 mà 100% User cũ không nhận ra hệ thống đã được đập đi xây lại.

**Bước 1: Setup Hệ thống Song song**
- Bản cài đặt của cả `src/lib/appwrite` và `src/lib/auth/better-auth` cùng tồn tại trong dự án.

**Bước 2: Lazy Migration cho Cổng Đăng Nhập**
- Tại Frontend, Form Đăng Nhập chặn luồng submit. Truy vấn đăng nhập email/password được gửi cho Better-Auth ở D1 làm trước.
- **Nếu thất bại / Không tìm thấy tài khoản (User cũ của Appwrite chưa có dữ liệu bên D1):** 
  - Gọi lên Appwrite `account.createEmailPasswordSession()`.
  - Nhận về object Profile của Appwrite User.
  - Chạy hàm mật Backend (từ BetterAuth) như `admin.createUser()` tự động bơm User ID cũ đó vào bảng `users` trên Database D1.
  - Cắt JWT của Appwrite, tự phát sinh lại Session Cookie của BetterAuth.
- Từ hôm sau, User đó login bằng tài khoản cũ, luồng Better-Auth D1 tự động xử lý thành công không cần đi tới bước gọi check Appwrite nữa.

**Bước 3: Gỡ bỏ dứt điểm**
- Chạy một kịch bản Data Dump (Export hàng nghìn users còn ngủ đông chua từng đăng nhập thử) từ bảng User của Appwrite chèn nốt vào D1 trong 1 đêm. Gỡ thư mục Appwrite Auth khỏi mã nguồn.
