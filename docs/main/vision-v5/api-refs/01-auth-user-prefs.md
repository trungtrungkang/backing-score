# API Reference: 01. Auth & User Preferences

Đóng vai trò quản lý tài khoản và sở thích cá nhân.

## 1. getPublicProfileV5
- **Path**: `src/app/actions/v5/user-prefs.ts` (hoặc `src/app/actions/user.ts`)
- **Description**: Trả về dữ liệu Public Profile của một người dùng bao gồm thông tin user cơ bản và user_prefs. Không trả về thông tin nhạy cảm.
- **Inputs**: 
  - `userId` (string, required): ID của mục tiêu.
- **Outputs**:
  - `Object` chứa: `{ name, email, prefs: { avatarUrl, bio, urls, ...} }`.
- **Business Logic**:
  - Truy vấn bảng `users` (Better-Auth).
  - LEFT JOIN với bảng `user_prefs` bằng `userId`.
  - Loại bỏ các trường nhạy cảm (passwords, tokens).
- **Unit Test Scenarios**:
  - [x] Input Valid UUID -> Trả về correct format với `prefs` là object.
  - [x] Input Valid UUID nhưng User chưa có bản ghi `user_prefs` -> `prefs` fallback về rỗng hoặc default.
  - [x] Input Invalid UUID -> Trả về Null hoặc Throw Exception.

## 2. updateMyPrefsV5
- **Path**: `src/app/actions/v5/user-prefs.ts`
- **Description**: Cập nhật hồ sơ tài khoản cá nhân.
- **Inputs**: 
  - `updates` (Object partial): `avatarUrl`, `bio`, `urls`, `name`.
- **Outputs**:
  - Trả về `user` object sau khi update.
- **Business Logic**:
  - Chặn quyền: Bắt buộc lấy `userId` từ context (Better Auth session). Throws `Unauthorized` nếu không có.
  - Kiểm tra nếu `updates.name` tồn tại -> Update sang bảng `users`.
  - Cập nhật bảng `user_prefs` thông qua `INSERT ... ON CONFLICT (...) DO UPDATE`. SQLite Upsert.
- **Unit Test Scenarios**:
  - [x] Request không có Auth Header -> Exception `Chưa đăng nhập`.
  - [x] Upsert Prefs cho user lần đầu -> Bản ghi mới sinh ra.
  - [x] Update JSON trường `urls` -> Định dạng JSON lưu trữ chuẩn xác, không bị parse string 2 lần.
