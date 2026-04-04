# API Reference: 05. Wikipedia & Knowledge Graph Actions

## 1. Core Wiki Querying (`src/app/actions/v5/artists.ts`, `instruments.ts`, `compositions.ts`)

### Mẫu Pagination chung (Keyset Pagination)
Tất cả các API List trong hệ thống Wiki (ví dụ `listArtistsV5`) đều được viết lại kiểu Phân trang theo Cursor (Tọa độ quét ID) thay vì Offset thuần túy do Drizzle Builder có vấn đề type.
- **Inputs**: `limit: number`, `cursor?: string`.
- **Outputs**: `Array<EntityDocument>`.
- **Business Logic**:
  - Không có cursor: `db.select().orderBy(name).limit(x)`
  - Có cursor (Load More): `db.select().where(gt(id, cursor)).orderBy(id).limit(x)`. Đây là kĩ thuật Keyset Pagination mạnh mẽ cho Edge SQL.
- **Unit Test Scenarios**:
  - [x] Limit truyền vào rỗng -> Fallback về lượng page mặc định 20.
  - [x] Con trỏ kế tiếp (Next Cursor) có sinh ra ID lớn hơn chính xác theo thuật toán Alpha-numeric sorting hay không.

### `getArtistBySlugV5`, `getCompositionBySlugV5`
- **Inputs**: `slug: string` (VD: `"ludwig-van-beethoven"`).
- **Business Logic**: Tìm duy nhất 1 bản ghi qua mệnh đề `eq(slug, incoming_slug)`. Trả về `mockFormat` tương thích với Schema của bản cũ. Trả về `null` nếu 404 (Không ném Throw cho SSR xử lý `notFound()`).
- **Unit Test Scenarios**:
  - [x] Kiểm tra SSR: Hàm phải return null chứ không Crash hệ thống.

## 2. Dynamic Fetching trên Giao diện Discover

### `listProjectsByArtistV5` (Trong `projects.ts`)
- **Inputs**: `artistId: string`
- **Business Logic**: Chạy vòng lặp qua mảng JSON của `payload` Project.
  - Do SQLite JSON array chứa mảng động (VD: `[ "artistID_A", "artistID_B" ]`), tạm thời Drizzle không cung cấp hàm Full Text JSON `in()` trơn tru giống PostgreSQL, cho nên logic tạm thời (`Phase 5.0`) là lấy về Memory (limit 100 bài hát xuất bản) và `.filter(p => p.wikiComposerIds?.includes(artistId))` ngay trên Node.js JS logic. Đảm bảo tốc độ nhanh mà không phức tạp hóa Query.
- **Unit Test Scenarios**:
  - [x] Ensure Data Filter Type: Kiểm tra hàm mảng `.includes()` không bị sập (TypeError) nếu bài nhạc không có Object `wikiComposerIds` nào cả.
