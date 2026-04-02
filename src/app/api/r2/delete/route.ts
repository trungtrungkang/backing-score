import { NextRequest, NextResponse } from "next/server";
import { s3Client, R2_BUCKET_NAME } from "@/lib/r2/client";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Client, Account, Databases, Query } from "node-appwrite";

export async function POST(req: NextRequest) {
  try {
    const { r2Keys } = await req.json();
    if (!Array.isArray(r2Keys) || r2Keys.length === 0) {
      return NextResponse.json({ error: "Missing or empty r2Keys array" }, { status: 400 });
    }

    // Authenticate user via Appwrite Session Cookie
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

    const db = new Databases(client);
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";
    // NOTE: Fallback to constants string as node env might not have this exposed easily
    const collId = process.env.NEXT_PUBLIC_APPWRITE_DRIVE_ASSETS_COLLECTION_ID || "v4_drive_assets";

    let deletedCount = 0;

    for (const key of r2Keys) {
       // Validate that the key string literally starts with usr_{user.$id} to prevent unauthorized deletes
       if (!key.startsWith(`usr_${user.$id}/`)) {
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

           // 2. Query and delete v4_drive_assets to refund Quota
           const assets = await db.listDocuments(dbId, collId, [
               Query.equal("r2Key", key),
               Query.equal("userId", user.$id)
           ]);
           
           for (const doc of assets.documents) {
               await db.deleteDocument(dbId, collId, doc.$id);
           }
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
