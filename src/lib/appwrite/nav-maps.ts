import * as D1 from "@/app/actions/v5/nav-maps";

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
  return D1.getNavMapV5(sheetMusicId, undefined);
}

export async function saveNavMap(sheetMusicId: string, bookmarks: Bookmark[], sequence: NavigationSequence): Promise<ParsedSheetNavMap> {
  return D1.saveNavMapV5(sheetMusicId, bookmarks, sequence, undefined);
}

export async function deleteNavMap(sheetMusicId: string): Promise<void> {
  return D1.deleteNavMapV5(sheetMusicId, undefined);
}
