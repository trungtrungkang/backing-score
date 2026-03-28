import { ID, Query, Permission, Role } from "appwrite";
import { account, databases } from "./client";

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";
const collId = "sheet_nav_maps";

export interface Bookmark {
  id: string;          // UUID, e.g. "bm-1"
  name: string;        // Section name: "Intro", "Verse 1", "To Coda"
  pageIndex: number;   // Page containing the bookmark (0-based)
  yPercent: number;    // Relative vertical position (0.0 to 1.0)
}

export type NavigationSequence = string[]; // Array of Bookmark IDs

export interface SheetNavMapDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  sheetMusicId: string;
  userId: string;
  bookmarks: string; // JSON string
  sequence: string; // JSON string
}

export interface ParsedSheetNavMap {
  $id: string;
  sheetMusicId: string;
  bookmarks: Bookmark[];
  sequence: NavigationSequence;
}

export async function getNavMap(sheetMusicId: string): Promise<ParsedSheetNavMap | null> {
  const { documents } = await databases.listDocuments(dbId, collId, [
    Query.equal("sheetMusicId", sheetMusicId),
    Query.limit(1),
  ]);

  if (documents.length === 0) return null;

  const doc = documents[0] as unknown as SheetNavMapDocument;
  try {
    return {
      $id: doc.$id,
      sheetMusicId: doc.sheetMusicId,
      bookmarks: JSON.parse(doc.bookmarks || "[]"),
      sequence: JSON.parse(doc.sequence || "[]"),
    };
  } catch {
    return null;
  }
}

export async function saveNavMap(sheetMusicId: string, bookmarks: Bookmark[], sequence: NavigationSequence): Promise<ParsedSheetNavMap> {
  const user = await account.get();

  const { documents: existing } = await databases.listDocuments(dbId, collId, [
    Query.equal("sheetMusicId", sheetMusicId),
    Query.limit(1),
  ]);

  if (existing.length > 0) {
    const docId = existing[0].$id;
    const doc = await databases.updateDocument(dbId, collId, docId, {
      bookmarks: JSON.stringify(bookmarks),
      sequence: JSON.stringify(sequence),
      userId: user.$id,
    });
    return {
      $id: doc.$id,
      sheetMusicId,
      bookmarks,
      sequence,
    };
  } else {
    const doc = await databases.createDocument(
      dbId,
      collId,
      ID.unique(),
      {
        sheetMusicId,
        userId: user.$id,
        bookmarks: JSON.stringify(bookmarks),
        sequence: JSON.stringify(sequence),
      },
      [
        // Publicly readable so students can access teacher's map
        Permission.read(Role.users()),
        Permission.update(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id)),
      ]
    );
    return {
      $id: doc.$id,
      sheetMusicId,
      bookmarks,
      sequence,
    };
  }
}

export async function deleteNavMap(sheetMusicId: string) {
  const { documents } = await databases.listDocuments(dbId, collId, [
    Query.equal("sheetMusicId", sheetMusicId),
    Query.limit(1),
  ]);

  if (documents.length > 0) {
    await databases.deleteDocument(dbId, collId, documents[0].$id);
  }
}
