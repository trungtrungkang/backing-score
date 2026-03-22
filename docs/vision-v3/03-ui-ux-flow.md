# UI / UX Flow (Trải nghiệm Người Dùng Tương Tác)

Tài liệu này bao quát 3 Luồng Hành trình Cốt lõi trên nền tảng: Người dùng Mạng xã hội (Cộng đồng), Người Học Khóa Học (Học viên) và Trải nghiệm Soạn bài (Creator Studio).

---

## 1. Trải Nghiệm Mạng Xã Hội (Community Dwell Flow)
Đây là thói quen truy cập hàng ngày của mọi người dùng thông thường khi đăng nhập vào hệ thống:
1. **Scrolling Newsfeed**: Người dùng cuộn trang `Feed`. Thấy bài tập Nhạc của Thầy giáo (Creator).
2. **Interact (Socialize)**: Nhấn nút Trái Tim (Like/Favorite), Bấm lưu vào "Album Tuyển Tập Mùa Thu" (`Playlist` Menu). Để lại Comment khen ngợi.
3. **Immersive Practice**: Người dùng nhấn vào Bài hát (Project/Song). Trình duyệt tự động bung Chế độ Full-Screen `<PlayShell>`. Giao diện có thanh Trượt Tốc độ (Playback Rate), Giao diện Mixer (tắt tiếng đàn Piano). Người dùng luyện tập tẹt ga và không tốn phí.

## 2. Trải Nghiệm Giáo Viên (Creator Studio Flow)
Đóng vai trò cực kỳ quan trọng trong việc thu hút giáo viên chuyển hộ khẩu từ Youtube sang nền tảng V3.
Giao diện gõ chữ được tối giản bằng một **Tiptap Editor**.
1. Giáo viên mở `Creator Dashboard`. Viết Text Lý thuyết như viết vào Word.
2. Gõ `/` (Slash Command) -> Thanh menu Tiptap xổ ra: Nhấp chọn mục **`[Thêm Bài Thực Hành Wait Mode]`**.
3. **Tái sử dụng Dữ Liệu Cộng Đồng**: Thay vì phải Upload lại từ đầu, một Pop-up hiện ra hiển thị kho `Project/Songs` mà Giáo viên đó từng đăng lên mạng xã hội. Giáo viên nhấp chuột chọn Bài Hát.
4. Giao diện xuất hiện thẻ Option Cắt ngắn: Cài đặt cho màn hình bắt đầu ở Measure thứ `15` và kết thúc ở Measure thứ `18`. 
5. Ngay trong Editor xuất hiện một khối `<SnippetPlayer>` cực xịn báo chứa bài chờ. Giáo viên Ấn Save và Xuất Bản.

## 3. Trải nghiệm Học Viên Cày Khóa Học (Learner Portal UX)
Trải nghiệm học không còn đơn thuần là đọc 1 cuốn sách Lý thuyết tẻ nhạt. Mà nó hòa quyện một cảm giác đang được "Giám thị" kiểm tra (Gamification).
1. Truy cập vào Khóa học. Cột Trái là List bài giảng bị **Khóa ổ khóa màu xám (Locked)**. Duy nhất Bài 1 sáng đèn.
2. Đọc văn bản: *“Quy tắc bấm Gam Đô Trưởng nốt Đen...”*. Lướt xuống, gặp Component `<SnippetPlayer>` vuông vức chễm chệ ngay giữa hai dòng chữ văn bản.
3. **Thực Hành Thực Sự (Wait Mode Validation)**: Học sinh không thể lướt qua. Nhấn Nút Play. Thanh nốt nhạc đứng im chờ Học sinh lấy Microphone/Piano MIDI ra thổi/đàn vào 3 nốt.
4. Giao diện Đồ họa bôi màu Cam đúng 3 nốt đó. Học sinh đàn xong.
5. Ngay ô cuối cùng, Thuật toán chấm điểm hoàn thành. Một loạt Icon `🎉 Pháo bông (Confetti)` nổ tóe loe trên màn hình để ăn mừng.
6. Cột Slidebar bên tay trái rung lắc mạnh. *“Ting Ting! Bài 2 đã được Mở Khóa!”* (Nhờ Next.js Server Action ghi nhận bảo mật ẩn danh).
7. Hệ thống bắn thông báo lên `Newsfeed` mạng xã hội cho mọi người cùng chiêm ngưỡng!

## 4. Kiến Trúc Khối Nút Kẹp `<SnippetPlayer>`
Để giao diện Đọc Thử/Học Thử được Focus tuyệt đối:
- Khác với giao diện `<PlayShell>` choán cả màn hình có đủ loại Mixer. Component thẻ Bài Học sẽ bị bóp hẹp trong một Box `800px` đổ lại.
- Xóa bỏ Mixer, Xóa bỏ A-B Looping, Xóa bỏ Pitch Shifting phức tạp.
- Chỉ hiện Tờ nhạc, 1 Icon mũi tên Trắng Mở Nhạc, 1 Thanh tiến trình (Progress Bar), và Nút Icon chuyển qua lại giữa `🎙️ Microphone` và `🎹 MIDI Cáp`.
- Tinh gọn và Sạch Sẽ tới mức tối đa!
