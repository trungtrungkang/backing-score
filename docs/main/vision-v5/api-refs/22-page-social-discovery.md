# E2E Workflows: 22. Social Feed & SEO Discovery

Tài liệu này xác định kiến trúc Render của 2 mảng cực nhạy cảm về Performance và SEO Web: Bảng tin cuộn vô tận (Social Feed) và Danh mục Tra cứu (Wiki).

## 1. Flow: `/feed` - Bảng tin Cuộn Vô Tận (Infinite Scroll)

Trang hiển thị bài đăng nội bộ giữa những thành viên chơi nhạc với nhau.

### Pagination UI (Intersection Observer)
1. Server SSR sẽ fetch 10 posts đầu tiên, ghim Node HTML tải trước nhằm cải thiện điểm LCP (Largest Contentful Paint).
2. Dưới cùng mảng List render thêm 1 Thẻ `<div>` đóng vai trò là "Cột mốc" Sentinel.
3. Khi User lướt chuột kéo thanh Sentinel chạm góc dưới màn hình, Hook `useIntersectionObserver` kích hoạt phát súng gọi hàm SWR `fetchNextPage()` kèm cái `cursor` bóc từ bài post số 10.
4. Nạp mảng mới, DOM Append thêm vào State List cũ.

### Xử lý Component `<PostItem />`
- Component này là một đa hình (Polymorphic). Nó sẽ gọi một Switch-case:
  - Nếu `post.attachedProjectId` có dữ liệu -> Bật Mini-Player Previewer góc bên trong hộp chữ. Cho phép phát nháp bài hát trước khi click hẳn vào Player chuyên sâu.
  - Nếu `post.attachedSetlistId` -> Render UI dạng bìa đĩa Playlist.

#### E2E Testing Scenarios (Sử dụng Cypress/Playwright)
- [x] Test Intersection Hook: Scroll Event mô phỏng kéo PageY, Assert hàm Server Action `listFeedPosts` phải bị Fire đúng 1 lần (kiểm tra Debounce chống Spam scroll).

---

## 2. Flow: Thư mục Wiki (`/wiki/...` & `/discover`)

Khác hoàn toàn với Bảng Tin (Nội bộ), khu vực Wiki nhắm thẳng tới tối ưu SEO tìm kiếm Google.

### `/wiki/artists/[slug]` (Static Route Generatation hoặc ISR)
1. Khi URL là `/wiki/artists/mozart`, bộ dò Next.js (App Router) xử lý params `slug` ở Backend Node.js.
2. Gọi Drizzle `getArtistBySlugV5("mozart")`. Nạp dữ liệu Tiểu sử.
3. Chèn `export async function generateMetadata` vào cục page để bơm thẻ `<title>Mozart - Tác phẩm | V5</title>` và thẻ Meta Graph OpenGraph để khi Share Facebook sẽ hiện đẹp.
4. Fetch đồng bảng (`listProjectsByArtistV5`) nạp danh sách Bài Cover của chính Mozart để đề xuất cộng đồng chơi thử.

#### E2E Testing Scenarios (Sử dụng Cypress/Playwright)
- [x] Lỗi SEO 404 Cứng: Truyền tham số Slug bậy bạ (ví dụ `/wiki/artists/nhac-si-ao`), page.tsx phải gọi hàm `notFound()` lập tức để quăng mã lỗi trình duyệt 404 Not Found chứ không được ra 200 OK trang trắng. Tối kị SEO Bot.
