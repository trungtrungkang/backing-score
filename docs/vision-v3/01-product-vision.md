# Tài Liệu Tầm Nhìn Sản Phẩm V3 (Product Vision)

**Định hướng Sản phẩm:** Nền tảng học và thực hành âm nhạc tương tác kết hợp tính năng mạng xã hội.

---

## 1. Định hướng Cốt lõi (Core Identity)
- Phiên bản V3 kết hợp nền tảng chia sẻ âm nhạc hiện tại với hệ thống quản lý khóa học (LMS).
- Nền tảng không chỉ lưu trữ sheet nhạc mà còn có tính năng **Newsfeed**: Cập nhật bài nhạc và khóa học mới, cho phép người dùng tương tác cơ bản (Like, Comment, Favorite).
- Tích hợp thêm các **Khóa học tương tác** (Interactive Modules). Thay vì chỉ đọc sheet nhạc, hệ thống yêu cầu học viên thực hành qua Microphone hoặc kết nối MIDI, sử dụng tính năng Wait Mode để xác nhận độ chính xác của nốt nhạc.

## 2. Mô hình Hệ sinh thái Kép

### Cột trụ 1: Nền tảng Chia sẻ Âm nhạc (Community Feed & Playlists)
- Không gian để người dùng khám phá và thực hành các bài nhạc hàng ngày.
- **Newsfeed & Interactions**: Hiển thị các bài nhạc (Projects) được tải lên. Người dùng có thể lướt xem, thả tim (Favorite) và bình luận.
- **My Collections (Danh sách phát)**: Hỗ trợ gom nhóm các bài nhạc thành Playlists để tiện việc luyện tập lặp lại (A-B Looping, Pitch Shifting).
- **Kiểm soát Chất lượng**: Hiện tại, chỉ có Creator hoặc Admin mới được tải bài gốc lên hệ thống để đảm bảo chất lượng file nhạc và sheet nhạc.

### Cột trụ 2: Hệ thống Khóa học (Interactive EdTech)
- Hệ sinh thái học tập. Các Creator (giáo viên, nhạc sĩ) đóng vai trò soạn thảo nội dung bài học.
- **Mô hình cung cấp**: Khóa học có thể được bán lẻ hoặc truy cập qua gói đăng ký (Subscription). Người dùng mua gói đăng ký sẽ được mở khóa các tài liệu học tập đang có trên nền tảng.
- **Công cụ soạn thảo**: Cung cấp công cụ Tiptap Editor để Creator viết lý thuyết và chèn đoạn nhạc (Snippet) trực tiếp từ thư viện vào bài học.
- **Wait Mode (SnippetPlayer)**: Đoạn nhạc được nhúng trong bài học sẽ yêu cầu học viên chơi đúng nốt qua Audio/MIDI để có thể tiếp tục.

## 3. Luồng Tương tác Người dùng (User Flow)
1. **Khám phá**: Creator đăng tải bài nhạc (Song/Project) lên mục Khám phá. Người dùng trải nghiệm tính năng play-along và lưu vào Playlist.
2. **Giáo dục**: Creator giới thiệu các khóa học liên quan đến các kỹ năng hoặc bài nhạc đã đăng. Người dùng quan tâm có thể đăng ký khóa học.
3. **Thực hành**: Học viên thực hành các bài tập trong khóa học thông qua giao diện tương tác (Wait Mode).
4. **Chia sẻ**: Hoàn thành khóa học có thể hiển thị như một cập nhật trên Newsfeed, giúp người dùng khác biết đến tính năng giáo dục của nền tảng.

