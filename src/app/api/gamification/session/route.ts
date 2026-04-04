import { NextRequest, NextResponse } from "next/server";
import { getAppwriteClient, account } from "@/lib/appwrite";
import { processPracticeSessionV5 } from "@/app/actions/v5/gamification";

export async function POST(req: NextRequest) {
  try {
    const body = ((await req.json()) as any) as any;
    const { userId, projectId, durationMs, maxSpeed, waitModeScore, flowModeScore, inputType } = body;

    if (!userId || !projectId || typeof durationMs !== "number") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (durationMs < 10000) {
      // Ignore sessions less than 10 seconds to prevent spam
      return NextResponse.json({ message: "Session too short, ignored" }, { status: 200 });
    }

    const result = await processPracticeSessionV5(userId, {
      projectId,
      durationMs,
      maxSpeed: maxSpeed || 1.0,
      waitModeScore,
      flowModeScore,
      inputType
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("[Gamification API Error]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
