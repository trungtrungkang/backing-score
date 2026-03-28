/**
 * Sheet Music Folder CRUD.
 * Supports hierarchical (nested) folders via parentFolderId.
 * Mirrors project-folders.ts pattern.
 */

import {
  account,
  databases,
  ID,
  Query,
  Permission,
  Role,
} from "./client";
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_SHEET_MUSIC_FOLDERS_COLLECTION_ID,
  APPWRITE_SHEET_MUSIC_COLLECTION_ID,
} from "./constants";
import type { SheetMusicFolderDocument } from "./types";

const dbId = APPWRITE_DATABASE_ID;
const collId = APPWRITE_SHEET_MUSIC_FOLDERS_COLLECTION_ID;
const sheetsCollId = APPWRITE_SHEET_MUSIC_COLLECTION_ID;

/** Create a folder for the current user, optionally inside a parent folder. */
export async function createSheetFolder(
  name: string,
  parentFolderId?: string | null
): Promise<SheetMusicFolderDocument> {
  const user = await account.get();
  const doc = await databases.createDocument(
    dbId,
    collId,
    ID.unique(),
    {
      userId: user.$id,
      name,
      parentFolderId: parentFolderId || null,
      order: 0,
    },
    [
      Permission.read(Role.user(user.$id)),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ]
  );
  return doc as unknown as SheetMusicFolderDocument;
}

/** List ALL folders belonging to the current user (flat list, build tree client-side). */
export async function listSheetFolders(): Promise<SheetMusicFolderDocument[]> {
  const user = await account.get();
  const { documents } = await databases.listDocuments(dbId, collId, [
    Query.equal("userId", user.$id),
    Query.orderAsc("order"),
    Query.limit(200),
  ]);
  return documents as unknown as SheetMusicFolderDocument[];
}

/** Update a folder name. */
export async function updateSheetFolder(
  folderId: string,
  name: string
): Promise<SheetMusicFolderDocument> {
  const doc = await databases.updateDocument(dbId, collId, folderId, { name });
  return doc as unknown as SheetMusicFolderDocument;
}

/** Delete a folder and all sub-folders recursively. PDFs are unfiled, not deleted. */
export async function deleteSheetFolder(folderId: string): Promise<void> {
  // Unfile sheets in this folder
  try {
    const { documents } = await databases.listDocuments(dbId, sheetsCollId, [
      Query.equal("folderId", folderId),
      Query.limit(200),
    ]);
    await Promise.all(
      documents.map((s) =>
        databases.updateDocument(dbId, sheetsCollId, s.$id, { folderId: null })
      )
    );
  } catch {
    /* best-effort */
  }

  // Delete sub-folders recursively
  try {
    const { documents: subFolders } = await databases.listDocuments(
      dbId,
      collId,
      [Query.equal("parentFolderId", folderId), Query.limit(100)]
    );
    for (const sub of subFolders) {
      await deleteSheetFolder(sub.$id);
    }
  } catch {
    /* best-effort */
  }

  await databases.deleteDocument(dbId, collId, folderId);
}

/** Move a sheet to a folder (or null to unfile). */
export async function moveSheetToFolder(
  sheetId: string,
  folderId: string | null
): Promise<void> {
  await databases.updateDocument(dbId, sheetsCollId, sheetId, { folderId });
}
