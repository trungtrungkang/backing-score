# E2E Workflows: 21. LMS Classroom & Grading

Đây là luồng tổ hợp nghiệp vụ phức tạp nhất của dự án, nối liền quyền tác giả (Giáo viên) với không gian đệ trình (Học viên).

## 1. Flow: Tạo Lớp học & Đóng Gói Khóa Học (Teacher View)

### UI/UX Route: `/dashboard/classrooms`
1. Giáo viên nhấn "Tạo lớp học mới". Bật form Modal.
2. Điền tên lớp -> API POST `createClassroom`. API trả về ID và Mã vào lớp (`joinCode`).
3. App điều hướng `router.push('/dashboard/classrooms/[id]/manage')`.

### Giao diện Quản lý Lớp `/manage`
- Giáo viên có thể ấn tạo **"Assignment"** trực tiếp.
- Giao diện cung cấp Custom Editor (`RichTextEditor`) nhập đề bài. Cho phép bấm Select File từ R2 (dùng lại giao diện `/dashboard/pdfs`) gắn kèm làm giáo trình.
- Giáo viên thiết lập Deadline `dueDate` qua Input type Datetime-local.
- Hệ thống gửi ngầm Push Notification đến toàn bộ members (nếu lớp đang có người) là "Giáo viên vừa ra bài tập mới...".

---

## 2. Flow: Học viên tham gia & Nộp Bài (Student View)

### Nhập môn (`/classroom/join`)
1. Sinh viên vào đường link `/classroom/join/X3A2B`.
2. Server Component gọi hàm getLớp check xem `Code` còn valid không.
3. Client bắt sự kiện `onClick(Join)` -> Bắn Action `joinClassroomV5(X3A2B)`. Xử lý Optimistic Toast "Bạn Đã Vào Lớp Thành Công".

### Thực thi Bài Tập (`/classroom/[id]/assignment/[aid]`)
Đây là giao diện tương đương `/p/[projectId]` nhưng có thanh Upload bài nộp ở chế độ cố định màn hình góc phải.
- Học viên thấy màn hình đọc (Read-only) bản nhạc giáo viên gửi để nghiên cứu.
- Học viên mở một Tab khác hoặc sử dụng Cụm nút "Copy bài giáo viên làm bản nháp" (Action cấp tốc phân nhánh - Fork Project).
- Sau khi hoàn chỉnh, học viên ấn Submit. Mở Form chọn File từ PC hoặc chọn Project Cloud có sẵn (Gửi Object Reference gốc). POST `submitAssignment`.

---

## 3. Flow: Chấm Bài & Trả Feedback (Grading)

1. Giáo viên vào Lớp -> Bục "Báo Cáo Nộp Bài". Màn hình hiển thị Bảng `table` List danh sách submission dựa theo truy vấn SQL Drizzle lấy danh sách members INNER JOIN Submissions. Left Join để trơ ra những đứa chưa nộp.
2. Bấm vào bài `submissionId` của bạn Sinh viên A.
3. Giao diện mở trình Player: Ở đây Player kích hoạt chế độ **Annotation Mode**.
   - Chuột Giáo viên trở thành công cụ Highlight. Bôi đen lên khu vực nốt đánh sai.
   - Hiện Formik nhập bình luận -> Gói vào Array JSON `annotations`.
   - Ấn Submit Grade 80/100 -> Gửi action `saveSubmissionFeedbackV5()`.

#### E2E Testing Scenarios (Sử dụng Cypress/Playwright)
- [x] Test luồng Authorization Chéo: Dùng tài khoản Sinh viên C truy cập trực tiếp Link `/classroom/[id]/assignment/[aid]/grade` của Sinh viên A. Kết quả Server Action bắt buộc đá văng (Redirect Return 403 Forbidden) không cho sinh viên chấm bài bạn.
- [x] Workflow Timeout Submission: Chỉnh Mock hàm Server thời gian Deadline là Ngày X. Nộp bài Ngày X+1. Hệ thống tự gán cờ `Late (Nộp Muộn)` trên giao diện.
