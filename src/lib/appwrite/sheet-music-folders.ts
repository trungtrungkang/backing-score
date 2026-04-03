import { account } from "./client";
import { isAppwriteConfigured } from "./constants";
import * as D1 from "@/app/actions/v5/project-folders";
import type { SheetMusicFolderDocument } from "./types";

async function getUserIdFallback() {
  if (!isAppwriteConfigured()) return undefined;
  try {
    const user = await account.get();
    return user.$id;
  } catch {
    return undefined;
  }
}

export async function createSheetFolder(name: string, parentFolderId?: string | null): Promise<SheetMusicFolderDocument> {
  return D1.createProjectFolderV5(name, parentFolderId, await getUserIdFallback()) as unknown as SheetMusicFolderDocument;
}

export async function listSheetFolders(): Promise<SheetMusicFolderDocument[]> {
  return D1.listProjectFoldersV5(await getUserIdFallback()) as unknown as SheetMusicFolderDocument[];
}

export async function updateSheetFolder(folderId: string, name: string): Promise<SheetMusicFolderDocument> {
  return D1.updateProjectFolderV5(folderId, name, undefined, await getUserIdFallback()) as unknown as SheetMusicFolderDocument;
}

export async function deleteSheetFolder(folderId: string): Promise<void> {
  return D1.deleteProjectFolderV5(folderId, await getUserIdFallback());
}

export async function moveSheetToFolder(sheetId: string, folderId: string | null): Promise<void> {
  return D1.moveProjectToFolderV5(sheetId, folderId, await getUserIdFallback());
}
