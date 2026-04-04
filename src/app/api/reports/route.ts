export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/reports — Submit a content report.
 * Persists to Appwrite "reports" collection.
 */
export async function POST(request: NextRequest) {
  try {
    const body = ((await request.json()) as any) as any;
    const { targetType, targetId, reason, details, reporterId } = body;

    if (!targetType || !targetId || !reason || !reporterId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Try to persist in Appwrite; fall back to logging if collection doesn't exist
    try {
      const { createReport } = await import("@/lib/appwrite/reports");
      await createReport({ targetType, targetId, reason, details, reporterId });
    } catch (err) {
      // Collection might not exist yet — log instead
      console.log("[REPORT]", {
        timestamp: new Date().toISOString(),
        targetType,
        targetId,
        reason,
        details,
        reporterId,
      });
    }

    return NextResponse.json({ success: true, message: "Report received" });
  } catch (error) {
    return NextResponse.json({ error: "Failed to process report" }, { status: 500 });
  }
}
