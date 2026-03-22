# EdTech & Gamification Best Practices
*Tài liệu hướng dẫn tổng quan về mô hình Công nghệ Giáo dục (EdTech) dành riêng cho ứng dụng Backing & Score, đối chiếu với các tiêu chuẩn ngành.*

---

## 1. Các Mô hình Học tập (Learning Models) trong EdTech
Trong thị trường EdTech hiện nay (vd: Duolingo, Yousician, Simply Piano), có 3 mô hình học tập cốt lõi. Hiểu rõ các mô hình này sẽ giúp bạn quyết định tính năng tiếp theo cho nền tảng.

### A. Strict Linear Progression (Tiến trình Tuyến tính Tuyệt đối)
- **Cơ chế:** Học viên bị khóa chặt trong 1 đường duy nhất. Phải hoàn thành Bài 1 mới được mở Bài 2 (như trò chơi vượt ải).
- **Trạng thái hiện tại của Backing & Score:** DỰA VÀO CƠ CHẾ NÀY. Code hiện tại ép học viên hoàn thành mọi `MusicSnippet` bằng *Wait Mode* (đạt 80 điểm) mới mở bài tiếp theo.
- **Ưu điểm:** Khởi đầu cực tốt cho người mới học (Beginners). Ép họ đi đúng rèn luyện kỹ năng âm nhạc từ cơ bản.
- **Nhược điểm:** Làm phiền người dùng đã có kỹ năng (Advanced Users). Họ muốn vào đánh nhanh bài khó nhưng bị khóa.

### B. Free-path / MOOCs (Tiến trình Tự do)
- **Cơ chế:** Khóa học vạch ra sẵn 100 bài, nhưng user thích nhấp vào bài nào học trước cũng được (như Udemy, Coursera).
- **Đề xuất:** Backing & Score đang thiếu tính năng biến Khóa học dạng *Linear* thành dạng *Free-path*. Ở DB `courses`, nên có thêm cờ `enforceSequential: boolean`. Giảng viên có quyền chọn khóa học này là "Lộ trình cày cuốc" (Linear) hay "Tuyển tập tự chọn" (Free-path).

### C. Adaptive Learning (Học tập Thích ứng / Vượt cấp)
- **Cơ chế:** App tự động nhận diện trình độ của học viên và bỏ qua (Skip) các bài quá dễ. 
- **Đề xuất nâng cấp:** Cho phép học viên làm một bài Test (Placement Test). Nếu gõ MIDI đúng 100%, hệ thống tự động lưu mảng `completedSnippets` cho 10 bài đầu tiên.

---

## 2. Các Mảnh ghép Gamification (Trò chơi hóa) còn thiếu
Hệ thống hiện tại đã làm rất tốt việc *Xác nhận hoàn thành, Thả pháo hoa, Khoe lên mạng xã hội*. Tuy nhiên, để giữ chân (Retention) học viên trong nhiều tháng, bạn cần thêm:

**1. Streak (Chuỗi Học Tập Liên Tục)**
- *Khái niệm:* Chữ "Lửa" đếm số ngày liên tục truy cập và tập đàn (như Duolingo).
- *Vì sao cần:* Người học nhạc rất dễ lười. Streak đánh vào tâm lý Sợ mất mát (ngại đứt chuỗi 30 ngày tập luyện).
- *Cách làm:* Bảng `Progress` ghi nhận thêm `lastPracticeDate`. Nếu ngày hôm sau có tập, +1.

**2. Leaderboard (Bảng Xếp Hạng)**
- *Khái niệm:* Thi đua điểm `waitModeScore` giữa các học viên học chung 1 khóa.
- *Vì sao cần:* Đánh vào tâm lý thích chinh phục và cạnh tranh.

**3. Badges / Achievements (Huy hiệu)**
- Tặng huy hiệu khi User đạt "10 ngày tập liên tục", "Chơi hoàn hảo không trượt nốt nào 5 bài", "Hát đúng cao độ (Mic) 10 bài".

---

## 3. Quản lý Hiệu suất (Analytics) cho Người Dạy (Creator)
Hiện tại nền tảng của bạn cực kỳ tập trung vào góc nhìn của Người Học (Learner). Việc thu hồi vốn và sinh lãi nằm ở Người Dạy (Creator). 

**Những tính năng EdTech dành cho Creator đang thiếu:**
- **Learner Drop-off Analytics (Đo lường điểm rơi rụng):** 
  - Thống kê tỷ lệ học viên kẹt lại ở bài học nào nhiều nhất. (Ví dụ: "70% user ngừng học ở Bài 5"). Điều này giúp Giáo viên biết Bài 5 quá khó để họ quay lại sửa bài giảng (edit contentRaw).
- **Time-spent Tracking:**
  - Đo xem học viên mất bao nhiêu phút mới vượt qua được Wait Mode của một bản nhạc. Nếu lâu quá = bản nhạc quá khó hoặc truyền đạt chưa tốt.

---

## XUYÊN SUỐT: ĐÁNH GIÁ TÌNH TRẠNG BACKING & SCORE HIỆN TẠI

**✅ Những gì Backing & Score đã làm đạt Chuẩn EdTech:**
- Tích hợp Tiptap Editor cho phép chèn Text / Video xen kẽ Khung Nhạc Tương Tác. (Đỉnh cao của đa phương tiện).
- Có công cụ đo **Real-time Input** qua Mic (Pitch) và MIDI keyboard. Rất ít startup về học thuật nào có ngay bộ engine này ở pha MVP.
- Cơ chế Lock/Unlock chặt chẽ dựa trên JWT Session (Appwrite), tránh hack qua UI.
- Hook Social Feed (chia sẻ tự động): Giúp Organic Growth cực mạnh.

**❌ Những gì cần lên kế hoạch sửa chữa/bổ sung trong Tương lai gần (Q2 - Q3):**
1. Nút "Chuyển chế độ Khóa Học" dành cho Creator (Linear vs Free).
2. Xây dựng Bảng Xếp Hạng Điểm chuyên cần (Streak System).
3. Công cụ thống kê (Analytics) cơ bản cho người tạo Khóa học. 
