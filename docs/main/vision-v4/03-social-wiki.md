# CHI TIẾT CÁCH LÀM: HỆ SINH THÁI TƯƠNG TÁC (SOCIAL FEED & WIKI ENGINE)

Tài liệu này mổ xẻ cấu trúc Mạng lưới Bảng tin Không Rác (Private Feed) và Hệ Thống Kho Siêu Dữ Liệu SEO (Taxonomy Meta-Wiki).

## 1. Mạng Xã Hội Khép Kín (Anti-Spam Social Feed)

Trọng tâm là di dời nguồn Newsfeed từ "Cả Thế Giới" thu hẹp thành "Bất động sản của Tổ chức/Lớp".

### Cập Nhật Appwrite (Bảng `PostDocument`)
- **Phân Khúc Hiển Thị:** Bổ sung trường `visibility: 'followers' | 'classroom'`.
- **Cụ Thể Hóa Thục Thể:** Bổ sung `classroomId?: string` & `isPinned?: boolean` cho quyền hạn Lớp trưởng.
- **Sản Phẩm Đính Kèm Khủng:** Thay vì chỉ đăng Text/Project, cần hỗ trợ `attachmentType: 'sheet_music' | 'assignment' | 'recording_score'`.

### Cách Code Màn Hình Trang Chủ (Dual Feed Aggregator)
Thuật toán lấy bài viết hiển thị ra Home Dashboard không còn là Select * OrderBy Date. Nó là phép Hợp (Union) của 2 luồng Query cực khó:
- **Luồng 1 (Bạn bè):** Lấy danh sách bạn bè mà User đang theo dõi (Trong `FollowDocument`), trỏ lại qua bảng `PostDocument` để bốc bài đăng của họ.
- **Luồng 2 (Cộng đồng Lớp):** Lấy danh sách ID các lớp mà User đã Đăng Ký Active. Trỏ lại bảng `Post` bốc những bài thuộc ID Lớp đó.
*(Vì Appwrite không hỗ trợ JOIN dính 2 mảng này trực tiếp, Backend Node.js / Serverless Function hoặc Next.js Server Components sẽ phải gọi 2 lệnh ListDocuments song song và Merge/Sort theo biến Thời gian trước khi nhả Data về Client).*

### Hệ Thống Ngăn Chặn Spam (Tôn Vinh Video Trình Diễn)
- Nếu Học sinh được 100 điểm, Backend không tự tạo Status rác rưởi "Tôi vừa được 100 Điểm".
- Sự kiện "Khoe thành tích" bắt buộc đính kèm File Media có giá trị Nghệ Thuật. Sẽ có 2 loại Media được ưu tiên đăng lên Feed:
  1. **Video Camera (FaceCam/HandCam - Khuyến khích số 1):** App xin quyền Webcam quay lại hình ảnh ngón tay người chơi lướt trên phím đàn hoặc khuôn mặt đang phiêu. Việc nhìn thấy một người thực sự "diễn" tạo ra cảm hứng mạnh gấp 10 lần việc chỉ nghe tiếng. Đối với Teacher trong lớp học, loại Video này là **Bắt buộc** để Thầy sửa dáng tay, thế ngồi.
  2. **Video Màn Hình (Screen-record / Replay):** Thu lại hình ảnh các Nút nhạc rơi trên màn hình Flow Mode chuẩn nhịp Xanh-Đỏ kèm âm thanh mộc.
- Cả 2 loại Video Video `.mp4`/`.webm` này sẽ được giới hạn trích đoạn ngắn tầm 15 - 30s (Sneak Peek) để tiết kiệm dung lượng R2, nhưng dư sức hút ngàn Like trên Feed.

---

## 2. Hệ Thống Dữ Liệu m Nhạc (Meta-Wiki Taxonomy & Inbound SEO Funnel)

Sân chơi Wiki Cổ Điển tự do viết bài đã đi vào Dĩ Vãng. Backing & Score coi Wiki là 1 cỗ máy Bộ Gõ Meta Labels chuẩn ISO và một chiếc Bẫy Marketing SEO.

### Phễu Crawl & Tích Hợp Lõi Tìm Kiếm
- Khóa toàn bộ các nút `Create Artist`, `Create Genre` khỏi User.
- Ở giao diện Create Project, Teacher Up Bài Hát "Für Elise" lên. Text-field `Composer` không phải thẻ `<input type="text">` bình thường, mà là một thẻ `<AutocompleteSearch />` chọc thẳng qua API Wiki Engine. Teacher chỉ được CHỌN Beethoven từ Dropdown List chứ không được viết tay "Beethoven".
- Do Database Project gắn chết với `wikiComposerId`. Việc Search "Lọc toàn bộ tác phẩm Beethoven" có tốc độ Fast-Index trong tích tắc mà không sinh ra lỗi Data trùng lặp chữ. (Data-Clean Architecture).

### Public Google SEO & Bẫy Chuyển Đổi (Inbound Marketing)
- Thiết lập App Next.js có Routing `app/wiki/artist/[slug]/page.tsx` Không Cần Login Auth. (Public).
- Render Server-Side (SSR) toàn bộ thông tin Nghệ Sĩ Lấy từ Database Wiki. Trang Wiki mượt mà điểm 100.
- Lập Trình Sticky Banner bên mép dưới màn hình (Call To Action - Nút CTA nhấp nháy): *[Tải lên miễn phí 100 bài PDF của Beethoven và luyện tập ngay bằng chế độ Auto-Scroll trên Backing & Score]* -> Click Dẫn Về Màn Hình Login.
- User có nhu cầu Google -> Va vào Bẫy SEO Wiki -> Tò Mò Đăng Ký App -> Ném PDF lên kho -> Bị gài Gating -> Sinh Lượt Mua.
