import { useTranslations } from "next-intl";
import { GraduationCap, ArrowRight, Construction } from "lucide-react";
import { Link } from "@/i18n/routing";

export default function AcademyPage() {
  const t = useTranslations("Index"); // Tạm thời dùng ns Index hoặc hardcode
  
  return (
    <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-900 dark:text-white pt-24 pb-32 flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-violet-500/5 dark:bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="max-w-3xl px-6 text-center z-10 relative">
        <div className="w-24 h-24 bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl">
          <Construction className="w-12 h-12" />
        </div>
        
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6">
          Academy is under construction
        </h1>
        
        <p className="text-lg text-zinc-500 dark:text-zinc-400 mb-10 max-w-xl mx-auto leading-relaxed">
          We are currently building the comprehensive Backing Score Academy. Soon you'll be able to access structured courses, 
          masterclasses, and gamified music theory lessons right here.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link 
            href="/discover"
            className="w-full sm:w-auto px-8 h-12 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-full font-bold flex items-center justify-center gap-2 hover:scale-105 transition-transform"
          >
            Explore Library
          </Link>
          <Link 
            href="/dashboard"
            className="w-full sm:w-auto px-8 h-12 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-full font-bold flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
