# 📖 Hướng dẫn sử dụng Backing & Score

---

## Mục lục

| | Dành cho |
|---|---|
| [Phần I: Người dùng thường](#phần-i-người-dùng-thường) | Tất cả người dùng |
| [Phần II: Creator — Người tạo nội dung](#phần-ii-creator--người-tạo-nội-dung) | Tài khoản Creator |

---

# Phần I: Người dùng thường

## 1. Trang Khám phá (Discover)

Đây là trang chính để tìm kiếm và nghe nhạc.

### Cách sử dụng
- **Tìm kiếm**: Nhập tên bài hát, tác giả, hoặc thể loại vào ô tìm kiếm
- **Lọc**: Sử dụng nút **Filters** để lọc theo thể loại (Piano, Guitar, v.v.)
- **Bộ sưu tập nổi bật**: Kéo xuống để xem các Collection được curator chọn lọc
- **Bấm vào bài hát**: Chuyển sang trang chi tiết bài hát

### Yêu thích / Bỏ yêu thích
- Bấm nút **♡ (Heart)** trên bài hát bất kỳ để thêm vào danh sách Favorites
- Xem danh sách yêu thích tại **Dashboard → Favorites**

---

## 2. Chế độ Play (Play Mode)

Khi bấm vào một bài hát, bạn vào **Play Mode** — nơi bạn có thể nghe và luyện tập theo.

### Giao diện chính

```
┌─────────────────────────────────────────┐
│  [Transport Bar] ▶ ⏸ ⏹  BPM: 120  ...  │
├─────────────────────────────────────────┤
│                                         │
│         [Sheet Music - Khuông nhạc]     │
│              (scroll được)              │
│                                         │
├─────────────────────────────────────────┤
│  [Track List] Drums ■■■ Guitar ■■■ ...  │
└─────────────────────────────────────────┘
```

### Điều khiển cơ bản

| Phím / Nút | Chức năng |
|---|---|
| **Space** | Play / Pause |
| **▶ Play** | Phát nhạc |
| **⏸ Pause** | Tạm dừng |
| **⏹ Stop** | Dừng và về đầu bài |
| **Bấm vào ô nhịp** | Seek đến ô nhịp đó |

### Điều chỉnh tốc độ
- Trong Transport Bar, có nút hiển thị tốc độ (**1x**, **0.75x**, **0.5x**...)
- Nhạc sẽ chậm/nhanh hơn **mà không thay đổi tông** (nhờ Time-stretching)

### Điều chỉnh tông (Pitch Shift)
- Tại Track List, có slider điều chỉnh **transpose** (±12 semitones)
- Hữu ích nếu giọng nhạc cụ của bạn khác với bài hát gốc

### Mixer — Tắt/bật từng nhạc cụ
Ở **Track List** phía dưới màn hình, mỗi hàng là một track nhạc cụ riêng biệt:
- **🔇 Mute**: Tắt tiếng một track (ví dụ tắt Piano để tự mình chơi)
- **S Solo**: Chỉ nghe duy nhất track đó
- **Slider Volume**: Điều chỉnh âm lượng từng nhạc cụ
- **< | >**: Điều chỉnh Pan (trái/phải trong stereo)

---

## 3. Wait Mode — Luyện tập tương tác

**Wait Mode** là tính năng đặc trưng nhất của Backing & Score: nhạc sẽ **tự động dừng** tại mỗi nốt và **chờ bạn chơi đúng** trước khi tiếp tục.

### Kích hoạt Wait Mode
- Tìm nút **Wait Mode** trên Transport Bar → bật lên

### Cách hoạt động
1. Nhạc phát bình thường
2. Khi đến nốt cần luyện → nhạc **PAUSE**
3. Nốt cần chơi hiển thị màu **đỏ** trên khuông nhạc
4. Bạn chơi nốt đó trên nhạc cụ thật (kết nối qua Microphone hoặc MIDI)
5. Hệ thống nhận diện âm thanh → nếu **đúng** → nốt chuyển **xanh** → nhạc tiếp tục
6. Lặp lại cho đến hết bài

> [!NOTE]
> Cần cho phép trình duyệt truy cập **Microphone** để Wait Mode hoạt động với nhạc cụ acoustic. Với đàn điện tử, hãy kết nối qua MIDI.

---

## 4. Bộ sưu tập (Collections)

Collections là các playlist nhạc được tổ chức theo chủ đề (ví dụ: "Nhạc jazz piano", "Bài tập cho người mới").

### Xem collection
1. Trên trang Discover → cuộn xuống phần **Featured Collections**
2. Bấm **See All** để xem tất cả
3. Bấm vào một collection để xem danh sách bài hát bên trong

### Trang chi tiết Collection
- Phần bên trên: Ảnh bìa + tên + thông tin tác giả + số bài
- Phần bên dưới: Danh sách bài hát, bấm vào để nghe ngay
- Nút **▶ Phát tất cả**: Phát toàn bộ bài trong collection
- Nút **♡ Like**: Thả tim collection
- Nút **Share**: Chia sẻ lên Feed

---

## 5. Dashboard cá nhân

Truy cập từ menu **Dashboard** sau khi đăng nhập.

### Các mục trong sidebar

| Mục | Nội dung |
|---|---|
| **My Uploads** | Danh sách project bạn đã upload (Creator) |
| **Collections** | Bộ sưu tập bạn đã tạo hoặc đang quản lý |
| **Favorites** | Các bài hát bạn đã yêu thích |
| **Creator Courses** | Khóa học bạn đang tạo (Creator) |
| **User Guide** | Tài liệu hướng dẫn |

### Xem danh sách bài đã upload (với Creator)
- Mỗi hàng hiển thị: Thumbnail, Tên bài, Tác giả, Tags, Ngày, Actions
- Nút **Play**: Mở bài để nghe
- Nút **Edit**: Mở Project Editor
- Nút **🗑 Delete**: Xóa bài (có xác nhận)

---

## 6. Activity Feed — Mạng xã hội âm nhạc

Feed là nơi theo dõi hoạt động của các composer bạn đang theo dõi.

### Trong trang Feed
- **Timeline**: Xem bài đăng từ những người bạn follow
- **Global Discover**: Xem tất cả hoạt động trên toàn mạng
- Bấm **Follow** trên trang Profile của một composer để theo dõi họ

### Đăng bài
- Gõ nội dung vào ô soạn thảo
- Có thể đính kèm một bài nhạc bằng nút **Attach Score**
- Bấm **Post** để đăng

---

## 7. Academy — Khóa học tương tác

Academy chứa các khóa học có cấu trúc với lý thuyết âm nhạc + bài tập thực hành.

### Cách học
1. Vào trang **Academy**
2. Chọn khóa học phù hợp
3. Học từng **bài học (Lesson)** theo thứ tự
4. Một số bài học yêu cầu **Practice Section**: bạn phải chơi đúng các ô nhịp được đánh dấu trước khi được mở khóa bài tiếp theo

---

# Phần II: Creator — Người tạo nội dung

> [!IMPORTANT]
> Để trở thành Creator, tài khoản của bạn cần được cấp quyền Creator. Liên hệ admin nếu bạn muốn upload content.

---

## 8. Tạo Project mới

1. Vào **Dashboard → My Uploads**
2. Bấm **+ Create Project**
3. Nhập tên project
4. Bấm **Create**

Sau khi tạo, bạn được chuyển thẳng vào **Project Editor**.

---

## 9. Project Editor — Giao diện chỉnh sửa

```
┌──────────────────────────────────────────────────────────────┐
│ ← Projects │ [Tên project] │ Tags │ Save │ Publish │ ⋯ Menu │
├──────────────────────────────────────────────────────────────┤
│  [Transport Bar]  ▶ ⏸ ⏹  BPM  Playback Rate  ...           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│              [Sheet Music area / Upload Zone]                │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  [Track List]  + Add Track │ Drums ■■ │ Guitar ■■ │ ...     │
└──────────────────────────────────────────────────────────────┘
```

---

## 10. Upload Sheet Music (MusicXML)

Sheet music là file nhạc ký tự, xuất từ các phần mềm như **Sibelius, MuseScore, Finale**.

### Cách upload
**Cách 1 — Nhấn vào vùng trống:**
- Nếu project chưa có sheet music, vùng sheet music hiện một **vùng upload lớn**
- Nhấn vào đó để chọn file

**Cách 2 — Qua menu:**
- Bấm nút **⋯ (ba chấm)** góc phải trên
- Chọn **"+ MusicXML Score"**

### Định dạng hỗ trợ
| Định dạng | Mô tả |
|---|---|
| `.musicxml` | MusicXML tiêu chuẩn |
| `.xml` | Tương tự .musicxml |
| `.mxl` | MusicXML bị nén (ZIP), tự động giải nén |

### Sau khi upload
- Sheet music hiển thị ngay trên màn hình
- **Score Synth track** tự động được tạo trong Track List (Piano MIDI)
- Bạn có thể mute/unmute track Score Synth này

---

## 11. Upload Audio Stems (Track nhạc cụ)

Audio stems là các file âm thanh riêng biệt của từng nhạc cụ (drums, bass, guitar...).

### Cách thêm track
1. Trong **Track List** → bấm **+ Add Audio Track**
2. Chọn file audio (`.wav`, `.mp3`, `.ogg`, v.v.)
3. Track xuất hiện trong danh sách
4. Đặt tên track bằng cách click vào tên

### Điều chỉnh track
- **Volume**: Kéo slider để tăng/giảm âm lượng
- **Pan**: Điều chỉnh vị trí trái/phải trong stereo
- **Mute/Solo**: Tắt hoặc nghe riêng track
- **Offset (ms)**: Nếu track bị lệch thời gian so với các track khác, nhập số ms để bù lại
- **🗑 Delete**: Xóa track khỏi project

---

## 12. Tags — Phân loại bài hát

Tags giúp người dùng tìm kiếm và lọc bài hát dễ hơn.

### Cách thêm tags
1. Bấm nút **Tags** (icon nhãn) trên Action Bar
2. Chọn các tag phù hợp từ danh sách được nhóm theo category
3. Tags được lưu tự động

### Ví dụ các nhóm tag
- **Thể loại**: Jazz, Classical, Pop, Rock...
- **Nhạc cụ**: Piano, Guitar, Violin...
- **Cấp độ**: Beginner, Intermediate, Advanced...

---

## 13. Sync Mode — Đồng bộ Sheet Music với Audio

**Sync Mode** là công cụ tạo ra **Timemap** — bản đồ ánh xạ giữa thời gian âm thanh và ô nhịp trên sheet music. Đây là bước quan trọng để Wait Mode và playhead hoạt động chính xác.

### Khi nào cần Sync?
- Khi bạn đã upload cả Sheet Music và Audio Stems
- Khi playhead trên khuông nhạc chạy sai lệch so với âm thanh

### Cách thực hiện Sync

**Phương án 1 — Có intro (nhạc bắt đầu trước ô nhịp 1):**
1. Bật **Sync Mode** (nút trên Transport Bar để chuyển sang chế độ đỏ)
2. Bấm **▶ Play** để nhạc bắt đầu
3. Khi đến downbeat của **ô nhịp 1**, bấm **Space**
4. Tiếp tục bấm Space vào đầu mỗi ô nhịp tiếp theo
5. Khi xong, bấm **Save Map**

**Phương án 2 — Không có intro:**
1. Bật **Sync Mode**
2. Khi nhạc ở vị trí 0, bấm **Space** ngay để đánh dấu ô nhịp 1 = thời điểm 0
3. Play và tiếp tục tap Space theo nhịp
4. Bấm **Save Map**

> [!TIP]
> Luyện tập tap Space theo nhịp trước bằng cách nghe nhạc vài lần không ở Sync Mode. Kỹ năng tap nhịp quan trọng để có Timemap chính xác!

---

## 14. Upload Ảnh bìa (Cover Art)

1. Bấm nút **⋯ (ba chấm)**
2. Chọn **"Upload Cover Art"**
3. Chọn file ảnh (JPG, PNG, v.v.)

Ảnh bìa hiển thị trong trang Discover và trang chi tiết bài hát.

---

## 15. Chỉnh sửa tên project

- Trong Action Bar, có ô nhập **tên project** (có thể gõ trực tiếp)
- Sau khi sửa, bấm **Save** để lưu

---

## 16. Phát bản thử (Pre-Roll)

**Pre-Roll** là chức năng phát 1 nhịp metronome đếm vào trước khi nhạc bắt đầu (như nhạc trưởng đếm "1, 2, 3, 4" trước khi dàn nhạc vào).

- Bật/tắt từ icon Pre-Roll trên Transport Bar

---

## 17. Publish — Công bố bài hát

Sau khi hoàn chỉnh, bạn cần **Publish** để bài hát hiện ra ở trang Discover và có thể chia sẻ.

### Cách publish
1. Bấm nút **Publish** (màu vàng) góc phải trên
2. Bài hát chuyển sang trạng thái **Published** → xuất hiện trên Discover

### Unpublish
- Bấm nút **Unpublish** để ẩn bài hát khỏi Discover (chuyển về Draft)
- Bài vẫn tồn tại trong Dashboard của bạn

---

## 18. Chia sẻ lên Feed

Sau khi publish, bạn có thể chia sẻ bài lên Activity Feed:
1. Bấm **⋯ Menu** → **Share to Feed**
2. Nhập caption
3. Bấm **Share**

---

## 19. Quản lý Collections (Bộ sưu tập)

### Tạo collection mới
1. Vào **Dashboard → Collections**
2. Bấm **+ Create Collection**
3. Nhập tên collection

### Thêm bài vào collection
- Từ trang Discover, bấm vào bài hát → menu **⋯** → **Add to Collection**
- Chọn collection muốn thêm vào

### Chỉnh sửa collection
- Vào trang chi tiết collection
- Bấm **⋯ Menu** → **Edit Details** → chỉnh sửa tên, mô tả, cover art, public/private
- Đặt **Public**: Ai cũng thấy; **Private**: Chỉ mình bạn thấy

### Gỡ bài khỏi collection
- Trong trang collection, bấm nút **X (Remove)** bên cạnh bài muốn gỡ

---

## 20. Tạo Khóa học tương tác (Academy Courses)

Creator có thể tự tạo khóa học bằng **Tiptap Editor** — trình soạn thảo tích hợp sẵn.

### Cách tạo bài học
1. Vào **Dashboard → Creator Courses**
2. Bấm **+ Create Course**
3. Trong mỗi bài học, soạn thảo nội dung bằng editor
4. Chèn **Music Snippet** (đoạn nhạc tương tác): gõ `/` → chọn **Music Snippet** → nhập Project ID
5. Tick **Practice Required** nếu muốn học viên phải chơi đúng đoạn đó mới qua được

---

## Phụ lục: Phím tắt

| Phím | Chức năng |
|---|---|
| `Space` | Play / Pause (khi không đang gõ text) |
| `Space` (trong Sync Mode) | Đánh dấu downbeat của ô nhịp hiện tại |
| Click vào ô nhịp | Seek đến ô nhịp đó |
