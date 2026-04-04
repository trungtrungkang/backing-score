# Frontend API Reference: 11. Drive & Editor Components

## 1. `<DriveManager />`
- **Path**: `src/components/DriveManager.tsx` (Hoặc trong `dashboard`)
- **Description**: Trình quản lý cây thư mục Project UI. Hiển thị UI theo Grid hoặc List dựa trên state. Hỗ trợ hệ thống On-click để xem trước, Double-click để Edit, và kéo thả (Drag-n-drop).
- **Props**:
  - `folders` (Array): Dữ liệu tĩnh từ `getFoldersV5` hoặc fetch trực tiếp từ SWR.
  - `projects` (Array): Các bài hát trong cấp độ thư mục hiện hành.
  - `currentFolderId` (string | null): Xác định đường dẫn Breadcrumb điều hướng.
- **RTL Scenarios**:
  - [x] Test Drag-n-drop: Mock event DataTransfer của HTML5. Drag node `<ProjectItem />` và thả vào `<FolderNode />`. Hook `onMoveProject` phải được gọi với arguments chéo ID.
  - [x] Test Switch Layout: Click nút "View Mạng Lưới" (Grid) -> Component DOM đổi Class CSS theo CSS Module `grid-cols-3` thay cho `flex-col`.

## 2. `<RichTextEditor />`
- **Path**: `src/components/RichTextEditor.tsx`
- **Description**: Soạn thảo văn bản, viết Bio, hoặc Post nội dung có chứa thẻ HTML nhẹ tránh XSS. Dùng thư viện Lexical hoặc TipTap.
- **Props**:
  - `initialContent` (string): Dạng JSON thô hoặc HTML tùy config.
  - `onChange` (function): Bắn stringified value ngược lên Formik/React Hook Form.
  - `readOnly` (boolean).
- **RTL Scenarios**:
  - [x] Soạn thảo text: Test event Type lên text area ẩn bên trong contenteditable div `fireEvent.input` -> `onChange` bắt được chuỗi giá trị.
  - [x] Ngăn ngừa XSS (Security testing mock): Truyền thẻ `<script>alert("hack")</script>` qua đầu vào `initialContent`. Render DOM không được chèn thẻ Script sán tiếp mà phân giải ra chữ Literal.

## 3. `<ProjectActionsMenu />`
- **Path**: `src/components/ProjectActionsMenu.tsx`
- **Description**: Menu thả xuống (Dropdown/Context Menu) hiển thị các tác vụ như Nhấn đổi tên, Xóa, Chia sẻ, Cấp quyền, Tải về file.
- **Props**:
  - `project` (Project Object).
  - `onDelete`, `onShare` (Callbacks).
- **RTL Scenarios**:
  - [x] Test Accessibility Context Menu khép kín: Nhấn ra ngoài màn hình (Click-outside listener), component Radix/Headless UI tự động biến mất và Unmount trong Node môi trường JSDOM.
