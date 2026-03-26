import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/reports — Submit a content report.
 * Stores in a simple JSON file for now; in production, this would go to a database.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { targetType, targetId, reason, details, reporterId } = body;

    if (!targetType || !targetId || !reason || !reporterId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Log the report (in production: store in Appwrite or database)
    console.log("[REPORT]", {
      timestamp: new Date().toISOString(),
      targetType,
      targetId,
      reason,
      details,
      reporterId,
    });

    return NextResponse.json({ success: true, message: "Report received" });
  } catch (error) {
    return NextResponse.json({ error: "Failed to process report" }, { status: 500 });
  }
}
