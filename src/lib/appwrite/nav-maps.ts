import * as D1 from "@/app/actions/v5/nav-maps";

export interface Bookmark {
  id: string;          // UUID, e.g. "bm-1"
  name: string;        // Section name: "Intro", "Verse 1", "To Coda"
  pageIndex: number;   // Page containing the bookmark (0-based)
  yPercent: number;    // Relative vertical position (0.0 to 1.0)
}

export type NavigationSequence = string[]; // Array of Bookmark IDs

export interface DrawingStroke {
  pageIndex: number;
  points: { x: number, y: number }[];
  color: string;
}

export interface SheetOverlay {
  $id: string;         // SQLite UUID
  sheetMusicId: string;
  userId: string;
  name: string;
  isPublished: boolean;
  bookmarks: Bookmark[];
  sequence: NavigationSequence;
  annotations: DrawingStroke[];
}

// Deprecated: Lớp vỏ tương thích ngược nếu còn ở đâu đó gọi (TBD)
export type ParsedSheetNavMap = SheetOverlay;
export type SheetNavMapDocument = any;

export async function getNavMap(sheetMusicId: string): Promise<ParsedSheetNavMap | null> {
  return D1.getNavMapV5(sheetMusicId);
}

export async function saveNavMap(sheetMusicId: string, bookmarks: Bookmark[], sequence: NavigationSequence): Promise<ParsedSheetNavMap> {
  return D1.saveNavMapV5(sheetMusicId, bookmarks, sequence);
}

export async function deleteNavMap(sheetMusicId: string): Promise<void> {
  return D1.deleteNavMapV5(sheetMusicId);
}

export async function getOverlays(sheetMusicId: string): Promise<SheetOverlay[]> {
  return D1.getOverlaysV5(sheetMusicId, undefined);
}

export async function saveOverlay(sheetMusicId: string, overlayId: string | null, name: string, bookmarks: Bookmark[], sequence: NavigationSequence, annotations: DrawingStroke[], isPublished: boolean): Promise<SheetOverlay> {
  return D1.saveOverlayV5(sheetMusicId, overlayId, name, bookmarks, sequence, annotations, isPublished, undefined);
}

export async function deleteOverlay(overlayId: string): Promise<void> {
  return D1.deleteOverlayV5(overlayId, undefined);
}
