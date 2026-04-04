export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { s3Client, R2_BUCKET_NAME } from "@/lib/r2/client";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";


import { getAuth } from "@/lib/auth/better-auth";

export async function POST(req: NextRequest) {
  try {
    const { r2Keys } = ((await req.json()) as any) as any;
    if (!Array.isArray(r2Keys) || r2Keys.length === 0) {
      return NextResponse.json({ error: "Missing or empty r2Keys array" }, { status: 400 });
    }

    const auth = getAuth();
    const session = await auth.api.getSession({ headers: req.headers });
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let deletedCount = 0;

    for (const key of r2Keys) {
       if (!key.startsWith(`usr_${user.id}/`)) {
          console.warn(`Attempt to delete unauthorized or malformed R2 key: ${key}`);
          continue;
       }

       try {
           // 1. Delete physical object from S3
           const command = new DeleteObjectCommand({
               Bucket: R2_BUCKET_NAME,
               Key: key
           });
           await s3Client.send(command);

           // 2. Drive stats migrated
           deletedCount++;
       } catch (err) {
           console.error(`Failed to delete key ${key}:`, err);
       }
    }

    return NextResponse.json({ success: true, deletedCount });
  } catch (err: any) {
    console.error("R2 deletion error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
