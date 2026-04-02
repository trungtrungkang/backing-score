import React, { useState, useRef, useEffect } from "react";
import { Heart, ThumbsUp } from "lucide-react"; // Fallbacks
import { cn } from "@/lib/utils";

export type ReactionType = "like" | "love" | "haha" | "wow";

interface ReactionButtonProps {
  isReacted: boolean;
  reactionType: string | null;
  reactionLike: number;
  reactionLove: number;
  reactionHaha: number;
  reactionWow: number;
  reactionTotal: number;
  onReact: (type: ReactionType) => void;
  langLike?: string;
  langLove?: string;
  langHaha?: string;
  langWow?: string;
}

const REACTIONS: { type: ReactionType; src: string; fallback: React.ReactNode; color: string; label: string }[] = [
  { type: "like", src: "/reactions/like.png", fallback: <ThumbsUp className="w-5 h-5 text-blue-500 fill-current" />, color: "text-blue-500", label: "Like" },
  { type: "love", src: "/reactions/love.png", fallback: <Heart className="w-5 h-5 text-rose-500 fill-current" />, color: "text-rose-500", label: "Love" },
  { type: "haha", src: "/reactions/haha.png", fallback: <span className="text-xl">😂</span>, color: "text-yellow-500", label: "Haha" },
  { type: "wow", src: "/reactions/wow.png", fallback: <span className="text-xl">😲</span>, color: "text-orange-500", label: "Wow" },
];

export function ReactionButton({
  isReacted,
  reactionType,
  reactionLike,
  reactionLove,
  reactionHaha,
  reactionWow,
  reactionTotal,
  onReact,
  langLike = "Like",
  langLove = "Love",
  langHaha = "Haha",
  langWow = "Wow"
}: ReactionButtonProps) {
  const [showPopover, setShowPopover] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setShowPopover(true), 300);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setShowPopover(false), 300);
  };

  const handleToggleDefault = () => {
    if (isReacted && reactionType) {
       onReact(reactionType as ReactionType); // Unreact
    } else {
       onReact("like"); // Default react
    }
    setShowPopover(false);
  };

  const currentReact = REACTIONS.find(r => r.type === reactionType);

  // Calculate top 3 reactions for clustering
  const stats = [
     { type: "like", count: reactionLike || 0 },
     { type: "love", count: reactionLove || 0 },
     { type: "haha", count: reactionHaha || 0 },
     { type: "wow", count: reactionWow || 0 }
  ].filter(s => s.count > 0).sort((a, b) => b.count - a.count).slice(0, 3);
  
  const effectiveTotal = Math.max(reactionTotal || 0, stats.reduce((acc, curr) => acc + curr.count, 0));

  return (
    <div 
       className="relative flex items-center"
       onMouseEnter={handleMouseEnter}
       onMouseLeave={handleMouseLeave}
    >
      {/* Popover */}
      <div 
        className={cn(
          "absolute bottom-full left-0 mb-3 bg-white dark:bg-zinc-800 rounded-full border border-black/5 dark:border-white/10 shadow-2xl px-2 py-1 flex gap-1.5 items-center transition-all duration-300 origin-bottom-left w-max z-50",
          showPopover ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-75 translate-y-4 pointer-events-none"
        )}
      >
         {REACTIONS.map((r, i) => (
            <button
               key={r.type}
               onClick={() => { onReact(r.type); setShowPopover(false); }}
               className="hover:-translate-y-3 hover:scale-150 transition-all duration-300 rounded-full relative group origin-bottom flex items-center justify-center shrink-0 w-8 h-8"
               title={r.label}
               style={{ transitionDelay: showPopover ? `${i * 30}ms` : "0ms" }}
            >
               <img src={r.src} alt={r.label} className="w-8 h-8 min-w-[32px] min-h-[32px] object-contain drop-shadow-sm shrink-0" 
                 onError={(e) => {
                    // fall back
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                       (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                    }
                 }} 
               />
               <div style={{ display: 'none' }}>{r.fallback}</div>
            </button>
         ))}
      </div>

      {/* Main Button */}
      <button 
        onClick={handleToggleDefault}
        className={cn(
          "flex items-center gap-2 text-[13px] font-semibold transition-colors group",
          isReacted && currentReact ? currentReact.color : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        )}
      >
        <div className={cn(
          "p-1.5 rounded-full transition-colors",
          isReacted ? "bg-black/5 dark:bg-white/10" : "group-hover:bg-zinc-100 dark:group-hover:bg-zinc-800"
        )}>
          {isReacted && currentReact ? (
            <img src={currentReact.src} className="w-4 h-4 object-contain" alt={currentReact.type} />
          ) : (
            <ThumbsUp className="w-4 h-4" />
          )}
        </div>
        <span>
          {isReacted && currentReact ? (
            currentReact.type === "like" ? langLike :
            currentReact.type === "love" ? langLove :
            currentReact.type === "haha" ? langHaha :
            langWow
          ) : langLike}
        </span>
      </button>

      {/* Cluster */}
      {effectiveTotal > 0 && (
         <div className="flex items-center ml-2 border-l border-zinc-200 dark:border-white/10 pl-2">
            <div className="flex -space-x-1 mr-1.5">
               {stats.map((s, idx) => {
                  const rDef = REACTIONS.find(x => x.type === s.type);
                  if (!rDef) return null;
                  return (
                     <div key={s.type} className="w-4 h-4 rounded-full bg-white dark:bg-zinc-900 overflow-hidden ring-1 ring-white dark:ring-zinc-900 z-10" style={{ zIndex: 10 - idx }}>
                        <img src={rDef.src} className="w-full h-full object-cover" alt={s.type} />
                     </div>
                  );
               })}
            </div>
            <span className="text-[12px] text-zinc-500 font-medium">
               {effectiveTotal}
            </span>
         </div>
      )}
    </div>
  );
}
