"use server";

import { getDb } from "@/db";
import { sheetOverlays } from "@/db/schema/collections";
import { getAuth } from "@/lib/auth/better-auth";
import { eq, and, or } from "drizzle-orm";
import type { Bookmark, NavigationSequence, DrawingStroke, SheetOverlay } from "@/lib/appwrite/nav-maps";

async function requireUser(clientUserId?: string) {
  if (clientUserId) return clientUserId;
  const auth = getAuth(process.env as any);
  const { headers } = await import("next/headers");
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

// Deprecated V5 endpoints that use the old logic but point to the new table
export async function getNavMapV5(sheetMusicId: string, _clientUserId?: string) {
  const overlays = await getOverlaysV5(sheetMusicId, _clientUserId);
  return overlays.length > 0 ? overlays[0] : null;
}
export async function saveNavMapV5(sheetMusicId: string, bookmarks: Bookmark[], sequence: NavigationSequence, _clientUserId?: string) {
  return saveOverlayV5(sheetMusicId, null, "Legacy NavMap", bookmarks, sequence, [], false, _clientUserId);
}
export async function deleteNavMapV5(sheetMusicId: string, _clientUserId?: string) {
  // Legacy deletion logic
}


export async function getOverlaysV5(sheetMusicId: string, _clientUserId?: string): Promise<SheetOverlay[]> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  
  // Trả về Layer của Tôi (userId) HOẶC những Layer Công khai (isPublished)
  const q = await db.select().from(sheetOverlays).where(
    and(
      eq(sheetOverlays.sheetMusicId, sheetMusicId),
      or(
        eq(sheetOverlays.userId, userId),
        eq(sheetOverlays.isPublished, true)
      )
    )
  );
  
  return q.map(doc => ({
    $id: doc.id,
    sheetMusicId: doc.sheetMusicId,
    userId: doc.userId,
    name: doc.name,
    isPublished: doc.isPublished,
    bookmarks: typeof doc.bookmarks === "string" ? JSON.parse(doc.bookmarks) : doc.bookmarks,
    sequence: typeof doc.sequence === "string" ? JSON.parse(doc.sequence) : doc.sequence,
    annotations: typeof doc.annotations === "string" ? JSON.parse(doc.annotations) : doc.annotations,
  }));
}

export async function saveOverlayV5(
  sheetMusicId: string, 
  overlayId: string | null, // Trống có nghĩa là Tạo mới
  name: string,
  bookmarks: Bookmark[], 
  sequence: NavigationSequence, 
  annotations: DrawingStroke[],
  isPublished: boolean,
  _clientUserId?: string
): Promise<SheetOverlay> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();

  // Mode: Chỉnh sửa layer có sẵn
  if (overlayId) {
    const existing = await db.select().from(sheetOverlays).where(eq(sheetOverlays.id, overlayId)).limit(1);
    if (existing.length > 0) {
      if (existing[0].userId === userId) {
        // Chủ sở hữu -> Cho phép cập nhật đè
        await db.update(sheetOverlays).set({
           name,
           bookmarks: JSON.stringify(bookmarks),
           sequence: JSON.stringify(sequence),
           annotations: JSON.stringify(annotations),
           isPublished,
           updatedAt: new Date()
        }).where(eq(sheetOverlays.id, overlayId));
        
        return {
           $id: overlayId, sheetMusicId, userId, name, isPublished, bookmarks, sequence, annotations
        };
      }
      // Không phải chủ sở hữu -> Fall-through xuống dưới để Tự động Fork ra Layer mới!
    }
  }

  // Mode: Nhánh Fork (Lưu đè tài liệu người khác) hoặc Tạo mới hoàn toàn
  const newId = crypto.randomUUID();
  await db.insert(sheetOverlays).values({
     id: newId,
     userId,
     sheetMusicId,
     name: overlayId ? `[Copy] ${name}` : name, // Gắn tiền tố nếu là Fork
     isPublished: false, // Bản copy luôn Private mặc định, tránh rác server
     bookmarks: JSON.stringify(bookmarks),
     sequence: JSON.stringify(sequence),
     annotations: JSON.stringify(annotations),
     createdAt: new Date(),
     updatedAt: new Date()
  });
  
  return {
     $id: newId, sheetMusicId, userId, name: overlayId ? `[Copy] ${name}` : name, isPublished: false, bookmarks, sequence, annotations
  };
}

export async function deleteOverlayV5(overlayId: string, _clientUserId?: string): Promise<void> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  
  const q = await db.select().from(sheetOverlays).where(eq(sheetOverlays.id, overlayId)).limit(1);
  if (q.length > 0 && q[0].userId === userId) {
      await db.delete(sheetOverlays).where(eq(sheetOverlays.id, overlayId));
  } else {
      throw new Error("Forbidden: Cannot delete someone else's overlay.");
  }
}
