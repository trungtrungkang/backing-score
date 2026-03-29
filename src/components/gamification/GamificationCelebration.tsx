"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import confetti from "canvas-confetti";
import { Flame, Star, Trophy, ArrowUpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface GamificationXPEventDetail {
  addedXP: number;
  newTotalXP: number;
  newLevel: number;
  currentStreak: number;
  isLevelUp?: boolean;
}

export function GamificationCelebration() {
  const [xpData, setXpData] = useState<GamificationXPEventDetail | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout>(null);

  const triggerCelebration = useCallback((detail: GamificationXPEventDetail) => {
    setXpData(detail);
    setIsVisible(true);

    // 1. Fire Confetti (specifically targeted inside this container, so it works in Fullscreen)
    if (canvasRef.current) {
      const myConfetti = confetti.create(canvasRef.current, {
        resize: true,
        useWorker: true
      });

      // Default XP celebration: modest burst
      let particleCount = 60;
      let spread = 70;
      
      // If Level Up or big score (> 50 XP), blast huge confetti
      if (detail.isLevelUp || detail.addedXP >= 50) {
        particleCount = 150;
        spread = 120;
      }

      myConfetti({
        particleCount,
        spread,
        origin: { y: 0.6 },
        colors: ['#818CF8', '#A78BFA', '#FBBF24', '#F472B6'] // Indigo, Purple, Amber, Pink
      });
    }

    // 2. Schedule hide
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 4000); // 4 seconds visible

  }, []);

  useEffect(() => {
    const handleEvent = (e: CustomEvent<GamificationXPEventDetail>) => {
      triggerCelebration(e.detail);
    };

    // Listen to global event
    window.addEventListener("gamification-xp-earned" as any, handleEvent);
    return () => {
      window.removeEventListener("gamification-xp-earned" as any, handleEvent);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [triggerCelebration]);

  return (
    <div 
      className={cn(
        "absolute inset-0 pointer-events-none flex items-center justify-center z-[100] transition-opacity duration-500",
        isVisible ? "opacity-100" : "opacity-0"
      )}
    >
      {/* Full-size explicit canvas for confetti so it mounts inside the Fullscreen player DOM */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full pointer-events-none" 
      />

      {/* Center Popup Card */}
      <div 
        className={cn(
          "relative flex items-center gap-4 px-6 py-4 bg-white/90 dark:bg-black/80 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl rounded-2xl transition-transform duration-500 will-change-transform",
          isVisible ? "scale-100 translate-y-0" : "scale-90 translate-y-8"
        )}
      >
        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-inner">
          {xpData?.isLevelUp ? (
             <ArrowUpCircle className="w-6 h-6 text-white" />
          ) : (
             <Star className="w-6 h-6 text-white" fill="currentColor" />
          )}
        </div>
        
        <div className="flex flex-col">
          <div className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-400 drop-shadow-sm">
            +{xpData?.addedXP} XP Earned
          </div>
          <div className="flex items-center gap-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
            {xpData?.currentStreak && xpData.currentStreak > 0 && (
              <span className="flex items-center gap-1 text-orange-500">
                <Flame className="w-4 h-4 fill-orange-500" />
                {xpData.currentStreak} Day Streak!
              </span>
            )}
            {xpData?.isLevelUp && (
              <span className="flex items-center gap-1 text-purple-500">
                <Trophy className="w-4 h-4" />
                Level {xpData?.newLevel}!
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
