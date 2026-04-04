export const runtime = "edge";

/**
 * Legacy proxy to stream a file from Appwrite Storage.
 * Appwrite is now deprecated. We redirect all legacy file requests to R2.
 */

import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  if (!fileId) {
    return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
  }

  // Redirect to the new R2 endpoint
  const url = new URL(_request.url);
  url.pathname = `/api/r2/download/${fileId}`;
  return NextResponse.redirect(url, 301);
}
