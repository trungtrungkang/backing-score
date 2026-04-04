# E2E Workflows: 24. Discover & Explore

Trang `/discover` là trang đích (Landing/Home) dành cho cả khách vãng lai và người dùng đã đăng nhập. Khác với Feed (chỉ ưu tiên dạng lướt mảng bài viết dọc do người dùng follow đăng đoạn trích), trang Discover hoạt động như một Cửa hàng Ứng dụng (App Store) chuyên về âm nhạc.

## 1. Cấu trúc Giao diện (Layout Structure)

Trang được phân mảng thành các Component trượt ngang (`HorizontalScroll`) nhắm tối ưu hoá diện tích hiển thị di động. Các băng trượt bao gồm:
- **Ngôi sao (Featured)**: Các Project được đánh dấu thủ công `featured = true` do ban quản trị chọn lọc.
- **Mới nhất (Recently Added)**
- **Thịnh hành (Trending)** 
- **Được yêu thích nhiều nhất (Popular Favorites)**
- **Nhạc sĩ vĩ đại (Great Composers)**: Fetch danh sách Artist Entity từ hệ thống Wiki.
- **Khúc Cuồng Ca Lãng Mạn (Romantic Era)**: Lọc thư viện lấy các tác phẩm có gắn Tag Genre = `Romantic`.
- **Luyện Ngón (Beginner Path)**: Lọc thư viện gắt gao các tác phẩm có gắn Tag Difficulty = `Beginner`.
- **Collections**: Các Playlist công khai gom nhóm nhiều sheet nhạc do Teacher/Admin soạn.

## 2. Trình Hiển Thị Thẻ Nhạc (`<ScoreCard />`)
Thẻ `ScoreCard` là thẻ Card đa hình chứa siêu dữ liệu của mỗi dự án:
- **Cover Image Fallback**: Trải trải nghiệm UI siêu đẹp nhờ CSS thuật toán `linear-gradient` nội suy màu sắc dựa trên Tên Bài Hát (để khi file XML không có `coverUrl`, thẻ nhạc vẫn có màu nền lấp lánh sinh động, không bị đơn điệu).
- **Hệ thống Phù hiệu (Badges)**: Bóc xuất `project.tags` để tự gán màu:
  - Xanh lá (Easy - Beginner)
  - Xanh dương (Intermediate)
  - Đỏ (Advanced)
- **Tương tác**: 
  - Nút Copy / Import: Clone cấu trúc Dữ liệu gốc về tài khoản cá nhân.
  - Nút Favorite (Bookmark): Gắn `toggleFavorite` đẩy thẳng lên Database (D1/Turso qua Server Actions). Kích hoạt State để cập nhật Icon rực lên màu Vàng.
  - Nút Play count: `project.playCount`.

## 3. Thuật toán Dedup Đa Cấp (Hybrid Deduplication)
Bởi vì một tác phẩm xuất sắc (Featured) thường cũng sẽ Mới Nhất, cũng sẽ Lọt Top Trending, và có nhiều tim Favorites. Do đó việc fetch API ở các đầu ngõ sẽ gây dội nội dung (Một bài nhạc hiện trên giao diện liên tục 4 lần ở 4 băng trượt).
- **Giải pháp**: Xây dựng Set `featuredIds` ghim cố định. Dùng `useMemo` lọc bỏ (Filter) bất cứ Project nào có trong danh sách Featured khỏi các mảng Recent, Trending, Favorites. Điều chỉnh UI đảm bảo khán giả luôn thấy sự đa dạng của hệ sinh thái.

## 4. Khu Vực Bộ Lọc Toàn Ngành (All Scores & Filters)
Nửa dưới của trang là khu vực Tìm Kiếm Mở (Deep Search):
- Tích hợp `useDebounce` (chờ 400ms sau khi người dùng ngừng gõ tên nhạc phẩm mới bắn API Tìm kiếm lên CSDL).
- Fetch động kho Wiki Nhạc Cụ (`wikiInstruments`) vàwiki Thể Loại (`wikiGenres`) sinh ra các phím kén bộ lọc (Filter Pills) xếp hàng ngang.
- Tự động Reset bộ đếm phân trang (Pagination visibleCount) và Call lại Server Action tuỳ chọn kết hợp (`Difficulty` AND `GenreId` AND `InstrumentId`).

## Unit Test & E2E Scenarios Đề Xuất
- [x] **Test Render Gradient Card**: Truyền vào một Object project không chứa ảnh bìa (`coverUrl: null`, `name: "Symphony No. 5"`). Kỳ vọng render thẻ CSS tồn tại thuộc tính `style.background = linear-gradient(...)`.
- [x] **Test chống dội nội dung (Deduplication)**: Mock API `listFeatured` trả về Project A. Mock API `listTrending` trả về Project A và B. Kỳ vọng Băng trượt Trending trên màn hình HTML chỉ Render 1 cái ScoreCard của Project B.
- [x] **Test Nút Copy an toàn**: Log in tài khoản User X test bấm "Copy to My Drive" trên bài của User Y. Xác nhận API copy được gọi và User bị Router ép Push chuyển sang trang màn hình `/p/[id_moi]`.
