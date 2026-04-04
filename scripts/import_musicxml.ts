import fs from "fs/promises";
import path from "path";
import { Client, Databases, Storage, ID, Permission, Role } from "../src/lib/appwrite/client";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";
const PROJECTS_COLLECTION = process.env.NEXT_PUBLIC_APPWRITE_PROJECTS_COLLECTION_ID || "projects";
const BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_UPLOADS_BUCKET_ID || "uploads";
const MANIFEST_DIR = path.join(process.cwd(), "musicxml-library");
const ADMIN_USER_ID = "system";

function getServerClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return {
    databases: new Databases(client),
    storage: new Storage(client),
  };
}

function generateDisplayName(meta: any): string {
  const composer = meta?.composer || "Unknown";
  const title = meta?.title || "";
  const key = meta?.key || "";
  const file = meta?.file || "";
  const safeName = file ? file.split('/').pop().replace('.musicxml', '') : "";

  if (title && !title.endsWith(".mxl") && !title.endsWith(".xml") && !title.endsWith(".musicxml")) {
    return key ? `${composer} - ${title} (${key})` : `${composer} - ${title}`;
  }

  let pretty = safeName
    .replace(/^bwv(\d)/i, "BWV $1")
    .replace(/^opus(\d)/i, "Opus $1")
    .replace(/^op(\d)/i, "Op. $1")
    .replace(/^k(\d)/i, "K. $1")
    .replace(/_/g, " ");

  const name = `${composer} - ${pretty}`;
  return key ? `${name} (${key})` : name;
}

async function main() {
  console.log("Starting Bulk MusicXML Import...");
  try {
    const manifestPath = path.join(MANIFEST_DIR, "manifest.json");
    const raw = await fs.readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);

    const { databases, storage } = getServerClient();

    let existingProjects;
    try {
      existingProjects = await databases.listDocuments(DB, PROJECTS_COLLECTION, []);
    } catch (e) {
      console.error("Failed to connect to Appwrite Database. Check .env.local", e);
      return;
    }

    const existingNames = new Set(existingProjects.documents.filter((d: any) => d.creatorEmail === "system-import@backingscore.app").map((d: any) => d.name));

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const p of manifest.pieces) {
      const displayName = p.displayName || generateDisplayName(p);
      const isImported = existingNames.has(displayName) || existingNames.has(p.title || path.basename(p.file, ".musicxml"));

      if (isImported) {
        console.log(`[SKIPPED] ${displayName} (Already exists)`);
        skipped++;
        continue;
      }

      console.log(`[IMPORTING] ${displayName}...`);
      try {
        const filePath = path.join(MANIFEST_DIR, p.file);
        const fileBuffer = await fs.readFile(filePath);
        const fileName = path.basename(p.file);

        // Web File polyfill for node-appwrite
        // Node 20 natively supports fetch and File
        const file = new File([fileBuffer], fileName, { type: "application/xml" });
        const fileId = ID.unique();
        await storage.createFile(BUCKET_ID, fileId, file as any, [Permission.read(Role.any())]);

        const payload = {
          version: 2,
          metadata: {
            name: displayName,
            artist: p.composer || "Unknown",
            keySignature: p.key || "",
            syncToTimemap: true,
            tempo: 120,
          },
          type: "multi-stems",
          audioTracks: [],
          notationData: {
            type: "music-xml",
            fileId: fileId,
            timemap: [],
          },
        };

        await databases.createDocument(
          DB,
          PROJECTS_COLLECTION,
          ID.unique(),
          {
            userId: ADMIN_USER_ID,
            name: displayName,
            mode: "practice",
            payload: JSON.stringify(payload),
            payloadVersion: 2,
            published: true,
            publishedAt: new Date().toISOString(),
            creatorEmail: "system-import@backingscore.app",
            tags: [p.composer_key || "classical", "musicxml-import"].filter(Boolean),
          },
          [Permission.read(Role.any())]
        );
        console.log(`  -> SUCCESS`);
        imported++;
      } catch (err: any) {
        console.error(`  -> ERROR: ${err.message}`);
        errors++;
      }
    }

    console.log(`\nImport Complete: ${imported} imported, ${skipped} skipped, ${errors} errors.`);
  } catch (err: any) {
    if (err.code === "ENOENT") {
      console.error("No manifest found. Please run `python3 scripts/crawl-musicxml.py` first.");
    } else {
      console.error("Fatal Error:", err.message);
    }
  }
}

main();
