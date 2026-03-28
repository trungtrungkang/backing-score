/**
 * Server-side API to get sheet music metadata.
 * Uses API key so students (who don't own the PDF) can still view metadata.
 * Security: only returns metadata, not the file itself (file is served via /api/files/[fileId]).
 */

import { NextResponse } from "next/server";
import { Client, Databases } from "node-appwrite";

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";
const SHEET_MUSIC_COLLECTION = "sheet_music";

function getDb() {
  if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
    throw new Error("Missing Appwrite env");
  }
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  return new Databases(client);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const db = getDb();
    const doc = await db.getDocument(DATABASE_ID, SHEET_MUSIC_COLLECTION, id);

    // Return only safe metadata (not file permissions or internal fields)
    return NextResponse.json({
      $id: doc.$id,
      title: doc.title,
      composer: doc.composer,
      instrument: doc.instrument,
      pageCount: doc.pageCount,
      fileId: doc.fileId,
      thumbnailId: doc.thumbnailId,
      tags: doc.tags,
    });
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: number }).code : 500;
    return NextResponse.json(
      { error: "Sheet music not found" },
      { status: code === 404 ? 404 : 500 }
    );
  }
}
