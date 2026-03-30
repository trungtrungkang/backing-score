# Hệ Thống Gamification & Cơ Chế Tính Điểm Thưởng (XP System)

Tài liệu này dùng để làm cẩm nang hướng dẫn/training cho hệ thống Khen thưởng, Kinh nghiệm (XP), và Cấp độ (Level) trên nền tảng Backing & Score. 

Tất cả các thông số này được lưu trữ ẩn dưới cơ sở dữ liệu (Bảng `platform_config`) để đảm bảo không bị hack và cho phép Admin điều chỉnh linh hoạt mà không cần phải cập nhật code.

## 1. Cơ Chế Nhận Điểm Kinh Nghiệm (XP) Cơ Bản
Người dùng sẽ nhận được điểm XP thông qua việc **mở và nghe/học** các bài hát trong thư viện (hoặc làm bài tập Classroom rèn luyện âm nhạc). Điểm được tính toán cực kì bảo mật ở trên máy chủ (Backend):

* **Thời lượng tối thiểu (Chống Spam):** Người dùng phải Play bài hát liên tục ít nhất **10 giây** mới được tính là "Có Luyện Tập". Dưới 10 giây hệ thống sẽ loại bỏ không cộng điểm.
* **Hệ số cộng giờ (XP Per Minute):** Mặc định Admin cấu hình là `2 XP` cho mỗi 60 giây luyện tập. (Ví dụ: Chơi đàn 5 phút 30 giây ròng rã sẽ nhận được: `5.5 * 2 = 11 XP`).
* **Hoàn thành bài hát (Song Complete Bonus):** Nếu người chơi nghe trọn vẹn bản nhạc từ đầu đến cuối mà không tắt dở chừng, họ sẽ được tặng thêm `+10 XP` cho sự kiên nhẫn.

## 2. Tiền Thưởng Nâng Cao (Wait Mode - Thực Hành Chuẩn Xác)
Tính năng **Wait Mode** yêu cầu người chơi sử dụng Micro hoặc đàn MIDI để đánh đúng cao độ nốt nhạc. Đây là môi trường rèn luyện khắt khe nên XP được nhân lên rất lớn:
* Nếu hoàn thành Wait Mode trọn vẹn bài với độ chính xác **trên 80%**: Nhận thưởng nóng `+25 XP`.
* Nếu rèn luyện hoàn hảo (Perfect **100%**) không sai một nốt: Nhận thưởng nóng `+50 XP`. 

*(Lưu ý: Số điểm thưởng này được Tự Động cộng dồn cùng với Hệ số XP tính theo thời gian ở Mục 1)*.

## 3. Thử Thách Nhiệm Vụ Hàng Ngày (Daily Challenge)
Mỗi ngày vào đúng nửa đêm, hệ thống sẽ bốc thăm (Pseudo-random Hash) một bản nhạc ngẫu nhiên trong Kho Nhạc Công Khai để làm **Nhiệm vụ Hàng Ngày**.
* Bản nhạc này sẽ được ghim nổi lấp lánh (Premium gradient card) lên trang chủ `/dashboard`.
* **Cơ chế chống gian lận (Anti-Cheat):** Để nhận được `+30 Bonus XP` ưu đãi của giải đấu này, người dùng KHÔNG THỂ spam mở bài hát 10 giây rồi tắt. Họ bắt buộc phải:
   - Luyện tập bản nhạc này liên tục **ít nhất 1 phút** ở chế độ nghe/Play bình thường.
   - HOẶC luyện tập **Wait Mode** và đạt số điểm chấm thi **trên 80%**.

## 4. Hành Trình Thắp Lửa (Streak) & Pháo Hoa Ăn Mừng
* **Chuỗi ngày luyện tập (Streak):** Nếu người dùng chơi đàn liên tục hằng ngày, biểu tượng "Ngọn lửa" 🔥 trên hệ thống sẽ được cộng dồn (Ví dụ: 3 ngày liên tiếp). Tuy nhiên, nếu họ bỏ lỡ 1 ngày, ngọn lửa này sẽ bị dập tắt trở về số 0. Đây là tính năng áp lực "FOMO" ép người dùng quay lại nền tảng mỗi ngày.
* **Multiplier:** Nếu ngọn lửa Streak đạt các mốc (VD: chuỗi 5 ngày, 7 ngày), Admin có thể kích hoạt cơ chế `StreakMultiplier` x2, x3 số điểm họ nhận được sau này.
* **Pháo hoa Ăn Mừng:** Khi người dùng dừng hoặc quay lại Dashboard, hệ thống rải hoa (Confetti) tràn ngập màn hình kèm con số `+42 XP Earned!`, vượt qua rào cản Fullscreen của trình duyệt để mang lại sự hưng phấn tột độ.

## 5. Thang Điểm Chuyển Cấp (Level Thresholds)
Kinh nghiệm (XP) sẽ được tích lũy từ ngày này qua tháng nọ thành **Total XP** và quy đổi tự động ra Cấp Độ (**Level**).  
Thang điểm hiện tại đang được cấu hình:
- **Level 1:** Sơ khởi (0 XP)
- **Level 2:** 100 XP
- **Level 3:** 500 XP
- **Level 4:** 2,000 XP
- **Level 5:** 5,000 XP
- **Level 6:** 15,000 XP
- **Level 7 (Master):** 50,000 XP

Mỗi khi người dùng lên cấp, biểu tượng Vòng Tròn tại trang Dashboard sẽ đổi màu sắc hào quang (GamificationBadge UI) sang những tông màu Premium khác nhau.
