/**
 * GET /api/import-musicxml/preview?file=bach/bwv1.6.musicxml
 * Serves raw MusicXML file content from the musicxml-library directory.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const MANIFEST_DIR = path.join(process.cwd(), "musicxml-library");

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file");
  if (!file) {
    return NextResponse.json({ error: "Missing file parameter" }, { status: 400 });
  }

  // Prevent path traversal
  const normalized = path.normalize(file).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(MANIFEST_DIR, normalized);
  if (!filePath.startsWith(MANIFEST_DIR)) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
  }

  try {
    const content = await fs.readFile(filePath, "utf-8");
    return new NextResponse(content, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
