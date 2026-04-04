export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { s3Client, R2_BUCKET_NAME } from "@/lib/r2/client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";


import { getAuth } from "@/lib/auth/better-auth";

export async function POST(req: NextRequest) {
  try {
    const { filename, contentType, fileSize, contextType = "uploads", contextId = "raw" } = ((await req.json()) as any) as any;

    if (!filename || !contentType) {
      return NextResponse.json({ error: "Missing filename or contentType" }, { status: 400 });
    }

    // Limit check (frontend drops are also checking, but this is a hard server guard)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB max per single raw upload
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 50MB global upload limit." }, { status: 413 });
    }

    const auth = getAuth();
    const session = await auth.api.getSession({ headers: req.headers });
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Quota was checked via Appwrite, now assuming unrestricted or implementing later
    // TODO: Migrate quota checking to D1 User Stats


    // Appwrite File ID cũ sử dụng ID.unique() là chuỗi ngẫu nhiên dài 20 ký tự
    // V4 Drive Architecture: Định dạng thư mục ảo `usr_[UserId]/[ContextType]/[ContextId]/[RandomID].ext`
    const cryptoKey = crypto.randomUUID().replace(/-/g, "").substring(0, 20);
    const ext = filename.split(".").pop()?.toLowerCase();
    
    // An toàn hoá context variables (chỉ cho phép chữ, số, dấu gạch dưới)
    const safeContextType = contextType.replace(/[^a-zA-Z0-9_-]/g, "");
    const safeContextId = contextId.replace(/[^a-zA-Z0-9_-]/g, "");
    
    const objectKey = `usr_${user.id}/${safeContextType}/${safeContextId}/${cryptoKey}.${ext}`;

    // Lệnh yêu cầu tải lên S3
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType,
      ContentLength: fileSize,
      // Có thể thêm metadata người sở hữu
      Metadata: {
        "uploader-id": user.id,
        "original-name": encodeURIComponent(filename),
      },
    });

    // Tạo Presigned URL sống trong 15 phút (900 giây)
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    return NextResponse.json({
      fileId: objectKey, // Key này sẽ được client lưu vào Appwrite DB
      uploadUrl: signedUrl,
      userId: user.id
    });

  } catch (err: any) {
    console.error("R2 presigned upload error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
