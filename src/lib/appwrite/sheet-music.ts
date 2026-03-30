/**
 * Sheet Music (PDF) CRUD functions.
 * Upload, list, update, delete PDF sheet music documents.
 */

import {
  account,
  databases,
  storage,
  ID,
  Query,
  Permission,
  Role,
  getAuthToken
} from "./client";
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_SHEET_MUSIC_COLLECTION_ID,
  APPWRITE_SHEET_PDFS_BUCKET_ID,
} from "./constants";
import { buildStandardPermissions } from "./permissions";
import type { SheetMusicDocument } from "./types";

const dbId = APPWRITE_DATABASE_ID;
const collId = APPWRITE_SHEET_MUSIC_COLLECTION_ID;
const bucketId = APPWRITE_SHEET_PDFS_BUCKET_ID;

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

/** Upload a PDF file and create a sheet music document. */
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
  if (file.type !== "application/pdf") {
    throw new Error("Only PDF files are allowed.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File exceeds 20MB limit.");
  }

  const user = await account.get();

  // Create document metadata first (without fileIds yet)
  const title = meta.title || file.name.replace(/\.pdf$/i, "");
  
  // 1. Upload PDF to Cloudflare R2
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
  const { fileId, uploadUrl: pdfUploadUrl } = await resPdf.json();

  const pdfUploadRes = await fetch(pdfUploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: file,
  });
  if (!pdfUploadRes.ok) throw new Error("Failed to upload PDF to R2.");

  // Create document
  const doc = await databases.createDocument(
    dbId,
    collId,
    ID.unique(),
    {
      userId: user.$id,
      title,
      fileId,
      fileSize: file.size,
      pageCount: meta.pageCount,
      composer: meta.composer || null,
      instrument: meta.instrument || null,
      tags: meta.tags || [],
      folderId: meta.folderId || null,
      thumbnailId: null as string | null,
      favorite: false,
    },
    buildStandardPermissions(user.$id)
  );

  // Upload thumbnail if provided
  if (meta.thumbnailBlob) {
    try {
      const thumbFile = new File([meta.thumbnailBlob], `thumb_${fileId}.jpg`, {
        type: "image/jpeg",
      });
      
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
      const { fileId: thumbId, uploadUrl: thumbUploadUrl } = await resThumb.json();

      await fetch(thumbUploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: thumbFile,
      });

      // Update document with thumbnailId
      await databases.updateDocument(dbId, collId, doc.$id, {
        thumbnailId: thumbId,
      });
      (doc as unknown as SheetMusicDocument).thumbnailId = thumbId;
    } catch (err) {
      console.warn("Failed to upload thumbnail:", err);
    }
  }

  return doc as unknown as SheetMusicDocument;
}

/** List sheet music for the current user, optionally filtered by folder. */
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
  const user = await account.get();
  const queries = [
    Query.equal("userId", user.$id),
    Query.limit(options?.limit || 50),
  ];

  if (options?.offset) {
    queries.push(Query.offset(options.offset));
  }

  if (folderId !== undefined) {
    if (folderId === null) {
      queries.push(Query.isNull("folderId"));
    } else {
      queries.push(Query.equal("folderId", folderId));
    }
  }

  if (options?.favoritesOnly) {
    queries.push(Query.equal("favorite", true));
  }

  if (options?.search) {
    queries.push(Query.search("title", options.search));
  }

  const sortField = options?.sortBy || "$createdAt";
  if (options?.sortOrder === "asc") {
    queries.push(Query.orderAsc(sortField));
  } else {
    queries.push(Query.orderDesc(sortField));
  }

  const result = await databases.listDocuments(dbId, collId, queries);
  return {
    documents: result.documents as unknown as SheetMusicDocument[],
    total: result.total,
  };
}

/** Get a single sheet music document by ID. */
export async function getSheetMusic(id: string): Promise<SheetMusicDocument> {
  const doc = await databases.getDocument(dbId, collId, id);
  return doc as unknown as SheetMusicDocument;
}

