import { Client, Databases, Query, ID, Permission, Role } from "node-appwrite";
import { getPlatformConfig } from "./config";
import {
  APPWRITE_PRACTICE_SESSIONS_COLLECTION_ID,
  APPWRITE_USER_STATS_COLLECTION_ID
} from "./constants";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";

function getServerClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(client);
}

import { getDailyChallenge } from "./daily-challenge";

export interface GamificationRules {
  levelThresholds: number[];
  xpPerMinute: number;
  waitModeScore80Bonus: number;
  waitModeScore100Bonus: number;
  songCompleteBonus: number;
  streakMultiplier: number;
  dailyChallengeBonus: number;
}

export interface PracticeSessionPayload {
  projectId: string;
  durationMs: number;
  maxSpeed: number;
  waitModeScore?: number;
}

function calculateLevel(totalXP: number, thresholds: number[]): number {
  let level = 1;
  for (let i = 0; i < thresholds.length; i++) {
    if (totalXP >= thresholds[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return level;
}

export async function processPracticeSession(
  userId: string,
  payload: PracticeSessionPayload
): Promise<{ addedXP: number; newTotalXP: number; newLevel: number; currentStreak: number; isLevelUp: boolean }> {
  const db = getServerClient();

  // 1. Fetch rules
  const rules = await getPlatformConfig<GamificationRules>("gamification_rules");
  if (!rules) throw new Error("Gamification config not found");

  // 2. Fetch daily challenge
  const dailyChallenge = await getDailyChallenge();
  const isDailyChallenge = dailyChallenge && dailyChallenge.$id === payload.projectId;

  // 3. Calculate XP for this session
  const durationMins = Math.floor(payload.durationMs / 60000);
  let baseXP = durationMins * rules.xpPerMinute;

  // Additional bonuses based on Wait Mode performance
  if (payload.waitModeScore !== undefined) {
    if (payload.waitModeScore === 100) baseXP += rules.waitModeScore100Bonus;
    else if (payload.waitModeScore >= 80) baseXP += rules.waitModeScore80Bonus;
  }

  // Daily challenge bonus (Anti-Cheat: requires >= 1 min practice OR WaitMode score >= 80)
  if (isDailyChallenge) {
    if (durationMins >= 1 || (payload.waitModeScore !== undefined && payload.waitModeScore >= 80)) {
      baseXP += (rules.dailyChallengeBonus || 30);
    }
  }

  // 4. Log Practice Session (Audit Trail)
  await db.createDocument(DB, APPWRITE_PRACTICE_SESSIONS_COLLECTION_ID, ID.unique(), {
    userId,
    projectId: payload.projectId,
    startedAt: new Date(Date.now() - payload.durationMs).toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: payload.durationMs,
    maxSpeed: payload.maxSpeed,
    waitModeScore: payload.waitModeScore || null
  });

  // 4. Update or Create UserStats
  const todayStr = new Date().toISOString().slice(0, 10);
  let userStats;

  try {
    const statsResult = await db.listDocuments(DB, APPWRITE_USER_STATS_COLLECTION_ID, [
      Query.equal("userId", userId),
      Query.limit(1)
    ]);
    userStats = statsResult.documents.length > 0 ? statsResult.documents[0] : null;
  } catch (e) {
    userStats = null;
  }

  let finalXPToAdd = baseXP;
  let newCurrentStreak = 1;
  let newLongestStreak = 1;
  let newTotalXP = baseXP;
  let newTotalPracticeMs = payload.durationMs;
  let lastPracticeDate = todayStr;

  if (userStats) {
    newTotalPracticeMs = (userStats.totalPracticeMs || 0) + payload.durationMs;
    const lastDateObj = userStats.lastPracticeDate ? new Date(userStats.lastPracticeDate) : null;
    let streakIntact = false;
    
    if (lastDateObj) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      
      const lastStr = lastDateObj.toISOString().slice(0, 10);
      
      if (lastStr === todayStr) {
        // Already practiced today, keep streak but no bonus per-session streak XP unless designed so.
        // We will grant streak bonus only once per day.
        newCurrentStreak = userStats.currentStreak;
        streakIntact = true;
      } else if (lastStr === yesterdayStr) {
        // Consecutive days!
        newCurrentStreak = userStats.currentStreak + 1;
        streakIntact = true;
        // Apply daily streak bonus
        finalXPToAdd += (newCurrentStreak * rules.streakMultiplier);
      }
    }

    if (!streakIntact) {
      newCurrentStreak = 1; // reset streak
    }

    newLongestStreak = Math.max(userStats.longestStreak || 0, newCurrentStreak);
    newTotalXP = (userStats.totalXP || 0) + finalXPToAdd;
    
    await db.updateDocument(DB, APPWRITE_USER_STATS_COLLECTION_ID, userStats.$id, {
      totalXP: newTotalXP,
      level: calculateLevel(newTotalXP, rules.levelThresholds),
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      lastPracticeDate: lastPracticeDate,
      totalPracticeMs: newTotalPracticeMs
    });
  } else {
    // Create new stats row for user
    await db.createDocument(DB, APPWRITE_USER_STATS_COLLECTION_ID, ID.unique(), {
      userId,
      totalXP: newTotalXP,
      level: calculateLevel(newTotalXP, rules.levelThresholds),
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      lastPracticeDate: lastPracticeDate,
      totalPracticeMs: newTotalPracticeMs,
      badges: []
    }, [
      Permission.read(Role.user(userId)),
      Permission.update(Role.team("admin", "owner")),
    ]);
  }

  // Calculate level up status
  const oldLevel = userStats ? calculateLevel(userStats.totalXP || 0, rules.levelThresholds) : 1;
  const newLevel = calculateLevel(newTotalXP, rules.levelThresholds);

  return {
    addedXP: finalXPToAdd,
    newTotalXP: newTotalXP,
    newLevel: newLevel,
    currentStreak: newCurrentStreak,
    isLevelUp: newLevel > oldLevel
  };
}
