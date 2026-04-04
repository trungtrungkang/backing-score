export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { s3Client, R2_BUCKET_NAME } from "@/lib/r2/client";
import { Upload } from "@aws-sdk/lib-storage";
import { Client, Client as ServerClient, Account, Storage, Query } from "@/lib/appwrite/client";

/** Route handler set to run as a Node script with max duration (if Vercel limits allow) */
export const maxDuration = 300; // 5 phút max trên Vercel Pro, Hobby là 10s
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Chỉ Admin mới được thực thi Migrate
    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
    const apiKey = process.env.APPWRITE_API_KEY!;

    // Lấy JWT từ Header Authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
    }
    const jwt = authHeader.split(" ")[1];

    const jwtClient = new Client().setEndpoint(endpoint).setProject(projectId).setJWT(jwt);
    const user = await new Account(jwtClient).get().catch((e) => null);

    if (!user || !user.labels?.includes("admin")) {
      return NextResponse.json({ error: "Thôi đừng Hack, Admin Only!" }, { status: 403 });
    }

    // 2. Lấy ra tất cả các File đang có trên Appwrite
    const adminClient = new ServerClient().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
    const storageAppwrite = new Storage(adminClient);

    const BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_UPLOADS_BUCKET_ID || "uploads";
    
    let files: any[] = [];
    let lastId: string | undefined = undefined;

    // Vòng lặp lấy toàn bộ file vượt qua giới hạn 25 file mặc định của Appwrite
    while (true) {
      const queries = [Query.limit(100)];
      if (lastId) {
        queries.push(Query.cursorAfter(lastId));
      }

      const fileListRows = await storageAppwrite.listFiles(BUCKET_ID, queries);
      files.push(...fileListRows.files);

      if (fileListRows.files.length < 100) {
        break; // Đã đến page cuối cùng
      }
      lastId = fileListRows.files[fileListRows.files.length - 1].$id;
    }

    let successCount = 0;
    let failCount = 0;

    // 3. Migrate từng File sang R2 (Thực hiện trực tiếp Streaming từ Server -> Server)
    for (const file of files) {
      try {
        // Appwrite API getFileDownload trả về ArrayBuffer / Blob trên Next.js runtime
        const fileBuffer = await storageAppwrite.getFileDownload(BUCKET_ID, file.$id);

        const uploadTask = new Upload({
          client: s3Client,
          params: {
            Bucket: R2_BUCKET_NAME,
            Key: file.$id, // Ta bê y nguyên $id sang để DB ko bị lệch
            Body: Buffer.from(fileBuffer),
            ContentType: file.mimeType,
          },
        });

        await uploadTask.done();
        console.log(`[R2 Migration] Uploaded ${file.$id} (${file.name}) to Cloudflare R2.`);
        successCount++;

      } catch (err: any) {
        console.error(`[R2 Migration Error on ${file.$id}]`, err.message);
        failCount++;
      }
    }

    return NextResponse.json({
      message: "Tiến trình đồng bộ R2 hoàn thành",
      total: files.length,
      successCount,
      failCount
    });

  } catch (err: any) {
    console.error("[R2 Migration Global Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
