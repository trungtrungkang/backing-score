import * as D1 from "@/app/actions/v5/project-folders";
import type { SheetMusicFolderDocument } from "./types";

export async function createSheetFolder(name: string, parentFolderId?: string | null): Promise<SheetMusicFolderDocument> {
  return D1.createProjectFolderV5(name, parentFolderId, undefined) as unknown as SheetMusicFolderDocument;
}

import { withDedup } from "../promise-dedup";

export const listSheetFolders = withDedup("listSheetFolders", async function listSheetFolders(): Promise<SheetMusicFolderDocument[]> {
  return D1.listProjectFoldersV5(undefined) as unknown as SheetMusicFolderDocument[];
});

export async function updateSheetFolder(folderId: string, name: string): Promise<SheetMusicFolderDocument> {
  return D1.updateProjectFolderV5(folderId, name, undefined, undefined) as unknown as SheetMusicFolderDocument;
}

export async function deleteSheetFolder(folderId: string): Promise<void> {
  return D1.deleteProjectFolderV5(folderId, undefined);
}

export async function moveSheetToFolder(sheetId: string, folderId: string | null): Promise<void> {
  return D1.moveProjectToFolderV5(sheetId, folderId, undefined);
}
