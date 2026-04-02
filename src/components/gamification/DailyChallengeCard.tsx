"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { Flame, Star, Zap, PlayCircle, Music4 } from "lucide-react";

export function DailyChallengeCard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gamification/daily-challenge")
      .then(res => res.json())
      .then(data => {
         if (!data.error) setData(data);
         setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !data) return null;

  return (
    <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-1 shadow-lg shadow-purple-500/20 group">
       <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
       
       <div className="relative flex flex-col items-stretch bg-zinc-950/80 backdrop-blur-xl rounded-xl p-5 gap-4">
         {/* Top: Thumbnail */}
         <Link href={`/play/${data.projectId}`} className="w-full h-40 shrink-0 rounded-lg overflow-hidden border-2 border-white/10 relative group/thumb cursor-pointer">
           {data.thumbnailUrl ? (
             <img src={data.thumbnailUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover/thumb:scale-110" />
           ) : (
             <div className="w-full h-full bg-zinc-800 flex items-center justify-center transition-transform duration-500 group-hover/thumb:scale-110">
               <Music4 className="w-8 h-8 text-white/30" />
             </div>
           )}
           <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
             <PlayCircle className="w-10 h-10 text-white drop-shadow-lg" />
           </div>
         </Link>

         {/* Middle: Info */}
         <div className="flex-1 flex flex-col items-start gap-1.5">
           <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/20 shadow-inner">
             <Flame className="w-4 h-4 text-orange-400" />
             <span className="text-xs font-black uppercase tracking-wider text-orange-400 drop-shadow-md">Daily Challenge</span>
             <span className="font-bold text-white/50 text-[10px] hidden sm:inline">&bull; {data.challengeDate}</span>
           </div>
           
           <div className="mt-1">
             <h3 className="text-2xl font-black text-white line-clamp-1">{data.name}</h3>
             <p className="text-sm font-semibold text-zinc-400">{data.composerName} • {data.difficulty}</p>
           </div>
           
           <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1.5 text-green-400 font-bold bg-green-400/10 border border-green-500/20 px-2 py-0.5 rounded-md shadow-sm">
                <Zap className="w-4 h-4 fill-green-400" /> +30 Bonus XP
              </span>
           </div>
         </div>

         {/* Right: CTA */}
         <div className="mt-2 flex flex-col justify-center border-t border-white/10 pt-4">
            <Link 
              href={`/play/${data.projectId}`}
              className="w-full text-center px-8 py-3 bg-white text-black hover:bg-zinc-200 transition-colors rounded-xl font-bold whitespace-nowrap shadow-xl"
            >
              Play Challenge
            </Link>
         </div>
       </div>
    </div>
  );
}
