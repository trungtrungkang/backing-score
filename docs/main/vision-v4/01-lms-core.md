# CHI TIẾT CÁCH LÀM: HỆ THỐNG QUẢN TRỊ HỌC THUẬT (LMS CORE)

Tài liệu này hướng dẫn chi tiết cách thức xây dựng (Implementation) mạng lưới "Khóa Học Private" và "Lớp Học Kín", theo mô hình B2B2C độc quyền của Backing & Score.

## 1. Mục Tiêu Lõi (Business Goal)
- Chuyển Website từ "Sàn Khóa Học Mở" thành "Công Cụ Quản Lý Lớp Học Khép Kín". Không cho khách vãng lai tự tiện tải tài liệu hay mua khóa học tự động.
- Cho phép Teacher tự tạo Lớp (Classrooms), cấp **Mã Tham Gia (Join Code)**. Học viên nhập mã -> Bị chặn lại ở **Hàng Đợi (Waiting Room)** chờ Giáo viên tự thu học phí bên ngoài rồi mới bấm Duyệt.

## 2. Thay Đổi Cơ Sở Dữ Liệu (Appwrite Mappings)

### Cập nhật Dữ liệu Course (Master)
- **Hành Động:** Dứt điểm xóa bỏ `priceCents`. 
- **Bổ Sung:** Thêm `courseCode: string` (Mã Join dành cho mô hình tự học không cần tương tác lớp). Thêm trường `visibility: 'public' | 'private'`.

### Cập nhật Dữ liệu Classroom (Instance)
- **Hành Động:** Thiết kế liên kết Thừa kế (Inheritance).
- **Bổ Sung:** Thêm trường `courseId?: string` (Reference) vào `ClassroomDocument`. Một lớp học thực hành có thể *đính kèm* toàn bộ giáo trình của 1 Khóa. Nếu có, học viên trong Lớp hiển nhiên truy cập được mọi PDF/XML nằm trong Course gốc đó.
- **Bổ Sung:** `classCode: string` (Mã join 6 chữ số sinh ngẫu nhiên). Thêm `status: 'active' | 'archived'`.

### Hệ thống Thành Viên (`ClassroomMemberDocument` & `EnrollmentDoc`)
- **Hành Động:** Thay đổi định nghĩa của trường `status`. Hiện tại schema là `active` | `removed`. Bắt buộc chèn thêm trạng thái chuẩn bị ban đầu: **`pending`**.

## 3. Bản Đồ Thực Thi (Execution Map)

### A. Luồng Học Viên Chui Qua "Khe Cửa Ải"
1. **Giao Diện Input Code:** Tại màn hình chính (Dashboard page), đập bỏ thư viện bán Course kiểu Udemy. Thay thế bằng 1 Form Center: `<JoinCodeInput />`.
2. **API Handler (`/api/lms/join` - Xử Lý Chẽ Nhánh Đa Nguồn)**:
   - Khi Submit mã ký tự, Backend Appwrite quét ngẫu nghiên trong DB bảng `Classrooms.classCode` VÀ `Courses.courseCode` HOẶC bảng `ClassroomInvites.code`.
   - **Nhánh Waiting Room (Tìm thấy ClassCode chung):** Gọi hàm `Databases.createDocument` nhét record vào bảng `ClassroomMemberDocument` (hoặc `Enrollment`) với giá trị `status: "pending"`. Frontend văng Alert: *"Vui lòng đợi Giáo viên phê duyệt!"*.
   - **Nhánh Bypass (Tìm thấy InviteCode 1 lần):** Ghi đè `status: "active"` đẩy thẳng học sinh vào lớp. Hủy vé Invite cũ cắm cờ `used`. Frontend văng Alert: *"Chào mừng bạn đến với Lớp học!"*.

### B. Luồng Giáo Viên Phê Duyệt (Waiting Room Hub)
1. **Giao Diện Studio:** Xây dựng màn hình Teacher Studio. Ở Navbar có Notification hoặc Tab nhãn "Request Lớp Học".
2. **Query Danh Sách Đợi:** 
   - Lấy toàn bộ `ClassroomMemberDocument` thỏa 2 điều kiện: `classroomId` phải trùng khớp với những id lớp mà Teacher ID đang đứng tên tạo, VÀ `status === "pending"`.
3. **Phê Duyệt (Approve/Decline):** 
   - Code giao diện Render danh sách này thành các thẻ Card với nút Xanh (Duyệt), Đỏ (Xóa). 
   - Nút Xanh gọi API `updateDocument` sửa `status: "active"`. 
   - Học viên khi Refresh app mới nhìn thấy Lớp/Khóa hiển thị trong danh sách "Khoá học của tôi".

## 4. Tương Tác Sân Chơi (Flow Nộp Bài - Mở Rộng)
- Vì mọi thứ bây giờ là Private, các `AssignmentDocument` mà Giáo viên tạo ra từ Lớp này CHỈ TỔN TẠI trong bảng Timeline của học sinh thuộc Lớp đó.
- B&S sẽ theo đuổi chiến lược Gamification Chống Gian Lận (có Penalty Micloop). Khi Học sinh chơi màn hình Flow Mode của bài tập, kết quả `baseXP` (đã phạt điểm hụt) sẽ gọi POST push thẳng vào `SubmissionDocument` liên kết với Lớp (thay vì văng bảng vàng toàn cầu như trước). Thầy ngồi xem bảng Real-time trong Admin là thấy cả Lớp đang đàn điểm cao thấp ra sao.
