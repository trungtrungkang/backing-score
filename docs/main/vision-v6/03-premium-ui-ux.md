# Tầm Nhìn Nâng Cấp UI/UX Phòng Học Nhạc (Premium Music Classroom V6)

Tài liệu này lưu trữ các ý tưởng đột phá về UI/UX và các tính năng phục vụ giảng dạy tương tác nhằm biến phòng học WebRTC trở thành một studio chuyển nghiệp dành riêng cho âm nhạc.

## 1. Trải nghiệm Âm nhạc (Music-First Audio UX)
- **Original Sound / Music Mode**: Nút gạt hoặc cài đặt tự động vô hiệu hoá toàn bộ các bộ lọc Noise Suppression, Echo Cancellation và Auto Gain Control của hệ thống, giúp gửi trọn vẹn dải tần (dynamic range) âm thanh của các loại nhạc cụ (Piano, Guitar, v.v.).
- **Chỉ báo "Đang chơi đàn"**: Thay thế/Bổ sung cho "vòng sáng giọng nói" (Active Speaker ring) bằng cảnh báo trực quan riêng biệt khi phát hiện âm sắc hoặc tín hiệu đầu vào từ nhạc cụ điện tử (MIDI) hoặc audio mộc.

## 2. Bố cục Thông minh (Smart & Adaptive Layout)
- **Floating PiP (Picture-in-Picture)**: Ô hình Camera của Thầy/Trò không bị đóng khung chết trong hộp grid mà có thể nổi trên mặt bản nhạc nhạc (Draggable Widget), tự động lướt qua lại để không lấp mất các khuông nhạc (measures) đang phát.
- **Theater/Perform Mode**: Chế độ tự làm mờ/thu nhỏ bản nhạc, Zoom toàn màn hình người đang biểu diễn để khán giả tập trung vào ngón đàn và sắc thái âm nhạc.
- **Giao diện Glassmorphism**: Thanh điều khiển nổi nền kính mờ trên Dark Mode để không gây mất tập trung lên phổ nhạc sáng màu.

## 3. Công cụ Tương tác Sư phạm (Pedagogical Hand-ons)
- **Virtual Pointer (Con trỏ Đồng bộ)**: Một chấm sáng dạng laser cho phép Giáo viên lấy điểm neo (anchor) tại một dòng nhạc bất kì, đồng bộ toạ độ tuyệt đối sang mọi thiết bị học sinh bất chấp kích thước màn hình bị vỡ dòng.
- **Overlay Bàn phím Ảo (Keyboard/Fretboard)**: Bắt tín hiệu âm MIDI của thành viên và render trực tiếp thành hình ảnh hiển thị phím/hợp âm nhấn ở ngay dưới góc khung Webcam tương ứng của thành viên đó.

## 4. Quản lý Lớp học Chuyên Sâu (Control Center)
- **Remote Mute & Quản lý Phân Quyền**: Chặn các cá nhân phát ra tiếng ồn không mong muốn trong không gian phòng học lớn.
- **Force Sync View**: Nút ghi đè bắt buộc kéo màn hình, cuộn chuột và zoom mức của mọi sinh viên theo đúng khuôn nhìn của giáo viên để kiểm soát nhịp học.
- **HUD Cảnh Báo Sớm**: Thanh Header báo cáo vắn tắt theo thời gian thực: học sinh nào đang hụt nhịp liên tiếp, học sinh nào mất kết nối Internet.

## 5. Tương tác Cảm Xúc (Vibes & Micro-interactions)
- Chức năng thả Reaction (Tim, Vỗ Tay, Cổ Vũ) trong suốt buổi tập với hiệu ứng Particle Particle bùng nổ theo nhịp nhạc.
- Chế độ phần thưởng / Achievement popup nhỏ gọn bật lên khi sinh viên hoàn thành đúng một trổ nhạc phức tạp mà không sai sót.
