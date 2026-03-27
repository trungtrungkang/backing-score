"use client";

import { Link } from "@/i18n/routing";
import {
  Target, GraduationCap, Search, Users, Music, Mic2, SlidersHorizontal,
  BookOpen, Library, Bookmark, Rss, Bell, CreditCard, Globe, Moon, Sun,
  ChevronRight, Sparkles, School
} from "lucide-react";

/* ──────────────────────────── 4 Pillars ──────────────────────────── */

const PILLARS = [
  {
    icon: <Target className="w-7 h-7" />,
    emoji: "🎯",
    title: "Luyện tập",
    subtitle: "Play Mode · Wait Mode · Mixer",
    desc: "Chơi theo nhạc đệm, nhận phản hồi ngay lập tức",
    color: "from-amber-500 to-orange-500",
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
    text: "text-amber-500",
    features: [
      {
        icon: <Music className="w-5 h-5" />,
        title: "Play Mode",
        desc: "Phát nhạc và chơi theo. Điều chỉnh tốc độ 50%–200% mà không đổi tông. Bấm vào ô nhịp để nhảy đến đoạn bạn muốn luyện."
      },
      {
        icon: <Mic2 className="w-5 h-5" />,
        title: "Wait Mode",
        desc: "Nhạc tự dừng tại mỗi nốt và chờ bạn chơi đúng mới tiếp tục. Kết nối microphone hoặc MIDI. Buộc bạn phải chính xác từng nốt."
      },
      {
        icon: <SlidersHorizontal className="w-5 h-5" />,
        title: "Mixer",
        desc: "Tắt tiếng phần Piano để tự mình chơi. Solo một nhạc cụ để nghe kỹ. Điều chỉnh âm lượng từng track — như chơi cùng ban nhạc thật."
      },
    ]
  },
  {
    icon: <GraduationCap className="w-7 h-7" />,
    emoji: "🎓",
    title: "Học",
    subtitle: "Academy · Khóa học · Classroom",
    desc: "Khóa học có cấu trúc, kết hợp lý thuyết và thực hành",
    color: "from-blue-500 to-indigo-500",
    border: "border-blue-500/30",
    bg: "bg-blue-500/10",
    text: "text-blue-500",
    features: [
      {
        icon: <GraduationCap className="w-5 h-5" />,
        title: "Academy",
        desc: "Khóa học có cấu trúc từ giáo viên. Đọc lý thuyết, thực hành trực tiếp trên trình duyệt. Một số bài yêu cầu chơi đúng để mở khóa bài tiếp."
      },
      {
        icon: <School className="w-5 h-5" />,
        title: "Classroom (sắp ra mắt)",
        desc: "Giáo viên tạo lớp học, giao bài tập, theo dõi tiến trình từng học viên. Phản hồi và đánh giá trực tiếp."
      },
    ]
  },
  {
    icon: <Search className="w-7 h-7" />,
    emoji: "🔍",
    title: "Khám phá",
    subtitle: "Discover · Wiki · Collections",
    desc: "Thư viện nhạc phân loại, bách khoa toàn thư âm nhạc",
    color: "from-emerald-500 to-teal-500",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
    features: [
      {
        icon: <Sparkles className="w-5 h-5" />,
        title: "Discover",
        desc: "Thư viện nhạc phân loại: Nổi bật ⭐ · Mới thêm 🆕 · Thịnh hành 🔥 · Được yêu thích 🔖 · Bộ sưu tập 📚. Tìm kiếm và lọc theo nhạc cụ, thể loại, độ khó."
      },
      {
        icon: <BookOpen className="w-5 h-5" />,
        title: "Wiki",
        desc: "Bách khoa toàn thư âm nhạc: nghệ sĩ, nhạc cụ, tác phẩm, thể loại. Mỗi trang liên kết trực tiếp đến bài tập liên quan."
      },
      {
        icon: <Bookmark className="w-5 h-5" />,
        title: "Collections",
        desc: "Tạo bộ sưu tập theo chủ đề riêng. Đánh dấu bài yêu thích bằng nút 🔖 Bookmark. Dễ dàng quay lại luyện tập sau."
      },
    ]
  },
  {
    icon: <Users className="w-7 h-7" />,
    emoji: "🤝",
    title: "Kết nối",
    subtitle: "Feed · Follow · Thông báo",
    desc: "Kết nối và chia sẻ với cộng đồng những người yêu âm nhạc",
    color: "from-purple-500 to-pink-500",
    border: "border-purple-500/30",
    bg: "bg-purple-500/10",
    text: "text-purple-500",
    features: [
      {
        icon: <Rss className="w-5 h-5" />,
        title: "Feed",
        desc: "Theo dõi nhạc sĩ yêu thích. Xem bảng tin, đăng bài chia sẻ tiến trình, đính kèm bài nhạc, bình luận và tương tác."
      },
      {
        icon: <Bell className="w-5 h-5" />,
        title: "Thông báo",
        desc: "Chuông thông báo cho bạn biết khi ai đó thích bài của bạn, theo dõi bạn, hoặc bình luận về nội dung của bạn."
      },
    ]
  },
];

