# UI / UX Flow (Trải nghiệm Người Dùng Tương Tác)

Tài liệu này bao quát 3 Luồng Hành trình Cốt lõi trên nền tảng: Người dùng Mạng xã hội (Cộng đồng), Người Học Khóa Học (Học viên) và Trải nghiệm Soạn bài (Creator Studio).

---

## 1. Trải Nghiệm Mạng Xã Hội (Community Dwell Flow)
Đây là quy trình tương tác của người dùng thông thường khi truy cập hệ thống:
1. **Scrolling Newsfeed**: Người dùng theo dõi trang `Feed` để xem các bài nhạc mới từ Creator.
2. **Interact (Socialize)**: Tương tác bằng các nút chức năng (Like/Favorite), lưu vào `Playlist` cá nhân, hoặc để lại bình luận.
3. **Immersive Practice**: Khi nhấn vào một bài hát (Project/Song), giao diện `PlayShell` full-screen mở ra kèm theo các thanh công cụ điều khiển (Playback Rate, Mixer). Người dùng có thể điều chỉnh và thực hành theo bản nhạc.

## 2. Trải Nghiệm Giáo Viên (Creator Studio Flow)
Quy trình dành cho giáo viên và người tạo nội dung để xây dựng tài liệu học tập. Giao diện soạn thảo sử dụng **Tiptap Editor**.
1. **Soạn thảo**: Giáo viên mở `Creator Dashboard` và sử dụng text editor để viết nội dung lý thuyết.
2. **Tích hợp Wait Mode**: Thông qua slash menu (`/`), giáo viên có thể chèn một bài tập Wait Mode trực tiếp vào bài giảng.
3. **Sử dụng Dữ liệu Sẵn có**: Hệ thống hiển thị kho `Project/Songs` mà Giáo viên từng đăng tải. Giáo viên chọn đoạn nhạc cụ thể để nhúng vào khóa học (ví dụ: cắt từ measure thư 15 đến 18).
4. **Trình bày**: Component `<SnippetPlayer>` sẽ được hiển thị giữa văn bản, đại diện cho bài thực hành. Giáo viên lưu và xuất bản bài giảng.

## 3. Trải nghiệm Học Viên (Learner Portal UX)
Quy trình trải nghiệm học tập có yếu tố tương tác.
1. **Truy cập**: Học viên vào khóa học. Danh sách bài giảng bên tay trái hiển thị trạng thái khóa/mở khóa.
2. **Học tập**: Học viên đọc phần lý thuyết cho đến khi gặp component `<SnippetPlayer>`.
3. **Thực Hành Thực Sự (Wait Mode Validation)**: Học viên cần hoàn thành bài tập Wait Mode. Khi bắt đầu, hệ thống thu âm thanh từ Microphone hoặc tín hiệu từ MIDI. Thanh nhịp điệu sẽ chờ đến khi học viên chơi đúng nốt.
4. **Phản hồi hệ thống**: Giao diện tô đậm các nốt đã chơi đúng.
5. **Hoàn thành bài giảng**: Khi đánh xong toàn bộ nốt yêu cầu, thuật toán chấm điểm sẽ ghi nhận hoàn thành. Giao diện hiển thị phản hồi trực quan.
6. **Mở khóa**: Bài học tiếp theo được mở khóa tự động (Server Action).
7. **Social Sharing**: (Tùy chọn) Thành tích hoàn thành khóa học có thể hiển thị dưới dạng hoạt động trên `Newsfeed`.

## 4. Kiến Trúc `<SnippetPlayer>`
Về khác biệt giao diện giữa học tập và trình diễn:
- Khác với giao diện `<PlayShell>` (dành cho chế độ thực hành tự do, chứa Mixer/Loop), `<SnippetPlayer>` được thiết kế tối giản, giới hạn kích thước vùng hiển thị (khoảng 800px).
- Loại bỏ các công cụ tùy biến sâu như Mixer hay Pitch Shifting để tập trung vào mục tiêu bài tập.
- Chỉ hiển thị: Sheet nhạc cơ bản, Nút Mở Nhạc, Thanh Tiến trình, và Tùy chỉnh đầu vào (Microphone/MIDI).
- Cấu trúc tĩnh và nhẹ, tối ưu hóa cho môi trường đọc lý thuyết.

