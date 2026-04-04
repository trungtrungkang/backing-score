# API Reference: 03. Social, Gamification & Feeds Actions

## 1. Social Interactions (`src/app/actions/v5/social.ts`)

### `toggleReaction`
- **Inputs**: `targetType: "post"|"comment"`, `targetId: string`, `reaction: "like"|"love"|"haha"|"wow"`
- **Outputs**: `boolean` success status.
- **Business Logic**:
  1. Kiểm tra session. Nếu không có, ném lỗi auth.
  2. Map type để lấy correct Table và ID column (`postId` hoặc `commentId`).
  3. Lấy Row cũ của Reaction thông qua `userId, targetId`.
  4. Nếu Reaction Cũ tồn tại và Bằng loại mới -> DELETE (Bỏ like). Cập nhật giảm counter trong Post.
  5. Nếu Cũ tồn tại và Khác loại mới -> UPDATE. Tăng loại mới 1, giảm loại cũ 1.
  6. Nếu Không có (Reaction lần đầu) -> INSERT mới. Tăng Total và counter cụ thể.
- **Unit Test Scenarios**:
  - [x] Toggle cùng loại liên tục -> Trạng thái Bật/Tắt chập chờn xử lý Race Condition bằng `ON CONFLICT` chính xác.
  - [x] Reaction counter âm -> Các trigger/counter DB không bao giờ tụt dưới 0.

### `addCommentV5` & `getComments`
- **Inputs**: `postId`, `content`
- **Business Logic**: 
  - Chèn bản ghi vào bảng `comments`. Tăng biến đếm `commentsCount` bên trong `posts` lên 1.
- **Unit Test Scenarios**: [x] Test tính toàn vẹn của Event: gọi Trigger Push Notification.

## 2. Notifications & Activities (`src/app/actions/notifications.ts`)

### `createNotificationAction`
- **Inputs**: `recipientId`, `type`, `actorId`, `targetType`, `targetId`.
- **Business Logic**:
  - Tự động bỏ qua (Trả về Null) nếu vòng lặp tự thân (Self-notification) `recipientId === actorId`.
  - Khớp khóa chia rẽ `targetType`: Nếu là `post`, nhét `targetId` vào `postId`. Nếu `project`, nhét vào `projectId`. Các cột còn lại gài `null` ở Schema.
- **Unit Test Scenarios**: [x] Không lưu log thông báo rác khi tự Like.

## 3. Gamification (`src/app/actions/v5/gamification.ts`)

### `assignDailyExp` / `handleDailySession`
- **Business Logic**:
  - Gọi mỗi khi User ấn nút "Get Reward" sau khi hoàn thành Challenge.
  - `UPDATE user_levels SET currentXp = currentXp + 20`
  - Nếu `currentXp > threshold_cua_level_tiep_theo` -> Tăng `currentLevel`.
- **Unit Test Scenarios**: [x] Threshold calculation: Nếu Exp cộng dồn vượt liên tục 2 Level (Trường hợp hack Exp), vòng lặp While sẽ tính Exp dư và đẩy Max level tăng dần.
