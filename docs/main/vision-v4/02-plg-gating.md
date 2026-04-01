# CHI TIẾT CÁCH LÀM: CHIẾN LƯỢC TĂNG TRƯỞNG & DUNG LƯỢNG (PLG & FEATURE GATING)

Tài liệu này hướng dẫn cách thiết lập vũ khí Tăng trưởng Sản phẩm (Product-Led Growth). Khóa tính năng Luyện Tập Tối Thượng lại để bán Gói Đăng Ký (Subscription) và xả láng Dung lượng R2 để hút người dùng.

## 1. Cơ Chế Bẫy Dung Lượng R2 (Storage Engine)
Đội ngũ hiện tại đã tích hợp xuất sắc Cloudflare R2 thông qua cơ chế Presigned-URL (S3 Client API) thay thế hoàn toàn Appwrite Storage cồng kềnh. Bước tiếp theo chỉ là hiệu chỉnh tham số để kích hoạt phễu PLG:

- **Tận Dụng Băng Thông R2 ($0 Egress):** Vận hành lưu lượng cực rẻ, Frontend cứ việc nén trực tiếp File đẩy vào Bucket.
- **Set Quotas Bồi Dưỡng (Miễn phí):** Chỉnh cấu hình Limit. Thả phanh Quotas cho người dùng Free. Ví dụ Free User được Upload 100 bài PDF/XML. Student Tier đổi thông số thành Thả Cửa (Unlimited). 
- **Điểm Chạm Kỹ Thuật Tâm Lý:** Ép User dọn nhà, đẩy toàn bộ Gia tài Tờ Nhạc cá nhân của họ lên App B&S để hưởng thụ Trình Đọc cực nét. Quả núi Data trên Bucket R2 này đóng vai trò là "Cái Còng Tay" giữ chân user vĩnh viễn không rời App (Lock-in Effect).

## 2. Xây Dựng Tường Thu Phí Mềm (Soft-Paywall & Gating)
Lập trình việc khóa và hạn chế các nút chức năng trong Player theo Gói Thuê Bao (Tiers).

### Cấu Trúc Enum Role (Bản Đồ User Context)
Trong React Context hoặc Appwrite Profile Data, đính kèm trường `subscriptionTier: 'free' | 'pro' | 'studio'`.
*(Note: Cách đặt tên theo Service Level này tốt hơn đặt theo Nghề Nghiệp, giúp bạn up-sale "Gói Pro" cho nhóm Solo Musician tự kỉ, thay vì bắt họ mua gói "Học Sinh").*

### Middleware Khóa Cổng (Gating Higher-Order Components)
Viết một Component bọc mang tên `<RequirePro>` hoặc Custom Hook `useTierGuard()`.
- **Ví dụ Code Hook:** 
  ```tsx
  const { tier } = useAccount();
  const handleEnableFlowMode = () => {
    if (tier === 'free') return showUpgradeModal("Nâng cấp Gói Pro để đánh Flow Mode xả láng nhé!");
    startFlowMode();
  };
  ```

### Các Tính Năng Vàng Cần Lock Ngay Lập Tức
1. **Giao Diện Chấm Điểm (Flow-Mode Game):** Bất kỳ thao tác chuyển Toggle Button trên Giao Diện `PlayShell.tsx` đòi kích hoạt Flow Mode (ngoài 10 lượt Free) phải bị đánh chặn bằng Modal nâng cấp `Gói Pro`.
2. **Annotation Đồng Bộ Đám Mây:** Bút highlight bút xóa rulo của PDF chỉ cho nháp nháp offline. Nâng cấp Pro để bật chức năng "Lưu Annotation này lên Máy Chủ".
3. **Mute/Solo Stems (MusicXML):** Chỉ cho dân Pro dùng. User Free phải nghe toàn vẹn bài hát (Backing Master).
4. **Nút "Studio Dashboard" (Hệ Sinh Thái LMS):** Nút này ẨN VĨNH VIỄN khỏi Sidebar của Free và Pro. Nâng cấp lên `Studio Tier` mới thấy nút bấm này để truy cập Màn Hình Quản Lý Lớp Học/Giao Bài.

## 3. Lập Trình Hiệu Ứng Hào Quang (Halo Effect Demonstation)
Đây là logic Khuyến Mãi Ngầm cực kỳ phức tạp nhưng hái ra tiền.

- **Bài Toán Định Danh Assignment:** 
  Khi 1 Free User gõ Mã Tham Gia (Join Code) lọt vào Classroom, click vào một bài tập Thầy Giao (`AssignmentDocument`). Frontend Player nhận diện cờ `isAssignedPayload === true`.
- **Ngoại Lệ (Bypass) Cho Học Việc:** 
  Hàm `useTierGuard()` sẽ rẽ nhánh. Miễn là nó đang nằm ở chế độ làm bài tập cho Lớp Kín, mọi chốt chặn `RequirePro` bị vô hiệu hóa!
  Học viên Free đó ĐƯỢC TOÀN QUYỀN bật Mute Tracks, bật Flow Mode để đàn bài rực rỡ và nộp điểm số đó về cho Teacher chấm thi. 
- Mọi tài sản nhạc PDF/Music XML cá nhân của User Free trong mục "My Library" vẫn bị Gating khóa ngoan ngoãn. Phải tốn tiền Upgrade mới được đập tung gông cùm.
