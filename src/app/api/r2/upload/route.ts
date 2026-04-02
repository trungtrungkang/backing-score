import { NextRequest, NextResponse } from "next/server";
import { s3Client, R2_BUCKET_NAME } from "@/lib/r2/client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Client, Account, Databases, Query } from "node-appwrite";

export async function POST(req: NextRequest) {
  try {
    const { filename, contentType, fileSize, contextType = "uploads", contextId = "raw" } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json({ error: "Missing filename or contentType" }, { status: 400 });
    }

    // Limit check (frontend drops are also checking, but this is a hard server guard)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB max per single raw upload
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 50MB global upload limit." }, { status: 413 });
    }

    // Xác thực người dùng qua Appwrite Session Cookie
    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
    
    const cookieName = `a_session_${projectId.toLowerCase()}`;
    const authHeader = req.headers.get("authorization");
    let sessionToken = req.cookies.get(cookieName)?.value || req.cookies.get("fallback_a_session")?.value;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      sessionToken = authHeader.split(" ")[1];
    }

    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId);
      
    if (sessionToken.startsWith("eyJ")) {
      client.setJWT(sessionToken);
    } else {
      client.setSession(sessionToken);
    }

    const account = new Account(client);
    const user = await account.get(); // Nếu cookie hợp lệ thì lấy thông tin User

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Kiểm tra Quota Dung Lượng (Mức Free: 150MB tổng)
    const db = new Databases(client);
    try {
      const assets = await db.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db", 
        "v4_drive_assets", 
        [Query.equal("userId", user.$id)]
      );
      const totalBytes = assets.documents.reduce((acc: number, doc: any) => acc + (doc.sizeBytes || 0), 0);
      
      // Giả định cứng giới hạn 150MB ở Free tier. (TODO: Kiểm tra Premium Roles ở đây)
      const isPremium = user.labels?.includes("pro") || user.labels?.includes("admin") || user.labels?.includes("studio");
      const limitBytes = isPremium ? 5 * 1024 * 1024 * 1024 : 150 * 1024 * 1024; // 5GB vs 150MB
      
      if (totalBytes + fileSize > limitBytes) {
        return NextResponse.json({ error: "Storage Quota Exceeded. Please upgrade to Pro or delete old files." }, { status: 403 });
      }
    } catch (e) {
      console.error("Warning: Failed to fetch quota (DB might be missing):", e);
    }

    // Appwrite File ID cũ sử dụng ID.unique() là chuỗi ngẫu nhiên dài 20 ký tự
    // V4 Drive Architecture: Định dạng thư mục ảo `usr_[UserId]/[ContextType]/[ContextId]/[RandomID].ext`
    const cryptoKey = crypto.randomUUID().replace(/-/g, "").substring(0, 20);
    const ext = filename.split(".").pop()?.toLowerCase();
    
    // An toàn hoá context variables (chỉ cho phép chữ, số, dấu gạch dưới)
    const safeContextType = contextType.replace(/[^a-zA-Z0-9_-]/g, "");
    const safeContextId = contextId.replace(/[^a-zA-Z0-9_-]/g, "");
    
    const objectKey = `usr_${user.$id}/${safeContextType}/${safeContextId}/${cryptoKey}.${ext}`;

    // Lệnh yêu cầu tải lên S3
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType,
      ContentLength: fileSize,
      // Có thể thêm metadata người sở hữu
      Metadata: {
        "uploader-id": user.$id,
        "original-name": encodeURIComponent(filename),
      },
    });

    // Tạo Presigned URL sống trong 15 phút (900 giây)
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    return NextResponse.json({
      fileId: objectKey, // Key này sẽ được client lưu vào Appwrite DB
      uploadUrl: signedUrl,
      userId: user.$id
    });

  } catch (err: any) {
    console.error("R2 presigned upload error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
