"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getUserStatsV5 } from "@/app/actions/v5/gamification";

export function GamificationBadge() {
  const { user } = useAuth();
  const [stats, setStats] = useState<{ level: number; totalXP: number; currentStreak: number } | null>(null);

  const fetchStats = async () => {
    if (!user?.$id) return;
    try {
      const stat = await getUserStatsV5();
      if (stat) {
        setStats({
          level: stat.level,
          totalXP: stat.totalXp,
          currentStreak: stat.currentStreak,
        });
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user]);

  useEffect(() => {
    const handleXpEarned = () => {
      fetchStats();
    };
    window.addEventListener("gamification-xp-earned", handleXpEarned);
    return () => window.removeEventListener("gamification-xp-earned", handleXpEarned);
  }, [user]);

  if (!stats) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-white/5 rounded-full border border-black/5 dark:border-white/10 hidden sm:flex cursor-pointer hover:bg-zinc-200 dark:hover:bg-white/10 transition">
      {/* Level Badge */}
      <div className="flex items-center gap-1">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white leading-none shadow-sm">
          {stats.level}
        </div>
      </div>

      {/* Streak Badge */}
      {stats.currentStreak > 0 && (
        <div className="flex items-center gap-1 pl-1 border-l border-zinc-300 dark:border-zinc-700">
          <Flame className="w-3.5 h-3.5 text-orange-500" strokeWidth={2.5} />
          <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
            {stats.currentStreak}
          </span>
        </div>
      )}
    </div>
  );
}
