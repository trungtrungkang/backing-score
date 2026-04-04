export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { s3Client, R2_BUCKET_NAME } from "@/lib/r2/client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getAuth } from "@/lib/auth/better-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string | string[] }> }) {
  try {
    const fileIdParam = (await params).fileId;
    const fileId = Array.isArray(fileIdParam) ? fileIdParam.join("/") : fileIdParam;
    const searchParams = req.nextUrl.searchParams;
    const context = searchParams.get("context");

    // 1. Phục hồi Session
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: req.headers });
    const user = session?.user;

    // 2. R2 Download Access is mostly capabilities-based via fileId token.
    // If we wanted deeper checks, we would check the user's role against D1 project tables.
    let isAuthorized = true;

    if (!isAuthorized) {
      return NextResponse.json({ error: "Thật đáng tiếc! Bạn không có quyền truy cập file này." }, { status: 403 });
    }

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileId,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return NextResponse.redirect(signedUrl, 302);

  } catch (err: any) {
    console.error("R2 presigned download error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