/* ──────────────────────────── Page ──────────────────────────── */

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0E0E11] text-zinc-700 dark:text-zinc-300 font-sans selection:bg-[#C8A856]/30 selection:text-white">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-32">

        {/* ── Hero ── */}
        <section className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#C8A856]/10 border border-[#C8A856]/30 rounded-full text-[#C8A856] text-xs font-bold uppercase tracking-widest mb-6">
            <Music className="w-3.5 h-3.5" />
            Giới thiệu
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-zinc-900 dark:text-white tracking-tight mb-4 leading-tight">
            Backing & Score
          </h1>
          <p className="text-xl md:text-2xl font-medium text-transparent bg-clip-text bg-gradient-to-r from-[#C8A856] via-amber-400 to-orange-400 mb-4">
            Hệ sinh thái Âm nhạc Tương tác
          </p>
          <p className="text-zinc-500 dark:text-zinc-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Nền tảng âm nhạc toàn diện — luyện tập với phản hồi thời gian thực, 
            học từ các khóa có cấu trúc, khám phá kho nhạc phong phú, 
            và kết nối với cộng đồng những người yêu âm nhạc.
          </p>
        </section>

        {/* ── 4 Pillars Overview ── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-20">
          {PILLARS.map(p => (
            <a key={p.title} href={`#${p.title}`} className={`group flex flex-col items-center gap-3 p-5 rounded-2xl border ${p.border} ${p.bg} hover:scale-[1.03] transition-all duration-200 cursor-pointer`}>
              <div className={p.text}>{p.icon}</div>
              <span className="font-bold text-zinc-900 dark:text-white text-sm">{p.title}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 text-center leading-snug">{p.desc}</span>
            </a>
          ))}
        </section>

        {/* ── Pillar Sections ── */}
        {PILLARS.map((pillar, pi) => (
          <section key={pillar.title} id={pillar.title} className="mb-20 scroll-mt-24">
            {/* Pillar Header */}
            <div className="flex items-center gap-4 mb-8">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${pillar.color} flex items-center justify-center text-white shadow-lg`}>
                {pillar.icon}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {pillar.emoji} {pillar.title}
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{pillar.subtitle}</p>
              </div>
            </div>

            {/* Feature Cards */}
            <div className="space-y-3">
              {pillar.features.map((f, fi) => (
                <div key={fi} className="flex gap-4 p-5 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] hover:border-zinc-300 dark:hover:border-white/15 transition-all">
                  <div className={`w-10 h-10 rounded-lg ${pillar.bg} ${pillar.text} flex items-center justify-center shrink-0 border ${pillar.border}`}>
                    {f.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-white text-sm mb-1">{f.title}</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* ── Pricing ── */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-[#C8A856]" />
            Gói dịch vụ
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Free */}
            <div className="p-6 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.02]">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Miễn phí</h3>
              <p className="text-3xl font-extrabold text-zinc-900 dark:text-white mb-4">$0</p>
              <ul className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
                <li className="flex items-center gap-2">✅ Phát nhạc không giới hạn</li>
                <li className="flex items-center gap-2">✅ Wait Mode — 3 lượt/ngày</li>
                <li className="flex items-center gap-2">✅ Mạng xã hội, Feed, Collections</li>
                <li className="flex items-center gap-2">❌ Xuất PDF/MusicXML</li>
              </ul>
            </div>
            {/* Premium */}
            <div className="p-6 rounded-2xl border-2 border-[#C8A856]/50 bg-[#C8A856]/5 relative">
              <div className="absolute -top-3 right-4 px-3 py-1 bg-[#C8A856] text-black text-xs font-bold rounded-full">PREMIUM</div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Premium</h3>
              <p className="text-3xl font-extrabold text-zinc-900 dark:text-white mb-1">$4.99<span className="text-base font-normal text-zinc-500">/tháng</span></p>
              <p className="text-xs text-zinc-500 mb-4">hoặc $39.99/năm (tiết kiệm 33%)</p>
              <ul className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
                <li className="flex items-center gap-2">✅ Wait Mode không giới hạn</li>
                <li className="flex items-center gap-2">✅ Xuất PDF/MusicXML</li>
                <li className="flex items-center gap-2">✅ Academy đầy đủ</li>
                <li className="flex items-center gap-2">✅ Không quảng cáo</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── Extras ── */}
        <section className="mb-20 grid md:grid-cols-2 gap-4">
          <div className="flex items-start gap-4 p-5 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02]">
            <Globe className="w-6 h-6 text-sky-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-white text-sm mb-1">9 ngôn ngữ</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">English · Tiếng Việt · 简体中文 · 繁體中文 · Español · Français · Deutsch · 日本語 · 한국어</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-5 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02]">
            <div className="flex gap-1 shrink-0 mt-0.5">
              <Sun className="w-5 h-5 text-amber-500" />
              <Moon className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-white text-sm mb-1">Chế độ sáng / tối</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Phù hợp mọi điều kiện ánh sáng. Chuyển đổi bằng nút trên thanh header.</p>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="text-center bg-gradient-to-br from-[#C8A856]/10 via-amber-500/5 to-orange-500/10 border border-[#C8A856]/20 rounded-3xl p-10 md:p-14">
          <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white mb-3">
            Bắt đầu ngay hôm nay
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-lg mx-auto">
            Mở trình duyệt, duyệt thư viện, và bấm Play. Không cần cài đặt phần mềm.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/discover" className="px-6 py-3 bg-[#C8A856] hover:bg-[#b8983e] text-black font-bold rounded-xl transition-colors flex items-center gap-2 justify-center">
              <Search className="w-4 h-4" />
              Khám phá Thư viện
            </Link>
            <Link href="/pricing" className="px-6 py-3 bg-zinc-900 dark:bg-white/10 hover:bg-zinc-800 dark:hover:bg-white/15 text-white font-bold rounded-xl transition-colors flex items-center gap-2 justify-center">
              <CreditCard className="w-4 h-4" />
              Xem bảng giá
            </Link>
          </div>
          <p className="text-xs text-zinc-400 mt-6">
            🎵 Backing & Score — Luyện tập · Học · Khám phá · Kết nối
          </p>
        </section>

      </main>
    </div>
  );
}
