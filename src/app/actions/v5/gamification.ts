"use server";

import { getDb } from "@/db";
import { userStats, practiceSessions } from "@/db/schema/gamification";
import { getAuth } from "@/lib/auth/better-auth";
import { eq } from "drizzle-orm";

async function requireUser() {
  const auth = getAuth(process.env as any);
  const { headers } = await import("next/headers");
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

export async function getUserStatsV5(providedUserId?: string) {
   let userId = providedUserId;
   if (!userId) {
     try {
       userId = await requireUser();
     } catch (e) {
       return null;
     }
   }
   
   try {
     const db = getDb();
     const q = await db.select().from(userStats).where(eq(userStats.userId, userId)).limit(1);
     if (q.length === 0) {
       // Create initial stats
       await db.insert(userStats).values({ userId, totalXp: 0, level: 1, currentStreak: 0, longestStreak: 0, totalPracticeMs: 0 });
       return (await db.select().from(userStats).where(eq(userStats.userId, userId)).limit(1))[0];
     }
     return q[0];
   } catch (error) {
     console.error("[getUserStatsV5] Error fetching stats:", error);
     return null;
   }
}

export async function processPracticeSessionV5(userId: string, data: {
  projectId: string;
  durationMs: number;
  maxSpeed?: number;
  waitModeScore?: number;
  flowModeScore?: number;
  inputType?: string;
}) {
  const db = getDb();
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  
  const stats = await getUserStatsV5(userId);
  if (!stats) throw new Error("Failed to initialize user stats");
  
  let newStreak = stats.currentStreak;
  let newLongest = stats.longestStreak;
  
  if (stats.lastPracticeDate) {
    const lastDate = new Date(stats.lastPracticeDate);
    const dayDiff = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
    
    if (dayDiff === 1) {
      newStreak += 1;
      newLongest = Math.max(newLongest, newStreak);
    } else if (dayDiff > 1) {
      newStreak = 1;
    }
  } else {
    newStreak = 1;
    newLongest = 1;
  }
  
  // XP calculation
  const minutes = Math.floor(data.durationMs / 60000);
  let sessionXp = minutes * 10;
  if (data.flowModeScore) sessionXp += data.flowModeScore;
  if (data.waitModeScore) sessionXp += Math.floor(data.waitModeScore / 2);
  if (sessionXp === 0 && data.durationMs >= 10000) sessionXp = 1; // Minimum 1 XP if they did something
  
  const newTotalXp = stats.totalXp + sessionXp;
  const newLevel = Math.floor(newTotalXp / 100) + 1; // Simple linear leveling: 100 XP = 1 level
  
  // Insert session
  const sessionId = "sess_" + crypto.randomUUID().replace(/-/g, "").substring(0, 16);
  await db.insert(practiceSessions).values({
    id: sessionId,
    userId,
    projectId: data.projectId,
    startedAt: new Date(now.getTime() - data.durationMs),
    completedAt: now,
    durationMs: data.durationMs,
    maxSpeed: data.maxSpeed,
    waitModeScore: data.waitModeScore,
    flowModeScore: data.flowModeScore,
    inputType: data.inputType || 'audio'
  });
  
  // Update stats
  await db.update(userStats).set({
    totalXp: newTotalXp,
    level: newLevel,
    currentStreak: newStreak,
    longestStreak: newLongest,
    lastPracticeDate: todayStr,
    totalPracticeMs: stats.totalPracticeMs + data.durationMs
  }).where(eq(userStats.userId, userId));
  
  return {
    sessionId,
    xpEarned: sessionXp,
    newTotalXp,
    newLevel,
    streak: newStreak
  };
}
