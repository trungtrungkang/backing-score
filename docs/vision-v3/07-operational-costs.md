# Hạch Toán Chi Phí Vận Hành (Operational Costs - OPEX)

Tài liệu này ước tính chi phí duy trì Nền tảng EdTech V3 hàng tháng, dựa trên kiến trúc Serverless (Next.js) và BaaS (Appwrite).

---

## 1. Bí Mật Của Lõi "Wait Mode" (Chi Phí Xử Lý Bằng 0)
Ở các nền tảng khác, việc chấm điểm âm thanh thường yêu cầu gửi tín hiệu Mic/Audio về Máy Chủ (Server) để chạy AI phân tích, tiêu tốn hàng ngàn USD tiền thuê siêu máy tính (GPU/CPU). 

**NHƯNG ĐỐI VỚI V3 CỦA CHÚNG TA:** Toàn bộ thuật toán YIN Pitchfinder (Xử lý Microphone) và Bắt nốt đàn (`WebMIDI`) chạy 100% trên **Trình duyệt của Học Sinh (Client-side)**. Máy tính/Điện thoại của Học sinh tự gánh toàn bộ sức mạnh xử lý âm thanh. 
**=> Chi phí CPU Server cho khâu chấm điểm: $0/tháng.**

## 2. Băng Thông & Lưu Trữ Bài Hát (Storage)
Một gánh nặng khác của EdTech là lưu Video bài giảng (rất nặng).
Trình soạn thảo Tiptap của chúng ta không xài Video. Nó chỉ lưu các dòng chữ (Dung lượng Byte) và nhúng thẻ `<SnippetPlayer>`.
- File `.musicxml`: Siêu nhẹ, chỉ vài chục Kilobyte (KB).
- File Backing Track (MP3): Nặng khoảng 2MB - 5MB/bài.
- **Giải Pháp Lưu Trữ:** Đẩy toàn bộ File lên **Cloudflare R2** thay vì Amazon S3. R2 tính phí lưu trữ cực rẻ ($0.015/GB) và quan trọng nhất là **Miễn phí hoàn toàn Phí Băng Thông Bắn Ra (Zero Egress Fee)**. Dù cho 10.000 học sinh bấm Play bài hát cùng lúc, bạn cũng không bị mất 1 xu tiền phí truyền tải dữ liệu.
**=> Chi phí Storage/Bandwidth: Giới hạn Free Tier, tối đa $5 - $10/tháng.**

## 3. Máy Chủ Dữ Liệu & API (Appwrite BaaS)
Appwrite gánh toàn bộ User Auth, Database (Posts, Lessons, Progress), Server Actions.
- **Dùng Appwrite Cloud (Pro)**: Giá cố định **$15/tháng** (Sức chứa 100,000 Users, cấu trúc JSON NoSQL siêu nhẹ).
- **Hoặc Tự Host (DigitalOcean VPS)**: Thuê một máy chủ Linux $20/tháng và cài Appwrite qua Docker. Bạn làm chủ hoàn toàn dữ liệu.
**=> Chi phí Database: ~$15 - $20/tháng.**

## 4. Hosting Giao Diện (Frontend Next.js)
Dựng Web App lên nền tảng **Vercel** hoặc **Cloudflare Pages**.
- Sử dụng gói Vercel Pro: **$20/tháng**. 
- Nếu dùng Cloudflare Pages: Hầu như **Miễn phí ($0)** cho Next.js App Router nếu ứng dụng gọi API sang Appwrite.
**=> Chi phí Web Hosting: $0 - $20/tháng.**

## 5. Cổng Thanh Toán (Payment Gateway)
Hệ thống sử dụng **Stripe** (hoặc nội địa như ZaloPay/Momo) để Thu tiền Subscription/Bán khóa lẻ của học viên.
- Không mất phí duy trì hàng tháng.
- Stripe chỉ cắn phần trăm hoa hồng trên giao dịch thành công (Khoảng **2.9% + $0.30** mỗi bill).
**=> Chỉ tốn phí khi có doanh thu thật.**

---

### TỔNG KẾT BẢNG CHI PHÍ ƯỚC TÍNH (Cho 5.000 Users Đầu Tiên)
1. Hosting Web: $0 - $20
2. Database (Appwrite): $15
3. Lưu trữ XML/MP3 (Cloudflare R2): Rơi vào mức Free Tier ($0).
4. Phí Âm thanh Core: $0 (Chạy trên máy User).

**=> TỔNG OPEX DUY TRÌ BỘ MÁY GIAI ĐOẠN ĐẦU CHỈ: $15 - $35/Tháng.** (Chưa tới 1 triệu VNĐ).
Mô hình này là một "Cỗ Máy In Tiền" vì Biên Lợi Nhuận (Profit Margin) cao khủng khiếp do bạn bán chất xám (Khóa học/Subscription) mà không tốn chi phí nguyên vật liệu và Vận chuyển Video hằng ngày!
