# CHI TIẾT CÁCH LÀM: QUY HOẠCH KHO NỘI DUNG CHÍNH (THE OFFICIAL LIBRARY & DISCOVER)

Tài liệu này giải quyết bài toán quản trị và phân phối **Hàng Ngàn Project Chát Lượng (Ví dụ 1000 bản nhạc Piano Cổ Điển)**, đồng thời tái thiết kế trang Discover thành một cỗ máy Inbound Marketing và Giữ Chân Người Dùng (Retention Engine) thực thụ.

## 1. Phân Tầng Quyền Hạn Đăng Tải (Curated Publishing)

Trang Discover KHÔNG THỂ là một "Bãi rác Thập cẩm" nơi bất kỳ User nào cũng có thể Publish. Nó phải mang dáng vóc của một Nhạc Viện hoặc Tiệm Đĩa Than Cao Cấp.

- Cờ `published: boolean` trong ProjectDocument sẽ được khóa chặt bằng **Appwrite Permissions**. 
- Chỉ những User thuộc mảng Role `['admin']` hoặc có `customLabel: 'curator'` mới được phép đổi trạng thái `published = true` để ném bài hát lên trang Discover.
- **Dữ liệu User-Generaged Content (UGC):** Project của User bình thường vĩnh viễn là `published: false` (Chỉ lưu hành nội bộ trong Library cá nhân hoặc gán vào Bài giảng Classroom). Mọi Nút "Publish to Discover" trên giao diện User sẽ bị gỡ bỏ không dấu vết.

## 2. Tổ Chức 1000 Bản Nhạc Piano Cổ Điển (The Master Library)

Việc bạn định Upload 1000 tác phẩm lên nền tảng là một "Mỏ Vàng" Inbound SEO. Chúng ta sẽ không quẳng chúng thành một danh sách dài vô tận, mà sẽ liên kết chặt chẽ với hệ thống **Meta Wiki Taxonomy** (đã đề cập ở `03-social-wiki.md`).

### Cấu Trúc Khối Dữ Liệu: ProjectDocument vs SheetMusicDocument
- **KHÔNG GẮN LÊN PDF GỐC:** Đừng cố nhồi nhét siêu dữ liệu (Metadata) vào bảng `SheetMusicDocument` (Kho file tĩnh R2).
- **CHUYỂN HÓA THÀNH PROJECT:** Mỗi 1 bản trong số 1000 bản nhạc MusicXML/PDF đó phải được "Gói" (Wrap) lại thành 1 `ProjectDocument`. Bởi vì chỉ có Project mới sở hữu Player, sở hữu Audio Tracks và làm mồi nhử Flow Mode cho User. 

### Quy Luật Gắn Thẻ Metadata (Chuẩn Cấu Trúc Đa Tầng)
Trong bảng `ProjectDocument`, chúng ta quản lý Data theo cơ chế **Denormalized (Chuẩn Hóa Ngược)** để đảm bảo Appwrite Query tốc độ ánh sáng mà không cần JOIN dữ liệu:

1. **Khóa Liên Kết Cứng (Wiki Ids) - Dùng cho Phễu SEO Deep-Linking:**
   - `wikiComposerIds`: `["uid-beethoven"]` -> Click vào đây sẽ mở ra trang Tiểu sử Beethoven.
   - `wikiGenreId`: `"uid-classical"` -> Link sang Cây phả hệ âm nhạc.
   
2. **Khóa Tìm Kiếm Nhanh (Denormalized Strings) - Dùng cho Discover Carousel:**
   - `composerName`: `"Ludwig van Beethoven"` (Để render thẳng ra giao diện Discover mà không tốn kỳ Fetch thứ 2).
   - `tags`: `["Piano", "Sonata", "Romantic", "Arpeggio", "Masterpiece"]`. Các Shelf danh mục trên Discover thực chất là Query `Query.search("tags", "Romantic")`.
   - **`technicalTags` (Mới):** Cực kỳ quan trọng cho dân Piano. Phân loại kỹ thuật ngón như `["Scales & Arpeggios"]`, `["Polyphony"]`, `["Octaves & Chords"]`, `["Cantabile"]`. Giúp User lọc ra đúng bài yếu điểm của họ để tập.
   - `difficulty`: `45` (Chạy từ 1-100). Dùng để phân loại Khay (Shelf): "Dành Cho Người Mới", "Thử Thách Pianist".
   
