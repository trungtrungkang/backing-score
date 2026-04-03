"use server";

import { getDb } from "@/db";
import { userPrefs } from "@/db/schema/auth";
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

export async function getUserPrefsV5() {
   const userId = await requireUser();
   const db = getDb();
   const q = await db.select().from(userPrefs).where(eq(userPrefs.userId, userId)).limit(1);
   if (q.length === 0) return null;
   return q[0];
}

export async function updateUserPrefsV5(updates: Partial<typeof userPrefs.$inferInsert>) {
   const userId = await requireUser();
   const db = getDb();
   
   const existing = await db.select().from(userPrefs).where(eq(userPrefs.userId, userId)).limit(1);
   const now = new Date();
   
   if (existing.length === 0) {
      await db.insert(userPrefs).values({
          ...updates,
          userId,
          updatedAt: now
      });
   } else {
      await db.update(userPrefs).set({
          ...updates,
          updatedAt: now
      }).where(eq(userPrefs.userId, userId));
   }
   return true;
}
