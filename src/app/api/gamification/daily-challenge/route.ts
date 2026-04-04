export const runtime = "edge";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { projects } from "@/db/schema/drive";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const publishedProjects = await db.select().from(projects).where(eq(projects.isPublished, true)).limit(50);

    const todayStr = new Date().toISOString().slice(0, 10);

    if (publishedProjects.length === 0) {
      // Fallback if DB is empty
      return NextResponse.json({ 
        challengeDate: todayStr,
        projectId: "dummy",
        name: "Welcome Challenge",
        composerName: "System",
        difficulty: "Beginner",
        thumbnailUrl: "",
        playCount: 0
       });
    }

    // Pick one project pseudo-randomly based on the day of the year
    const start = new Date(new Date().getFullYear(), 0, 0);
    const diff = (new Date().getTime() - start.getTime()) + ((start.getTimezoneOffset() - new Date().getTimezoneOffset()) * 60 * 1000);
    const oneDay = 1000 * 60 * 60 * 24;
    const day = Math.floor(diff / oneDay);
    
    const dailyProject = publishedProjects[day % publishedProjects.length];

    let payload: any = {};
    try {
      payload = typeof dailyProject.payload === "string" ? JSON.parse(dailyProject.payload) : dailyProject.payload;
    } catch {
      // Ignore parse error
    }

    return NextResponse.json({
      challengeDate: todayStr,
      projectId: dailyProject.id,
      name: dailyProject.title,
      composerName: payload.composerName || "Unknown",
      difficulty: payload.difficulty || "Beginner",
      thumbnailUrl: dailyProject.coverUrl || "",
      playCount: payload.playCount || 0
    });
  } catch (error: any) {
    console.error("[DailyChallenge API]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
