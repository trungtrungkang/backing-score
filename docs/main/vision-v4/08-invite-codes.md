# CHI TIẾT CÁCH LÀM: VÉ MỜI ĐỘC QUYỀN (ONE-TIME INVITE CODES)

Tài liệu này giải quyết bài toán "Pre-approved Tickets" (Vé mời phê duyệt trước) cho Classroom và Course. Đây là giải pháp bù đắp cho luồng "Waiting Room" (Phòng chờ) thông thường, giúp tiết kiệm thời gian Duyệt học sinh (Verify) cho Teacher, nhất là khi họ giao dịch qua các kênh ngoài luồng.

## 1. Bản Đồ 2 Nhánh Của Khung Nhập Mã (Dual-Path Join Input)

Trên giao diện Dashboard của Học Sinh chỉ tồn tại ĐÚNG MỘT Ô nhập ký tự duy nhất mang tên `<JoinCodeInput>`. Tuy nhiên, Hệ thống (Backend API) sẽ đánh giá chuỗi ký tự nhập vào để tung ra 2 ngã rẽ hoàn toàn khác biệt:

### Nhánh A: Mã Lớp Phổ Thông (Generic Class Code)
- **Đặc điểm:** Thường có 6-8 ký tự (VD: `PIANO101`). Khá dễ đoán và có thể được chia sẻ công khai lên Group Facebook/Zalo bởi học sinh trong lớp.
- **Hành vi:** Bất kì ai điền mã này đều gia nhập vào **Phòng Chờ (Waiting Room)** của Teacher với trạng thái `status: 'pending'`. 
- **Kết quả:** Phải đợi Teacher vào App bấm [Phê Duyệt] thì Học sinh mới xem được nội dung Khóa học/Lớp học.

### Nhánh B: Mã Mời Dùng 1 Lần (Single-use Invite Ticket)
- **Đặc điểm:** Thường dài và ngẫu nhiên (VD: `INV-X7K9-P2QW`). Đây là mã do Teacher đích thân chủ động "In (Generate)" ra từ Giao diện Quản Trị Lớp của họ.
- **Hành vi:** Khi Học sinh nhập mã này, Hệ thống ghi nhận đây là mã vé "Đã có Visa phê duyệt trước". Nó tự động chuyển cờ vé thành `Đã Sử Dụng` (Used) và cấp thẳng quyền truy cập `status: 'active'` cho Học Sinh vào Lớp/Khóa học.
- **Kết quả:** Học sinh lướt thẳng vào Lớp không cần thông qua Phòng Chờ. Mã này biến thành rác, không thể cho bạn bè mượn xài lần 2.

## 2. Hoạch Định Thêm Bảng Database Mới (The Invites Collection)

Để đáp ứng mô hình Nhánh B (Bypass Verification), Appwrite Backend buộc phải cưu mang thêm 1 Collection phụ mang tên `ClassroomInvites` (hoặc Cấu trúc tương tự đối với Courses).

### Schema (Cấu Trúc Tùy Chọn Đa Dạng):
- **`code`** (String): Mã vé độc quyền (`INV-A1B2-C3D4`).
- **`classroomId`** (String): Đích đến của cái vé này (Hoặc `courseId`).
- **`teacherId`** (String): Chữ ký của Teacher xuất vé.
- **`studentName`** (String, Tùy chọn): Tên của học viên mà Teacher điền rào trước (Ví dụ: "Bé Gấu nhà chị Lan"). Việc này giúp lúc Học Sinh đăng nhập lần đầu bằng Vé, Account tự động có tên mà không cần hỏi thêm.
- **`expiresAt`** (Datetime ISO, Tùy chọn): Hạn dùng của vé (Ví dụ: Vé tự hủy nếu quá 3 ngày không nhập).
- **`status`** (String): Trạng thái của vé hiện tại `['active', 'used', 'revoked']`.
- **`usedById`** (String, Tùy chọn): ID của tài khoản học sinh đã nuốt cái vé này.

## 3. Cách Vận Hành Của Teacher (Teacher UX Journey)

1. Teacher T tạo một Classroom mới. Hệ thống báo Nhánh A: Generic Code là `GUITAR24`. 
2. Teacher T vừa thu học phí của anh A qua chuyển khoản ngân hàng. Cô không muốn anh A tạo Account xong mòn mỏi ngồi đợi cô "Duyệt" (Rất cồng kềnh). 
3. Cô T bấm vào nút **[+ Create Invite Ticket]** trong Tab "Members" của Lớp. 
4. Hệ thống xuất ra Mã `INV-ABC-123`. Cô copy nhãn này paste vào khung Chat Zalo gửi cho anh A.
5. Anh A gõ nó vào `<JoinCodeInput>` của B&S. Bùm! Anh trở thành Member chính thức lập tức không phải chờ cô T thao tác lại.
6. Nếu có kẻ xấu dò được mã Zalo đó nhập muộn hơn, App sẽ báo lỗi "Invite ticket is expired or already collected". Rất an toàn và chặt chẽ.
