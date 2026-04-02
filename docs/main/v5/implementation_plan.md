# Bản Vẽ Kiến Trúc: B&S Drive & Tiêu chuẩn "Hợp Nhất Dự Án" (The Universal Project Model)

Thấu kính của bạn cực kỳ sắt bén! Việc chia rẽ hệ thống thành "Projects" (dành cho MusicXML) và "PDFs" (dành cho Sheet Music) là một rào cản di sản rất lớn. 
Nếu mục tiêu của Phase 3 là "PDF cũng có thể chạy Audio Sync", thì **bản chất PDF cũng chỉ là một Định dạng hiển thị Nhạc Lý (Notation Layer), y chang MusicXML.**

Bản kế hoạch này đập đi khái niệm cũ và xây dựng hệ thống **Asset-Driven Workspace** y hệt Google Drive.

## 1. Hợp nhất Cơ sở dữ liệu (The Great Merge)

Thay vì duy trì 2 bảng DB là `v4_projects` và `v4_sheet_music`, ta gộp chúng làm một. Hệ sinh thái Backing & Score từ nay chỉ tồn tại một khái niệm duy nhất mang tên: **Project**.

### Cấu trúc Project Payload Mới
Mọi Project đều bám vào xương sống `DAWPayload`. Chúng ta chỉ cần update Interface `NotationLayer` (nằm trong file `lib/daw/types.ts`) để hỗ trợ định dạng PDF.

```typescript
// Cấu trúc Payload thống nhất
interface CurrentDAWPayload {
  formatVersion: number;
  notationData?: {
    type: "music-xml" | "pdf" | "none"; // ---> THÊM 'pdf' VÀO ĐÂY!
    fileId: string; // Trỏ tới S3 / R2 Key
    
    // Nếu là PDF, nhét thêm các trường đặc thù vào đây:
    pageCount?: number;
    thumbnailId?: string;
    navMap?: any; // Dành cho Measure Markers Tracking
  };
  audioTracks: AudioTrack[]; // Cả PDF lẫn XML đều dùng chung cái này!
}
```

**Sức mạnh của việc này:**
Khi bạn làm vậy, File PDF "ăn ké" được ngay lập tức các siêu năng lực của MusicXML: **Bàn trộn Mixer, Thanh Cuộn Thời Gian, Metronome, Tag/Genre Hệ thống, Phân quyền Publish, v.v.** mà không cần code lại DB cho PDF!

## 2. Component Cốt Lõi: The Drive Storage (File Manager)

Sẽ không còn trang `dashboard/projects` hay `dashboard/pdfs` rẻ rẽ nữa. Chúng ta thay thế bằng **1 Component vạn năng: `<DriveManager />`**.

*   **Giao diện:** Trông như Google Drive. Có cây thư mục ảo (Sử dụng Ảo ảnh Thư mục Appwrite như đã chốt).
*   **Hành vi Kéo Thả (Universal Dropzone):**
    *   Hành động: User kéo 1 file `.musicxml` thả vào.
    *   Kết quả: Hệ thống tự tạo 1 Project mới có `type: "music-xml"` và quăng R2 fileId vào Payload. Hiện icon 🎼.
    *   Hành động: User kéo 1 file `.pdf` thả vào.
    *   Kết quả: Tự tạo 1 Project mới có `type: "pdf"`. Hiện icon 📄.
    *   Hành động: User kéo 1 file `.mp3` thả vào trống không.
    *   Kết quả: R2 tải lên file `usr_xxx.mp3`, ghi danh vào Database `assets` nhưng chưa khởi tạo Project. Tệp này mang trạng thái "Rác chờ ghép".
*   **Hành vi Menu Mở Rộng (The 6-Action Context Menu):** 
    Mỗi Project trong lưới lưu trữ sẽ kẹp một dấu 3 chấm (Dropdown) chứa đúng 6 thao tác quyền lực:
    1. `View`: Trổ ra màn hình Luyện tập/Biểu diễn.
    2. `Edit`: Sửa file vào Dashboard/Editor.
    3. `Delete`: Xóa mềm hạ tầng.
    4. `Favorite`: Chèn tim/Thả Bookmark.
    5. `Save to playlist`: Gắn cờ vào Bộ sưu tập (Setlist).
    6. `Move`: Diệt / Di chuyển Đổi thư mục ảo trong Drive.

*   **Lời giải cho bài toán Auto-Play Playlist (The Universal PlayShell):**
    *   Thay vì gảy làm 2 trang rời rạc `/play/[id]` và `/pdf/[id]`, chúng ta sẽ **HỢP NHẤT TRÌNH PHÁT (Unified Player)** ngay tại `/play/[id]`. 
    *   File `PlayShell.tsx` sẽ hoạt động như một Trạm Phân Luồng: Nó check `notationData.type`. Nếu là `music-xml` -> Load giao diện Component *VerovioVisualizer*. Nếu là `pdf` -> Hủy Verovio và gắp Component *PdfVisualizer* thế chỗ vào.
    *   Nhờ việc cả 2 đều chạy chung chung nền tảng `/play/[id]`, Cỗ Máy Phát Nhạc (AudioEngine) vẫn giật luồng MP3 Stems chạy ngầm không đứt quãng. Khi thanh Auto-Play đếm ngược hết bài MusicXML, nó trượt cái rẹt sang bài PDF tiếp theo trong Playlist mượt mà như một dải lụa không hề tải lại trang (Zero-Refresh)!

## 3. Kiến Trúc Database Lớp Hạ Tầng (The 2-Layer System)

Hệ thống sẽ chạy đúng 2 Cột Trụ (thay vì rối tung như cũ):

1. **Lớp Tài Sản Tầng Thấp (Raw Assets / `v4_drive_assets`):** Danh mục mọi file vật lý nằm trên R2. Chỉ lo việc tính Quota (MB), báo rác.
2. **Lớp Dự Án Tầng Cao (Workspaces / `v4_projects`):** Mọi "Dự án" gôm các thẻ Raw Assets này lại thành một bài tập hoặc bài diễn trình Music/PDF. Folder lồng nhau được nối vào bảng `v4_drive_folders` để sắp xếp UI.

## user Review Required

> [!WARNING]
> Đây là một ca "phẫu thuật" lột xác toàn bộ luồng User Experience của Web App. Sẽ cần di cấu (Migration) dữ liệu PDF cũ thành dạng Project Payload.
> 1. Bạn có đồng tình với nước cờ "Tuyệt diệt `sheet_music`, chỉ giữ lại `projects`" này không? 
> 2. Kế hoạch này yêu cầu ta gỡ bỏ menu "PDFs" và "Projects" trên thanh Sidebar thay thế bằng menu **"Lưu Trữ (Drive)"**. Bạn ok với độ nghiến của sự thay đổi này chứ?
