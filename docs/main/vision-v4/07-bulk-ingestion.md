# CHI TIẾT CÁCH LÀM: QUẢN LÝ & NHẬP LIỆU KHỐI LƯỢNG LỚN (1000+ PROJECTS)

Để nạp 1.000 bản nhạc Piano kèm theo hàng tá thông số Metadata (Kỹ thuật, Nhạc sĩ, Độ khó, v.v.), chúng ta Tuyệt Đối Không làm bằng tay qua Giao diện Web (Form Submit). Tài liệu này hoạch định **Đường ống nạp Dữ liệu Tự Động (The Ingestion Pipeline)**.

## 1. Nguồn Gốc Dữ Liệu (The Source of Truth)
Toàn bộ dữ liệu 1000 bài chưa nên đưa ngay lên Database. Nó phải được soạn thảo và kiểm duyệt ở môi trường máy tính cục bộ dưới dạng **Bảng Tính (Spreadsheet / CSV)**.

### Định Dạng File CSV Hoặc JSON Lõi:
Bạn sẽ duy trì một file `piano_master_library.csv` ở local với các cột cấu trúc:
- `file_path`: (Ví dụ: `./raw_data/chopin/nocturne_op9_no2.mxml`)
- `title`: "Nocturne Op. 9 No. 2"
- `composer`: "Frédéric Chopin"
- `period`: "Romantic"
- `difficulty`: 65
- `technicalTags`: "Cantabile, Polyphony"
- `playlist_paths`: "Chopin Highlights, Romantic Masterpieces"

Việc quản lý trên Excel/Google Sheet giúp bạn xài hàm (formula) hoặc nhờ ChatGPT sinh ra hàng loạt Tag kỹ thuật chỉ trong 1 nốt nhạc, tránh sai sót chính tả.

## 2. Đường Ống Kịch Bản Tự Động (The Node.js Ingestion Script)

Thay vì tạo Form trên Web cho Admin, chúng ta sẽ viết một đoạn code kịch bản chạy trên Terminal (`scripts/ingest-1000-piano.mjs`). Script này sử dụng Appwrite Node.js SDK (Admin Key) để có quyền Bypass toàn bộ Rules và vòng qua giới hạn bảo mật mảng Client.

### Quy Trình Hoạt Động Của Script (The Pipeline Flow):
1. **Đọc File CSV:** Script mở file `.csv` và đọc từng dòng.
2. **Xử lý Thực thể Wiki (Wiki Resolution):**
   - Đọc cột Composer ("Frédéric Chopin").
   - Dò vào Appwrite Database bảng `ArtistDocument`. Nếu chưa có -> Tạo luôn Artist Document mang tên Chopin và lấy lại cái `$id`. Nếu có rồi -> Kéo cái `$id` về.
3. **Đẩy File Tĩnh (R2 Uploading):**
   - Đọc cột `file_path`. Mở file vật lý trên ổ cứng của bạn (Local).
   - Dùng S3 SDK đẩy cực nhanh hàng ngàn file vật lý đó lên **Cloudflare R2 Bucket**. Lấy lại chuỗi `R2_Object_Key`.
4. **Đúc Sinh Thực Thể (Minting Documents):**
   - **Tạo SheetMusicDocument:** Mang ID chủ quyền là tài khoản Admin gốc của bạn, gắn cái `R2_Object_Key` kia vào.
   - **Tạo ProjectDocument:** Sinh ra project bọc lấy SheetMusicDocument vừa tạo. 
     Nhồi toàn bộ Metadata (Denormalized strings) vào project này: `tags`, `difficulty`. 
     Nhồi khóa cứng mảng ID: `wikiComposerIds = [chopin_id]`.
     Đóng dấu cờ: **`published: true`** để nó hiện lên Discover.

Tốc độ chạy Script này có thể hoàn thành cả 1000 dự án nhạc kèm upload R2 chỉ trong vòng **dưới 10 phút**.

## 3. Quản Trị Hậu Kỳ Mảng (CMS Admin Dashboard)

Mặc dù tự động hóa bằng Script là cực tốt, đôi khi Admin sẽ phát hiện ra "Ồ bài Für Elise nhãn kỹ thuật đang bị sai, cần gỡ cờ Polyphony ra". Vẫn cần 1 mặt bằng giao diện riêng.

### Thiết Kế Giao Diện Quản Trị Dạng Lưới (Ag-Grid CMS)
- Chúng ta KHÔNG dùng form sửa từng bài (Click -> Edit -> Save -> Back -> Next). Quá chậm.
- Xây dựng 1 trang riêng biệt `src/app/[locale]/dashboard/admin/cms`. (Chỉ mở khóa khi user role là `admin`).
- Hiển thị toàn bộ 1000 bài hát dưới dạng **Lưới Dữ Liệu giống hệt Microsoft Excel** (Dùng thư viện `ag-grid` hoặc `tanstack-table`).
- Admin muốn sửa điểm Độ Khó `difficulty` của 50 bài? Chỉ cần kéo thả chuột bôi đen 50 ô đó, gõ số "60" -> Hit Enter. Bắn API Update đằng sau nền âm thầm. Đây là Data-Entry Standard của kỷ nguyên SaaS Enterprise.
