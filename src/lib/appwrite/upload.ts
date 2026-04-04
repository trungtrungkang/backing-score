import * as D1 from "@/app/actions/v5/assets";

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
    const errorData = (await res.json().catch(() => ({}))) as any;
    throw new Error(errorData.error || "Failed to get upload URL");
  }

  const { fileId, uploadUrl, userId } = ((await res.json()) as any) as any;

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

  // Register Asset in Database (Storage Management V5 to D1)
  try {
    const uid = userId || undefined;
    await D1.createDriveAssetV5({
        userId: uid,
        originalName: file.name,
        sizeBytes: file.size,
        contentType: file.type || "application/octet-stream",
        r2Key: fileId
    });
  } catch (e) {
    console.error("Failed to register asset in DB (Drive V5):", e);
  }

  const viewUrl = `/api/r2/download/${fileId}`;
  return { fileId, viewUrl };
}

export function getFileViewUrl(fileId: string): string {
  if (!fileId) return "";
  return `/api/r2/download/${fileId}`;
}

export function openFileInNewTab(fileId: string): void {
  const url = `/api/r2/download/${fileId}`;
  const w = window.open(url, "_blank", "noopener");
  if (!w) {
    throw new Error("Popup blocked. Allow popups for this site to open the file.");
  }
}
