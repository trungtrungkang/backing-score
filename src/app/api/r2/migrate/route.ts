export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // Lịch sử Migration: Script này được dùng để dời toàn bộ Object Storage từ Appwrite sang R2.
  // Hiện tại quá trình dời đã xong, Appwrite Client bị băm nát nên script này bị đóng vĩnh viễn.
  return NextResponse.json(
    { error: "R2 Migration is permanently disabled because Appwrite is dead." },
    { status: 501 }
  );
}
