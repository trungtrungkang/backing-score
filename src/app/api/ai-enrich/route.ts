export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // Tạm thời vô hiệu hoá tính năng AI-Enrich vì Appwrite đã bị ngắt.
  // Sẽ được thiết kế lại thành Server Actions tích hợp Drizzle ORM ở V6.
  return NextResponse.json(
    { error: "AI Enrichment feature is temporarily disabled during V5 architecture upgrade." },
    { status: 501 }
  );
}
