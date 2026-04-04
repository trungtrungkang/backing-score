# API Reference: 02. Drive & Digital Music Actions

## 1. Projects Actions (`src/app/actions/v5/projects.ts`)

### `getProjectV5`
- **Inputs**: `projectId` (string).
- **Outputs**: `ProjectDocument` (Mock Appwrite format)
- **Business Logic**: Khớp `id = projectId`. Nếu length = 0 throw Error `"Dự án không tồn tại"`. Gọi `mockAppwriteFormat` trả về.
- **Unit Test Scenarios**:
  - [x] Input Valid UUID -> Trả ra object có `payload` stringified.
  - [x] Input Not Found -> Throws error.

### `updateProjectV5`
- **Inputs**: `projectId` (string), `updates` (Object partial: `name`, `published`, `coverUrl`, `payload`...)
- **Outputs**: `ProjectDocument`
- **Business Logic**:
  - Lấy session: Bị lỗi nếu chưa đăng nhập.
  - Parse linh hoạt giá trị `payload`: Nếu payload là String thì parse về JSON Object, nếu có các thuộc tính nổi như `wikiGenreId`, ghi thẳng vào Object `payload`.
  - Update lên bảng `projects`, sau đó gọi `getProjectV5` trả ra Object mới.
- **Unit Test Scenarios**:
  - [x] Throw Unauthenticated.
  - [x] Update JSON trường `payload` -> Thành công không xáo trộn cấu trúc con.
  - [x] Trường Update có chứa thẻ `wikiComposerIds` -> Thẻ được gài vào Payload.

### `listMyProjectsV5`
- **Unit Test Scenarios**:
  - Lọc theo UserId hiện hành, `limit = 100`, `orderBy desc createdAt`.

## 2. Nav-Maps (`src/app/actions/v5/nav-maps.ts`)

### `getNavMapV5`, `saveNavMapV5`
- **Inputs**: `sheetMusicId`.
- **Business Logic**:
  - Schema cho phép rẽ nhánh `sequence` và `bookmarks` phải là JSON thuần ở SQLite. Do vậy hàm parse và format logic bằng `typeof doc.sequence === 'string'`. Cẩn trọng việc parse 2 lần gây lỗi Type.
- **Unit Test Scenarios**:
  - [x] Parse JSON mảng Bookmarks chính xác, trả về Mảng Array không phải Object String.

## 3. Setlists (`src/app/actions/v5/setlists.ts`)

### `addProjectToSetlistV5`
- **Inputs**: `setId`, `projectId`
- **Business Logic**: Tính toán `order` tối đa trong bảng phụ `setlist_projects`. `MAX(order) + 1` để xếp bài mới vào cuối hàng.
- **Unit Test**: [x] Ensure constraint `UNIQUE(setId, projectId)` nếu User add trùng bài sẽ không văng lỗi sập server mà hiển thị Toast cảnh báo tự nhiên (Catch error code Constraint).