/** Update sheet music metadata. */
export async function updateSheetMusic(
  id: string,
  data: Partial<
    Pick<
      SheetMusicDocument,
      "title" | "composer" | "instrument" | "tags" | "folderId" | "favorite" | "lastOpenedAt"
    >
  >
): Promise<SheetMusicDocument> {
  const doc = await databases.updateDocument(dbId, collId, id, data);
  return doc as unknown as SheetMusicDocument;
}

/** Delete a sheet music document and its PDF file. */
export async function deleteSheetMusic(id: string): Promise<void> {
  const doc = await databases.getDocument(dbId, collId, id);
  const sheet = doc as unknown as SheetMusicDocument;

  // In the R2 setup, storage cleanup might require an Admin API Route
  // For now, removing the Appwrite Client SDl storage call since they are in R2
  // We just rely on orphan state, or call an Admin route to delete R2 objects
  try {
    // await fetch(`/api/r2/delete/${sheet.fileId}`, { method: 'DELETE' }); // Optional future R2 cleanup
  } catch {
    /* best-effort */
  }

  // Delete document
  await databases.deleteDocument(dbId, collId, id);
}

/** Move a sheet to a folder (or null to unfile). */
export async function moveSheetToFolder(
  id: string,
  folderId: string | null
): Promise<void> {
  await databases.updateDocument(dbId, collId, id, { folderId });
}

/** Toggle favorite status on a sheet. */
export async function toggleSheetFavorite(
  id: string,
  currentValue: boolean
): Promise<void> {
  await databases.updateDocument(dbId, collId, id, {
    favorite: !currentValue,
  });
}

/** Download a PDF file from R2 and return a blob URL. */
export async function getSheetPdfBlobUrl(fileId: string): Promise<string> {
  const downloadUrl = `/api/r2/download/${fileId}`;
  const response = await fetch(downloadUrl);
  if (!response.ok) throw new Error("Failed to fetch PDF from R2: " + response.statusText);
  // Response is redirected to S3/R2 presigned URL and returns Blob
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/** Get the R2 download API URL. */
export function getSheetPdfUrl(fileId: string): string {
  return `/api/r2/download/${fileId}`;
}

/** Get a thumbnail URL via R2 download API proxy. */
export function getThumbnailUrl(thumbnailId: string): string {
  return `/api/r2/download/${thumbnailId}`;
}

export async function touchSheetLastOpened(id: string): Promise<void> {
  await databases.updateDocument(dbId, collId, id, {
    lastOpenedAt: new Date().toISOString(),
  });
}

/**
 * Backfill thumbnails for all PDFs that don't have one.
 * Runs client-side (needs canvas for rendering).
 * @param onProgress - callback with (current, total) for UI updates
 * @returns number of thumbnails generated
 */
export async function backfillThumbnails(
  onProgress?: (current: number, total: number) => void
): Promise<number> {
  const { extractPdfMetadata } = await import("@/lib/pdf-utils");

  // Find all PDFs without thumbnails
  const queries = [Query.isNull("thumbnailId"), Query.limit(100)];
  const result = await databases.listDocuments(dbId, collId, queries);
  const docs = result.documents as unknown as SheetMusicDocument[];

  if (docs.length === 0) return 0;

  let processed = 0;
  for (const doc of docs) {
    onProgress?.(processed + 1, docs.length);
    try {
      // Download the PDF file
      const fileUrl = storage.getFileView(bucketId, doc.fileId);
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const file = new File([blob], `${doc.title}.pdf`, { type: "application/pdf" });

      // Generate thumbnail
      const { thumbnailBlob } = await extractPdfMetadata(file);

      // Upload thumbnail
      const thumbId = ID.unique();
      const thumbFile = new File([thumbnailBlob], `thumb_${doc.fileId}.jpg`, { type: "image/jpeg" });
      await storage.createFile(bucketId, thumbId, thumbFile, [
        Permission.read(Role.user(doc.userId)),
        Permission.update(Role.user(doc.userId)),
        Permission.delete(Role.user(doc.userId)),
      ]);

      // Update document
      await databases.updateDocument(dbId, collId, doc.$id, { thumbnailId: thumbId });
      processed++;
    } catch (err) {
      console.warn(`Failed to backfill thumbnail for ${doc.title}:`, err);
    }
  }

  return processed;
}
