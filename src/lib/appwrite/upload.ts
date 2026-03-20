/**
 * Upload files to Appwrite Storage (uploads bucket).
 * Used for MusicXML, MIDI (instrument tracks) and audio (audio tracks).
 * Store returned fileId in project payload (track.scoreFileId, midiFileId, or storageFileId).
 */

import { account, storage, ID, Permission, Role } from "./client";
import { APPWRITE_UPLOADS_BUCKET_ID } from "./constants";

const BUCKET_ID = APPWRITE_UPLOADS_BUCKET_ID;

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
  "png",
  "jpg",
  "jpeg",
  "webp"
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

  const user = await account.get();
  const fileId = ID.unique();

  await storage.createFile(
    BUCKET_ID,
    fileId,
    file,
    [
      Permission.read(Role.any()), // Allow direct CDN playback (relies on UUID unguessability)
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ]
  );

  const viewUrl = storage.getFileView(BUCKET_ID, fileId);
  return { fileId, viewUrl };
}

/**
 * Get a view URL for a file already in the bucket (e.g. from payload.sourceFileId).
 * Note: Opening this URL directly in a new tab may return 401 because the browser
 * request might not send the Appwrite session. Use openFileInNewTab instead.
 */
export function getFileViewUrl(fileId: string): string {
  return storage.getFileView(BUCKET_ID, fileId);
}

/**
 * Open the file in a new tab via our API proxy. Opening the API URL directly (not a blob URL)
 * lets the browser use the response Content-Disposition filename when the user saves.
 */
export function openFileInNewTab(fileId: string): void {
  const url = storage.getFileView(BUCKET_ID, fileId);
  const w = window.open(url, "_blank", "noopener");
  if (!w) {
    throw new Error("Popup blocked. Allow popups for this site to open the file.");
  }
}
