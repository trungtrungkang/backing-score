# Frontend API Reference: 12. Social & Gamification Components

## 1. `<ReactionButton />`
- **Path**: `src/components/ReactionButton.tsx`
- **Description**: Nút thả Tương tác cho Post. Render các dạng biểu tượng cảm xúc linh tinh (Like, Love) và số đếm tích hợp.
- **Props**:
  - `targetType: "post"|"comment"`
  - `targetId: string`
  - `initialReaction: string | null` (User đã thả gì trước đó chăng?)
  - `initialCount: Record<string, number>` (Maps theo từng biểu tượng).
- **RTL Scenarios**:
  - [x] Test Optimistic UI (Rất quan trọng):
    1. Giả lập một SWR hook (hoặc RQ `useMutation`).
    2. Click vào Like. Assert màn hình render Icon đỏ và count `+1` lập tức mà không chờ Response API mock.
    3. Trả Mock Network Failure (`res.status = 500`). UI tự Rollback lại màu trắng ngà và đếm số cũ.
    4. Fire Event `toast("Lỗi hệ thống", { type: "error" })` được trigger.

## 2. `<NotificationBell />`
- **Path**: `src/components/NotificationBell.tsx`
- **Description**: Chiếc chuông trên Toolbar Header. Component này gọi Hook poll API Real-time hoặc SWR lấy danh sách `notifications` chưa đọc. Tự hiện Dấu chấm đỏ (Badge).
- **Props**: none (Tự fetch context dữ liệu).
- **RTL Scenarios**:
  - [x] Mock `listMyNotifications` trả về mảng 3 item có `isRead: false`. Dấu Badge phải render giá trị TextContext `3`.
  - [x] Click chuông đổ xuống Dropdown (Popover).

## 3. `<RequireTier />` & Gamification Badges
- **Path**: Thư mục `src/components/gamification/` & `src/components/RequireTier.tsx`
- **Description**: `<RequireTier>` là Higher-Order Component hoặc Wrapper bảo vệ UI. Nó khóa các Element con và hiển thị hình Ổ khóa nếu User chưa đủ Level hoặc Premium.
- **Props**:
  - `levelThreshold` (number).
  - `premiumOnly` (boolean).
  - `children` (ReactNode).
- **RTL Scenarios**:
  - [x] Render với Mock Context `userLevel: 2`, prop `levelThreshold: 5` -> Wrapper chặn Children không render ra DOM, đồng thời xuất hiện Dòng nhắc nhở "Cần cày lên cấp độ 5" kèm theo một link điều hướng Call-to-action cày Level.
  - [x] Render vượt chuẩn -> UI Children bóc tách nguyên dạng xuất hiện.
