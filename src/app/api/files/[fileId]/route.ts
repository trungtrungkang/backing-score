/**
 * Proxy to stream a file from Appwrite Storage using the server API key.
 * This avoids 401 when opening files (browser doesn't send Appwrite session to Appwrite URL).
 * FileId is only known to users who can read the project (owner or published), so we don't check auth here.
 */

import { NextResponse } from "next/server";
import { Client, Storage } from "node-appwrite";

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DEFAULT_BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_UPLOADS_BUCKET_ID ?? "uploads";
const ALLOWED_BUCKETS = new Set([DEFAULT_BUCKET_ID, "sheet_pdfs", "classroom_recordings"]);

function getStorage() {
  if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
    throw new Error("Missing Appwrite env (ENDPOINT, PROJECT_ID, APPWRITE_API_KEY)");
  }
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  return new Storage(client);
}

const MIME_BY_EXT: Record<string, string> = {
  musicxml: "application/vnd.recordare.musicxml+xml",
  xml: "application/xml",
  mxl: "application/vnd.recordare.musicxml",
  mid: "audio/midi",
  midi: "audio/midi",
  pdf: "application/pdf",
};

const EXT_BY_MIME: Record<string, string> = {
  "application/vnd.recordare.musicxml+xml": "musicxml",
  "application/xml": "xml",
  "application/vnd.recordare.musicxml": "mxl",
  "audio/midi": "mid",
  "text/xml": "xml",
};

function looksLikeUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  if (!fileId) {
    return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
  }

  // Support multiple buckets via query param
  const url = new URL(_request.url);
  const bucketParam = url.searchParams.get("bucket") || DEFAULT_BUCKET_ID;
  const BUCKET_ID = ALLOWED_BUCKETS.has(bucketParam) ? bucketParam : DEFAULT_BUCKET_ID;

  try {
    const storage = getStorage();
    const [fileMeta, buffer] = await Promise.all([
      storage.getFile(BUCKET_ID, fileId),
      storage.getFileView(BUCKET_ID, fileId),
    ]);

    const meta = fileMeta as { name?: string; mimeType?: string };
    let name = meta.name ?? "file";
    if (looksLikeUuid(name) || !name.includes(".")) {
      const mimeType = (meta.mimeType ?? "").toLowerCase();
      const extFromMime = EXT_BY_MIME[mimeType] ?? mimeType.split("/").pop()?.replace(/\+.*$/, "").trim() ?? "";
      name = extFromMime ? `file.${extFromMime}` : "file.musicxml";
    }
    const ext = name.split(".").pop()?.toLowerCase();
    const mime = (ext && MIME_BY_EXT[ext]) ?? meta.mimeType ?? "application/octet-stream";

    // HTTP headers must be ASCII. Use ASCII fallback + RFC 5987 filename* for Unicode names.
    const asciiName = /^[\x00-\x7F]*$/.test(name) ? name.replace(/"/g, '\\"') : `file.${ext || ""}`.replace(/\.$/, "") || "file";
    const disposition = name.includes('"') || name.includes("\n") || !/^[\x00-\x7F]*$/.test(name)
      ? `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`
      : `inline; filename="${asciiName}"`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Disposition": disposition,
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (e) {
    const message = e && typeof e === "object" && "message" in e ? (e as { message: string }).message : "Failed to load file";
    const code = e && typeof e === "object" && "code" in e ? (e as { code: number }).code : 500;
    return NextResponse.json(
      { error: message },
      { status: code === 404 ? 404 : 502 }
    );
  }
}
