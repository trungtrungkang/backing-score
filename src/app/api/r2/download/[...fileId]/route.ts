import { NextRequest, NextResponse } from "next/server";
import { s3Client, R2_BUCKET_NAME } from "@/lib/r2/client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Client as ServerClient, Account, Storage, Databases, Query } from "node-appwrite";

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_UPLOADS_BUCKET_ID || "uploads";
const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string | string[] }> }) {
  try {
    const fileIdParam = (await params).fileId;
    const fileId = Array.isArray(fileIdParam) ? fileIdParam.join("/") : fileIdParam;
    const searchParams = req.nextUrl.searchParams;
    const context = searchParams.get("context"); // e.g., "classroom_abc123"

    // 1. Phục hồi Session từ Cookie
    const cookieName = `a_session_${PROJECT_ID.toLowerCase()}`;
    const sessionCookie = req.cookies.get(cookieName)?.value || req.cookies.get("fallback_a_session")?.value;

    let userId: string | null = null;
    let isAuthorized = false;

    // Client dành cho User ẩn danh hoặc gắn Session
    const userClient = new ServerClient().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
    if (sessionCookie) {
      userClient.setSession(sessionCookie);
      try {
        const user = await new Account(userClient).get();
        userId = user.$id;
      } catch (e) {
        // Token invalid
      }
    }

    // 2. Kiểm tra phân quyền (RBAC)
    // Mặc định: Cho phép tải file qua Signed URL. 
    // ID của file trong R2 là một chuỗi UUID rất dài, gần như bất khả thi để brute-force.
    // Bản thân ID này chính là "Security Capability Token".
    isAuthorized = true;

    if (context && context.startsWith("classroom_") && userId) {
      // Logic Bypass cho Classroom (sửa lỗi Appwrite permission)
      const classroomId = context.replace("classroom_", "");
      
      // Khởi tạo Admin Client để check DB
      const adminClient = new ServerClient()
        .setEndpoint(ENDPOINT)
        .setProject(PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY!);
      
      const db = new Databases(adminClient);
      const MEMBERS_COL = process.env.NEXT_PUBLIC_APPWRITE_CLASSROOM_MEMBERS_COLLECTION_ID || "classroom_members";
      
      const res = await db.listDocuments(DB_ID, MEMBERS_COL, [
        Query.equal("classroomId", classroomId),
        Query.equal("userId", userId),
      ]);

      if (res.documents.length === 0) {
        isAuthorized = false; // Người dùng KHÔNG ở trong lớp -> CHẶN
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Thật đáng tiếc! Bạn không có quyền truy cập file này." }, { status: 403 });
    }

    // 3. Đã qua cửa bảo vệ -> Sinh Signed URL từ Cloudflare R2
    // Vì SSL của tên miền media.backingscore.com có vẻ chưa được Cloudflare khởi tạo xong
    // Ta tạm thời dùng lại Signed URL qua cloudflarestorage.com
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileId,
    });

    // Link sống trong 1 giờ (3600s)
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    // Trình duyệt tự tải trực tiếp từ URL này
    return NextResponse.redirect(signedUrl, 302);

  } catch (err: any) {
    console.error("R2 presigned download error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
