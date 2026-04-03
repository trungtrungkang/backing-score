"use server";

import { getDb } from "@/db";
import { users } from "@/db/schema/auth";
import { eq, inArray } from "drizzle-orm";

export async function getPublicProfile(userId: string) {
  const db = getDb();
  const uRes = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!uRes.length) return null;
  const u = uRes[0];
  
  return {
    ...u,
    prefs: {
      avatarUrl: u.image || null,
      displayName: u.name,
    }
  };
}

export async function getPublicProfiles(ids: string[]) {
  if (!ids?.length) return {};
  const db = getDb();
  const uRes = await db.select().from(users).where(inArray(users.id, ids));
  const map: Record<string, any> = {};
  for (const u of uRes) {
    map[u.id] = {
      ...u,
      prefs: {
        avatarUrl: u.image || null,
        displayName: u.name,
      }
    };
  }
  return map;
}
