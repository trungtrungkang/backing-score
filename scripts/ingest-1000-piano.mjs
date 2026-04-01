#!/usr/bin/env node
import "dotenv/config";
import { config } from "dotenv";
import { Client, Databases, Storage, ID, Query, Permission, Role } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import csv from "csv-parser";
import path from "path";

config({ path: ".env.local", override: true });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";
const PROJECTS_COLL_ID = "projects";
const SHEET_MUSIC_COLL_ID = "sheet_music";
const WIKI_ARTISTS_COLL_ID = "wiki_artists";
const SHEET_PDFS_BUCKET_ID = "sheet_pdfs";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function removeDiacritics(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

async function main() {
  if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
    console.error("Missing Appwrite credentials");
    process.exit(1);
  }
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    console.error("Missing R2 credentials");
    process.exit(1);
  }

  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  const databases = new Databases(client);
  const storage = new Storage(client);

  const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  const results = [];
  fs.createReadStream("scripts/piano_master_library.csv")
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", async () => {
      console.log(`Parsed ${results.length} rows. Starting ingestion...`);
      for (const row of results) {
        await processRow(row, databases, storage, s3Client);
      }
      console.log("Ingestion Complete. Run 'npm run dev' to verify your data on UI.");
    });
}

async function processRow(row, databases, storage, s3Client) {
  const { music_xml_path, pdf_path, title, composer, period, difficulty, technicalTags, playlist_paths } = row;

  console.log(`\nProcessing: ${title || "Untitled"} by ${composer || "Unknown"}`);

  // 1. Wiki Resolution
  let composerId = "";
  if (composer) {
    const slug = slugify(composer);
    const result = await databases.listDocuments(DATABASE_ID, WIKI_ARTISTS_COLL_ID, [
      Query.equal("slug", slug),
      Query.limit(1)
    ]);
    if (result.total > 0) {
      composerId = result.documents[0].$id;
      console.log(`  Wiki Composer Found: ${composerId}`);
    } else {
      const newComposer = await databases.createDocument(DATABASE_ID, WIKI_ARTISTS_COLL_ID, ID.unique(), {
        name: composer,
        slug: slug,
        roles: ["composer"]
      });
      composerId = newComposer.$id;
      console.log(`  Wiki Composer Minted: ${composerId}`);
    }
  }

  // 2. Upload PDF
  let sheetMusicId = "";
  if (pdf_path && fs.existsSync(pdf_path)) {
    const fileStats = fs.statSync(pdf_path);
    const pdfFilename = slugify(title) + ".pdf";
    const buffer = fs.readFileSync(pdf_path);
    const inputFile = InputFile.fromBuffer(buffer, pdfFilename);
    const bucketFile = await storage.createFile(SHEET_PDFS_BUCKET_ID, ID.unique(), inputFile);
    
    const docTags = technicalTags ? technicalTags.split(",").map(t => t.trim()) : [];
    const newSheet = await databases.createDocument(DATABASE_ID, SHEET_MUSIC_COLL_ID, ID.unique(), {
      userId: "system_admin",
      title: title,
      fileId: bucketFile.$id,
      fileSize: fileStats.size,
      pageCount: 1, // Optional: parse pdf for exact pages
      composer: composer,
      tags: docTags,
    }, [
      Permission.read(Role.any()),
      Permission.update(Role.label("admin")),
      Permission.delete(Role.label("admin"))
    ]);
    sheetMusicId = newSheet.$id;
    console.log(`  SheetMusic PDF Minted: ${sheetMusicId}`);
  }

  // 3. Upload MusicXML
  let r2Key = "";
  if (music_xml_path && fs.existsSync(music_xml_path)) {
    const xmlBuffer = fs.readFileSync(music_xml_path);
    const filename = path.basename(music_xml_path);
    r2Key = `bulk_import/musicxml/${Date.now()}_${filename.replace(/\s+/g, '_')}`;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
      Body: xmlBuffer,
      ContentType: "application/xml"
    }));
    console.log(`  MusicXML Uploaded to R2: ${r2Key}`);
  }

  // 4. Mint ProjectDocument
  const payload = {
    version: 1,
    name: title,
    mode: "practice",
    tracks: [],
    notationData: null
  };

  if (r2Key) {
    payload.notationData = {
      type: "music-xml",
      fileId: r2Key,
      timemap: []
    };
  }

  if (sheetMusicId) {
    payload.sheetMusicPdfId = sheetMusicId; 
  }

  const searchString = removeDiacritics(`${title} ${composer} ${technicalTags}`);
  const docTags = technicalTags ? technicalTags.split(",").map(t => t.trim()) : [];
  
  const project = await databases.createDocument(DATABASE_ID, PROJECTS_COLL_ID, ID.unique(), {
    userId: "system_admin",
    name: title,
    mode: "practice",
    payload: JSON.stringify(payload),
    payloadVersion: 1,
    published: true,
    publishedAt: new Date().toISOString(),
    difficulty: difficulty ? parseInt(difficulty, 10) : 0,
    tags: docTags,
    searchString: searchString,
    wikiComposerIds: composerId ? [composerId] : [],
  }, [
    Permission.read(Role.any()),
    Permission.update(Role.label("admin")),
    Permission.delete(Role.label("admin"))
  ]);

  console.log(`  Project Minted: ${project.$id} | Link: /play/${project.$id}`);
}

main().catch(err => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
