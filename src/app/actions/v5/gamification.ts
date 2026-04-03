"use server";

import { getDb } from "@/db";
import { userStats } from "@/db/schema/gamification";
import { getAuth } from "@/lib/auth/better-auth";
import { eq } from "drizzle-orm";

async function requireUser() {
  let env = process.env as any;
  try {
     const { getRequestContext } = await import('@cloudflare/next-on-pages');
     env = getRequestContext().env || env;
  } catch {}
  const auth = getAuth(env);
  const { headers } = await import("next/headers");
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

export async function getUserStatsV5() {
   const userId = await requireUser();
   const db = getDb();
   const q = await db.select().from(userStats).where(eq(userStats.userId, userId)).limit(1);
   if (q.length === 0) return null;
   return q[0];
}
