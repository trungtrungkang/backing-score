import { account, getAuthToken } from "./client";
import { isAppwriteConfigured } from "./constants";
import * as D1 from "@/app/actions/v5/sheet-music";
import * as FoldersD1 from "@/app/actions/v5/project-folders";
import type { SheetMusicDocument } from "./types";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

async function getUserIdFallback() {
  if (!isAppwriteConfigured()) return undefined;
  try {
    const user = await account.get();
    return user.$id;
  } catch {
    return undefined;
  }
}

export async function uploadSheetPdf(
  file: File,
  meta: {
    title?: string;
    composer?: string;
    instrument?: string;
    tags?: string[];
    folderId?: string | null;
    pageCount: number;
    thumbnailBlob?: Blob | null;
  }
): Promise<SheetMusicDocument> {
  if (file.type !== "application/pdf") throw new Error("Only PDF files are allowed.");
  if (file.size > MAX_FILE_SIZE) throw new Error("File exceeds 20MB limit.");

  const title = meta.title || file.name.replace(/\.pdf$/i, "");
  
  // 1. Upload PDF to Cloudflare R2
  // For R2, we use explicit sessions now via BetterAuth cookie, so getAuthToken might not be strictly needed, but kept for fallback
  const token = await getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const resPdf = await fetch("/api/r2/upload", {
    method: "POST",
    headers,
    body: JSON.stringify({
      filename: file.name,
      contentType: "application/pdf",
      fileSize: file.size,
    }),
  });
  if (!resPdf.ok) throw new Error("Failed to get PDF upload URL");
  const { fileId, uploadUrl: pdfUploadUrl } = (await resPdf.json()) as any;

  const pdfUploadRes = await fetch(pdfUploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: file,
  });
  if (!pdfUploadRes.ok) throw new Error("Failed to upload PDF to R2.");

  let thumbnailId: string | null = null;
  if (meta.thumbnailBlob) {
    try {
      const thumbFile = new File([meta.thumbnailBlob], `thumb_${fileId}.jpg`, { type: "image/jpeg" });
      const resThumb = await fetch("/api/r2/upload", {
        method: "POST",
        headers,
        body: JSON.stringify({
          filename: thumbFile.name,
          contentType: "image/jpeg",
          fileSize: thumbFile.size,
        }),
      });
      if (!resThumb.ok) throw new Error("Failed to get Thumb upload URL");
      const { fileId: thumbId, uploadUrl: thumbUploadUrl } = (await resThumb.json()) as any;

      await fetch(thumbUploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: thumbFile,
      });

      thumbnailId = thumbId;
    } catch (err) {
      console.warn("Failed to upload thumbnail:", err);
    }
  }

  // Use D1
  return D1.createSheetMusicV5({
     title,
     fileId,
     fileSize: file.size,
     pageCount: meta.pageCount,
     composer: meta.composer || undefined,
     instrument: meta.instrument || undefined,
     tags: meta.tags || [],
     folderId: meta.folderId || null,
     thumbnailId,
     favorite: false,
  }, await getUserIdFallback());
}

export async function listMySheetMusic(
  folderId?: string | null,
  options?: {
    favoritesOnly?: boolean;
    sortBy?: "lastOpenedAt" | "title" | "$createdAt";
    sortOrder?: "asc" | "desc";
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ documents: SheetMusicDocument[]; total: number }> {
  return D1.listMySheetMusicV5(folderId, options, await getUserIdFallback());
}

export async function listSheetMusic(limit = 100): Promise<{ documents: SheetMusicDocument[], total: number }> {
  return D1.listSheetMusicV5(limit);
}

export async function getSheetMusic(id: string): Promise<SheetMusicDocument> {
  return D1.getSheetMusicV5(id);
}

export async function updateSheetMusic(
  id: string,
  data: Partial<Pick<SheetMusicDocument, "title" | "composer" | "instrument" | "tags" | "folderId" | "favorite" | "lastOpenedAt">>
): Promise<SheetMusicDocument> {
  return D1.updateSheetMusicV5(id, data, await getUserIdFallback());
}

export async function deleteSheetMusic(id: string): Promise<void> {
  return D1.deleteSheetMusicV5(id, await getUserIdFallback());
}

export async function moveSheetToFolder(id: string, folderId: string | null): Promise<void> {
  return D1.updateSheetMusicV5(id, { folderId }, await getUserIdFallback()).then(() => {});
}

export async function toggleSheetFavorite(id: string, currentValue: boolean): Promise<void> {
  return D1.updateSheetMusicV5(id, { favorite: !currentValue }, await getUserIdFallback()).then(() => {});
}

export async function getSheetPdfBlobUrl(fileId: string): Promise<string> {
  const downloadUrl = `/api/r2/download/${fileId}`;
  const response = await fetch(downloadUrl);
  if (!response.ok) throw new Error("Failed to fetch PDF from R2: " + response.statusText);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export function getSheetPdfUrl(fileId: string): string {
  return `/api/r2/download/${fileId}`;
}

export function getThumbnailUrl(thumbnailId: string): string {
  return `/api/r2/download/${thumbnailId}`;
}

export async function touchSheetLastOpened(id: string): Promise<void> {
  return D1.updateSheetMusicV5(id, { lastOpenedAt: new Date().toISOString() }, await getUserIdFallback()).then(() => {});
}

export async function backfillThumbnails(onProgress?: (current: number, total: number) => void): Promise<number> {
  // Too complex to rewrite the worker just for migration, assume most exist. 
  // Future implementation should put this in a cron API endpoint or D1 specific logic.
  return 0; 
}

export async function regenerateThumbnail(sheetId: string): Promise<string> {
  const { extractPdfMetadata } = await import("@/lib/pdf-utils");
  const doc = await D1.getSheetMusicV5(sheetId);
  const downloadUrl = `/api/r2/download/${doc.fileId}`;
  const response = await fetch(downloadUrl);
  if (!response.ok) throw new Error("Failed to download PDF from R2");
  const blob = await response.blob();
  const file = new File([blob], `${doc.title}.pdf`, { type: "application/pdf" });

  const { thumbnailBlob } = await extractPdfMetadata(file);

  const thumbFile = new File([thumbnailBlob], `thumb_${doc.fileId}.jpg`, { type: "image/jpeg" });
  const token = await getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const resThumb = await fetch("/api/r2/upload", {
    method: "POST",
    headers,
    body: JSON.stringify({
      filename: thumbFile.name,
      contentType: "image/jpeg",
      fileSize: thumbFile.size,
    }),
  });
  if (!resThumb.ok) throw new Error("Failed to get Thumb upload URL");
  const { fileId: newThumbId, uploadUrl: thumbUploadUrl } = (await resThumb.json()) as any;

  const uploadRes = await fetch(thumbUploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: thumbFile,
  });
  if (!uploadRes.ok) throw new Error("Failed to upload thumbnail to R2");

  await D1.updateSheetMusicV5(doc.$id, { thumbnailId: newThumbId }, await getUserIdFallback());
  return newThumbId;
}
