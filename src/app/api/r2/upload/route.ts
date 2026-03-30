import { NextRequest, NextResponse } from "next/server";
import { s3Client, R2_BUCKET_NAME } from "@/lib/r2/client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Client, Account } from "node-appwrite";

export async function POST(req: NextRequest) {
  try {
    const { filename, contentType, fileSize } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json({ error: "Missing filename or contentType" }, { status: 400 });
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

    // Appwrite File ID cũ sử dụng ID.unique() là chuỗi ngẫu nhiên dài 20 ký tự
    // Ta tự tạo một UUID để làm Key trong R2
    const cryptoKey = crypto.randomUUID().replace(/-/g, "").substring(0, 20);
    const ext = filename.split(".").pop()?.toLowerCase();
    const objectKey = `${cryptoKey}.${ext}`;

    // Lệnh yêu cầu tải lên S3
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType,
      ContentLength: fileSize,
      // Có thể thêm metadata người sở hữu
      Metadata: {
        "uploader-id": user.$id,
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