3. **Lộ Trình Chinh Phục (Curated Learning Paths - Playlists):**
   - Thay vì quăng 1000 bài rời rạc bãi biển, Admin sẽ dùng Bảng `PlaylistDocument` kết cấu lại thành các "Sách điện tử".
   - Ví dụ: Playlist *"Từ con số 0 đến Czerny 599"*, Playlist *"Hành trình 30 ngày cùng Mozart"*, *"Chinh phục kỹ thuật ngón yếu (Etude)"*.
   - Khái niệm Learning Paths biến cái Thư viện thụ động thành một **Giáo Trình Khép Kín**, khiến user thấy họ có lộ trình để follow thay vì bị ngợp.
   
Chỉ riêng tài khoản Admin mới được tùy ý chỉnh sửa bộ Tag này trên màn hình Editor (Giao diện Project Settings). User thường khi tải file không có các ô input nhập chi tiết này.

### Kịch Bản Khai Thác Của Người Dùng (The Exploitation Flow)
1. User lần đầu Login, thấy tủ sách trống trơn. Chạm vào nút **Discover**.
2. Thấy mục *Top 100 Chopin Nocturnes*. Bấm vào nghe thử (Chơi miễn phí, nhưng bị khóa chế độ Mute/Flow Mode theo nguyên tắc `02-plg-gating`).
3. User thấy thích bài này, bấm vào nút **[❤️ Add To My Practice]** hoặc **[📂 Clone to My Library]**.
   - Hành động này sinh ra 1 document mới trong Bảng `FavoriteDocument` hoặc `SheetMusicDocument` kéo ID của bài Gốc vào Tab "Sách Của Tôi" của User.
   - Khi họ mang bài này ra Game Flow Mode điểm số cá nhân của họ cũng được lưu dưới Profile của họ ứng với ID Bài Gốc đó.
4. Điều này giúp Cụm 1000 bản nhạc này đóng vai trò như một **Chất Xúc Tác Điểm Neo (Anchor Point)**: Lôi kéo user đăng ký tài khoản chỉ để kẹp (bookmark) những bài hát này vào hồ sơ cá nhân của họ mà không tốn công mày mò tự tải PDF trên Internet. 

## 3. Tái Thiết Kế Trang Discover (Load-On-Demand Architecture)

Trang Discover hiện tại tải 1 lượt toàn bộ dữ liệu (Fetch All) gây nặng nề và Load chậm. Chúng ta sẽ làm mới toàn bộ theo phong cách UI vòm (App Store / Netflix).

### Giao Diện Cuộn Ngang (Horizontal Carousels)
Chia 1000 bài ra thành các Khối (Shelves) theo Metadata chứ không trải mành mành từ trên xuống dưới dạng Table:
- *Mới Khám Phá (Trending/New)* - Sort By `playCount`
- *Khúc Cuồng Ca Lãng Mạn (Romantic Era Piano)*
- *Nhạc Sĩ Vĩ Đại (Hàng Ngang Avatar Tròn Của Composer)*
- *Luyện Ngón Khúc Khởi Động (Level 1-10 Beginner)*

### Backend Paging (Infinite Scroll / Cursor Pagination)
Sử dụng công nghệ `react-query` (hoặc `swr`) kết hợp `Appwrite Cursor` để Load-On-Demand:
- Lượt gọi đầu chỉ Load 10 bài đầu tiên của mỗi Shelf.
- Khi User vuốt chạm đến nút `[Xem Thêm]`, thẻ `IntersectionObserver` báo tín hiệu gọi hàm Next Page Load thêm 20 bài (Tránh giật lag DOM DOM). Mọi thứ trượt êm mượt mướt mát trên cả Browser Web và Web-view Điện Thoại.
