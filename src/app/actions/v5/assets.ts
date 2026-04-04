"use server";

import { getDb } from "@/db";
import { driveAssets } from "@/db/schema/assets";
import { getAuth } from "@/lib/auth/better-auth";

export async function createDriveAssetV5(params: {
  userId?: string;
  originalName: string;
  sizeBytes: number;
  contentType: string;
  r2Key: string;
}): Promise<void> {
  const db = getDb();
  let userId = params.userId;
  
  if (!userId) {
     const auth = getAuth(process.env as any);
     const { headers } = await import("next/headers");
     const session = await auth.api.getSession({ headers: await headers() });
     if (session?.user?.id) userId = session.user.id;
  }
  
  if (!userId) throw new Error("Unauthorized to save asset");

  await db.insert(driveAssets).values({
      id: crypto.randomUUID(),
      userId,
      originalName: params.originalName,
      sizeBytes: params.sizeBytes,
      contentType: params.contentType,
      r2Key: params.r2Key,
      usedCount: 0,
      createdAt: new Date()
  });
}
