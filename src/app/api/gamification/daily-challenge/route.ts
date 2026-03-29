import { NextResponse } from "next/server";
import { getDailyChallenge } from "@/lib/appwrite/daily-challenge";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dailyProject = await getDailyChallenge();

    if (!dailyProject) {
      return NextResponse.json({ error: "No projects available" }, { status: 404 });
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    return NextResponse.json({
      challengeDate: todayStr,
      projectId: dailyProject.$id,
      name: dailyProject.name,
      composerName: dailyProject.composerName || "Unknown",
      difficulty: dailyProject.difficulty || "Beginner",
      thumbnailUrl: dailyProject.thumbnailUrl,
      playCount: dailyProject.playCount
    });
  } catch (error: any) {
    console.error("[DailyChallenge API]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
