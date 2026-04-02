/**
 * Upload files to Appwrite Storage (uploads bucket).
 * Used for MusicXML, MIDI (instrument tracks) and audio (audio tracks).
 * Store returned fileId in project payload (track.scoreFileId, midiFileId, or storageFileId).
 */

import { getAuthToken, databases, account, ID } from "./client";
import { buildStandardPermissions } from "./permissions";
import { APPWRITE_DATABASE_ID, APPWRITE_DRIVE_ASSETS_COLLECTION_ID } from "./constants";
// export { ALLOWED_EXTENSIONS } if needed elsewhere.

/** Music/score: Instrument track. Audio: Audio track. */
const ALLOWED_EXTENSIONS = [
  "musicxml",
  "xml",
  "mxl",
  "mid",
  "midi",
  "mp3",
  "wav",
  "ogg",
  "webm",
  "aac",
  "m4a",
  "flac",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "pdf"
];

function getExtension(filename: string): string {
  const last = filename.split(".").pop();
  return last ? last.toLowerCase() : "";
}

/**
 * Upload a file to the uploads bucket. Caller must be logged in.
 * Returns the file ID and a view URL. Store fileId in project payload to reference later.
 */
export async function uploadProjectFile(
  projectId: string,
  file: File
): Promise<{ fileId: string; viewUrl: string }> {
  const ext = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(
      `File type not allowed. Use: ${ALLOWED_EXTENSIONS.join(", ")}`
    );
  }

  const token = await getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Request signed URL from our Next.js API
  const res = await fetch("/api/r2/upload", {
    method: "POST",
    headers,
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      fileSize: file.size,
      contextType: projectId === "new" || !projectId ? "uploads" : "projects",
      contextId: projectId === "new" || !projectId ? "raw" : projectId,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to get upload URL");
  }

  const { fileId, uploadUrl, userId } = await res.json();

  // Upload file directly to Cloudflare R2
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error("Failed to upload file to storage.");
  }

  // Register Asset in Database (Storage Management V4)
  try {
    const uid = userId || (await account.get()).$id;
    await databases.createDocument(
      APPWRITE_DATABASE_ID, 
      APPWRITE_DRIVE_ASSETS_COLLECTION_ID, 
      ID.unique(), 
      {
        userId: uid,
        originalName: file.name,
        sizeBytes: file.size,
        contentType: file.type || "application/octet-stream",
        r2Key: fileId,
        usedCount: 0
    },
    buildStandardPermissions(uid));
  } catch (e) {
    console.error("Failed to register asset in DB (Drive V4):", e);
  }

  const viewUrl = `/api/r2/download/${fileId}`;
  return { fileId, viewUrl };
}

/**
 * Get a view URL for a file already in the bucket (e.g. from payload.sourceFileId).
 * Note: Opening this URL directly in a new tab may return 401 because the browser
 * request might not send the Appwrite session. Use openFileInNewTab instead.
 */
export function getFileViewUrl(fileId: string): string {
  if (!fileId) return "";
  return `/api/r2/download/${fileId}`;
}

/**
 * Open the file in a new tab via our API proxy. Opening the API URL directly (not a blob URL)
 * lets the browser use the response Content-Disposition filename when the user saves.
 */
export function openFileInNewTab(fileId: string): void {
  const url = `/api/r2/download/${fileId}`;
  const w = window.open(url, "_blank", "noopener");
  if (!w) {
    throw new Error("Popup blocked. Allow popups for this site to open the file.");
  }
}
