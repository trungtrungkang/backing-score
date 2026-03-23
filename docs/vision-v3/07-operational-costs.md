# Ước Tính Chi Phí Vận Hành (Operational Costs - OPEX)

Tài liệu này cung cấp ước tính tham khảo về chi phí duy trì Nền tảng V3 hàng tháng, dựa trên kiến trúc Serverless (Next.js) và BaaS (Appwrite).

---

## 1. Chi Phí Xử Lý Wait Mode (Client-side Processing)
Phương pháp tiếp cận xử lý tín hiệu âm thanh truyền thống thường yêu cầu gửi dữ liệu về máy chủ, phát sinh chi phí hạ tầng lớn.
**Giải pháp của V3:** Các thuật toán YIN Pitchfinder (chiết xuất tần số âm thanh từ Microphone) và thu thập tín hiệu WebMIDI được thực thi hoàn toàn trên trình duyệt của người dùng (Client-side).
**=> Chi phí CPU Server cho xử lý tín hiệu: Tối giản, không đáng kể.**

## 2. Lưu Trữ và Băng Thông (Storage & Egress)
Quản lý khóa học thường tiêu tốn nhiều dung lượng nếu tập trung vào định dạng Video.
Hệ thống V3 tối ưu dung lượng bằng cách ưu tiên văn bản lý thuyết (Tiptap Editor) và công cụ nhúng nhạc `<SnippetPlayer>`.
- File `.musicxml`: Kích thước rất nhỏ (vài chục KB).
- File MP3 Backing Track: Cỡ trung bình (2MB - 5MB/bài).
- **Giải Pháp Lưu Trữ:** Hệ thống sử dụng Cloudflare R2 để lưu trữ tài nguyên đa phương tiện, tối ưu hóa mức giá tính theo dung lượng và không tính phí băng thông truyền tải ra ngoài (Egress Fee).
**=> Chi phí Storage/Bandwidth: Giới hạn trong mức cơ bản (Free Tier) hoặc ở mức thấp ($5 - $10/tháng).**

## 3. Quản Trị Cơ Sở Dữ Liệu (Appwrite BaaS)
Appwrite đảm nhiệm các chức năng quản lý người dùng (Auth), cơ sở dữ liệu (Posts, Lessons, Progress) và hệ thống Server Actions.
- **Tùy chọn Managed Cloud**: Gói cơ bản bắt đầu từ $15/tháng, đáp ứng tốt cấu trúc JSON NoSQL nhẹ.
- **Tùy chọn Tự Lưu Trữ (Self-hosting)**: Quản lý Appwrite trên VPS cá nhân (như DigitalOcean/AWS) với chi phí khởi điểm khoảng $20/tháng.
**=> Ước tính chi phí Database: ~$15 - $20/tháng.**

## 4. Hosting Frontend Vercel/Cloudflare
Nền tảng ứng dụng giao diện Next.js App Router.
- Có thể lưu trữ qua Vercel Pro (khoảng $20/tháng).
- Hoặc sử dụng cấu hình Cloudflare Pages với mức phí tối ưu.
**=> Ước tính chi phí Hosting: $0 - $20/tháng.**

## 5. Cổng Thanh Toán (Payment Gateway)
Hệ thống sử dụng Stripe (hoặc cổng thanh toán khu vực) để xử lý Subscription và bán lẻ.
- Dịch vụ không tính phí duy trì nền tảng hàng tháng, tính phí giao dịch trên mỗi hóa đơn thành công (VD: Stripe áp dụng mức phí 2.9% + $0.30/giao dịch).
**=> Phí giao dịch được khấu trừ trực tiếp theo doanh thu phát sinh.**

---

### TỔNG KẾT ƯỚC TÍNH CHI PHÍ CỐ ĐỊNH (Baseline OPEX)
*Dự kiến cho quy mô nhỏ/ MVP thử nghiệm:*
1. Web Hosting: $0 - $20
2. Cơ Sở Dữ Liệu (Appwrite): $15
3. Lưu trữ Media (Cloudflare R2): Mức phí rất thấp hoặc miễn phí.
4. Xử lý Âm Thanh (Engine): Client-side ($0).

**=> TỔNG CHI PHÍ VẬN HÀNH CỐ ĐỊNH (OPEX) HÀNG THÁNG: Xấp xỉ $15 - $35.**
Kiến trúc này giúp dự án khởi động với chi phí thấp trong giai đoạn MVP và dễ dàng mở rộng khi người dùng tăng lên, nhờ cơ chế tối ưu phân tán khả năng xử lý về phía Client.

