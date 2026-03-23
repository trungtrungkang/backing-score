# UI / UX - Tích hợp EdTech (Academy)
Tài liệu này mô tả sơ đồ điều hướng và thiết kế giao diện cho phân hệ Học Viện (Academy) trên nền tảng.

---

## 1. SƠ ĐỒ THANH ĐIỀU HƯỚNG (Main Navigation)
Bổ sung chuyên mục "Học Viện / Academy" vào thanh điều hướng chính của hệ thống.

```text
[ Logo Backing & Score ] 
  ├── Khám Phá (Community/Home)
  ├── Bảng Tin (Feed)
  ├── Bộ Sưu Tập (Collection)
  │
  ├── 🟢 Học Viện (Academy) -> Phân hệ mới
  │
  └── [ Avatar User ] (Menu: Profile, Dashboard)
```

## 2. BỐ CỤC GIAO DIỆN (UI WIREFRAMES)
Giao diện Học Viện (Learner Portal) sẽ áp dụng bố cục chia cột (split-view) để tối ưu việc đọc lý thuyết kết hợp thực hành, tương tự các nền tảng LMS hiện hành.

### Bản vẽ Màn hình BÀI HỌC (The Learner Portal UX):
Truy cập: `/academy/[courseId]/[lessonId]`

```text
================================================================================
  [< Khóa học]                                  [ Tiến độ khóa học: 30% |||||-- ]
--------------------------------------------------------------------------------
 [ CỘT TRÁI - 30% WIDTH ]     |  [ CỘT PHẢI - 70% WIDTH (CONTENT) ]             
 CHƯƠNG 1: LÀM QUEN PIANO     |  
                              |  # Bài 2: Nhịp 4/4 và Nốt Đen
 🟢 Bài 1: Nốt nhạc cơ bản    |  
                              |  Nội dung lý thuyết (văn bản)...
 👉 Bài 2: Nhịp 4/4 (Đang học)|  
 🔒 Bài 3: Phím đen, phím...  |  Đoạn nhạc thực hành:
                              |  
 CHƯƠNG 2: THỰC HÀNH          |  +-------------------------------------------+
 🔒 Bài 1: Fur Elise          |  | [▶ Play]  [🎙️ Mic]  [🎹 MIDI]        [0:00]  | <- SNIPPET
 🔒 Bài 2: Canon in D         |  | ========================================= |  PLAYER
                              |  | (Bản nhạc tiêu chuẩn, tự động bôi màu)    |
 [ Thông tin gói cước ]       |  | ========================================= |
                              |  |       [ BẬT CHẾ ĐỘ WAIT MODE ]            |
                              |  +-------------------------------------------+
                              |  
                              |  Phần tiếp tục lý thuyết...
================================================================================
```

### Phân Tích Component `<SnippetPlayer>`:
1. **Mục tiêu**: Hỗ trợ người dùng tập trung hoàn thành một đoạn thực hành ngắn ngay trong quá trình đọc lý thuyết.
2. **Thiết kế Tối giản**: Lược bỏ các thanh công cụ mở rộng (Mixer, Toolbar, Tempo Slider) chỉ hiển thị Sheet nhạc và Nút chọn Audio Input để bảo đảm hiệu năng hiển thị.
3. **Mở khóa Tiến trình**: Khi người dùng chơi đúng đoạn nhạc yêu cầu (điểm tối đa), hệ thống (thông qua Server Actions) sẽ ghi nhận hoàn thành và tự động mở khóa bài học tiếp theo trên thanh điều hướng bên trái.

---

## 3. BỐ CỤC DASBOARD (DÀNH CHO CREATOR)
Thêm chức năng tạo khóa học cho nhóm người dùng cấp quản lý/Creator.

Truy cập: `/dashboard/courses/creator`
```text
================================================================================
 [ Avatar ] CREATOR STUDIO
--------------------------------------------------------------------------------
 [ Menu Cột Trái ]     |  [ TIPTAP EDITOR (VIẾT TEXT) ]           
 📂 Quản lý Projects   |  
 🎵 Quản lý Playlists  |  => Soạn Bài 2: Nhịp 4/4
 📚 Quản lý Khóa Học   |  
                       |  Nội dung văn bản...
                       |  
                       |  +-------------------------------------------------+
                       |  | [ INSERT MUSIC SNIPPET / WAIT MODE ]            |  <- TIPTAP
                       |  | └ Chọn Project: "Bản Phác Thảo C" + Measure 4-8 |  TOOL
                       |  +-------------------------------------------------+
                       |
                       |  [ Lưu Bài Giảng ]
================================================================================
```

Giao diện nhắm đến việc phân loại rõ ràng: Khu vực Thực hành tự do (PlayShell) tập trung vào công cụ nâng cao, và Khu vực Học Thuật (SnippetPlayer) tập trung vào bài tập có định hướng.