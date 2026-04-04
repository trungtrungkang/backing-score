# API Reference: 04. LMS & Classrooms Actions

## 1. Classrooms (`src/app/actions/v5/classrooms.ts`)

### `createClassroom`
- **Inputs**: `name: string`, `description?: string`
- **Outputs**: Trả về `ClassroomDocument` mới tạo.
- **Business Logic**: 
  - Khởi tạo `joinCode` ngẫu nhiên (6 ký tự alphanumeric) qua hàm thư viện Node crypto.
  - Setup bảng `classrooms`: `id`, `teacherId = session.user.id`.
  - Tự động insert 1 row vào bảng `classroom_members` cho chính Teacher với vai trò là `admin`.
- **Unit Test Scenarios**: 
  - [x] Tạo thành công và sinh mã 6 số chữ duy nhất.

### `joinClassroomV5`
- **Inputs**: `code: string` (Case-insensitive ngầm định qua UI).
- **Outputs**: `boolean` (Thành công / Xin lỗi không thấy mã lớp).
- **Business Logic**:
  - Gặp đúng Code của lớp -> Insert UserID hiện tại vào bảng `classroom_members` (Vai trò `student`).
  - Lặp mã -> Drizzle ném `Constraint_Unique` error do đã Join từ trước -> Action cần catch êm nhẹ.

## 2. Assignments & Feedback (`src/app/actions/v5/submission-feedback.ts`)

### `submitAssignment`
- **Inputs**: `assignmentId`, `fileId_url`, `comment?.string`
- **Outputs**: Return updated `SubmissionDocument`.

### `saveSubmissionFeedbackV5`
- **Inputs**: 
  - `submissionId`: Cần đánh dấu định vị điểm chấm.
  - `annotations`: Mảng JSON các điểm note tọa độ (X/Y axis của trang PDF/MusicXML).
  - `grade`: (Optional) Điểm 1-100.
- **Business Logic**:
  1. Chỉ Teacher của Lớp mới được lưu Feedback lên hệ thống. Sẽ có lệnh kiểm tra `SELECT 1 FROM classrooms c JOIN assignments a ON c.id=a.classroomId WHERE a.id = ? AND c.teacherId = ?`. Lệnh Authorization gắt gao.
  2. Format cục Annotations thành array string lưu vào bảng `submission_feedbacks`. Điểm (Grade) sẽ lưu thẳng lên bảng `submissions` (để List xem tổng quan hiển thị ngay).
- **Unit Test Scenarios**: 
  - [x] Unauthorized Exception nếu Học viên cố tình gửi POST sửa điểm của chính mình. (Khai thác lỗ hổng API giả).
  - [x] JSON Serialization Pass cho cấu trúc DOM annotation.
