/**
 * Server-side API route for bulk MusicXML import.
 * Uses node-appwrite (server SDK) with API key — no session required.
 *
 * GET  /api/import-musicxml          → returns manifest + wiki entities for mapping
 * POST /api/import-musicxml          → imports selected files with wiki overrides
 */

import { NextRequest, NextResponse } from "next/server";

import fs from "fs/promises";
import path from "path";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";
const PROJECTS_COLLECTION = process.env.NEXT_PUBLIC_APPWRITE_PROJECTS_COLLECTION_ID || "projects";
const BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_UPLOADS_BUCKET_ID || "uploads";
const MANIFEST_DIR = path.join(process.cwd(), "musicxml-library");

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

/** Generate a readable project name from manifest metadata */
function generateDisplayName(meta: any): string {
  const composer = meta?.composer || "Unknown";
  const title = meta?.title || "";
  const key = meta?.key || "";
  const file = meta?.file || "";
  const safeName = path.basename(file, ".musicxml");

  // Use score title if it's meaningful (not just a filename)
  if (title && !title.endsWith(".mxl") && !title.endsWith(".xml") && !title.endsWith(".musicxml")) {
    return key ? `${composer} - ${title} (${key})` : `${composer} - ${title}`;
  }

  // Format BWV/opus numbers nicely
  let pretty = safeName
    .replace(/^bwv(\d)/i, "BWV $1")
    .replace(/^opus(\d)/i, "Opus $1")
    .replace(/^op(\d)/i, "Op. $1")
    .replace(/^k(\d)/i, "K. $1")
    .replace(/_/g, " ");

  const name = `${composer} - ${pretty}`;
  return key ? `${name} (${key})` : name;
}

/** GET — read the manifest + wiki entities for mapping UI */
export async function GET() {
  try {
    const manifestPath = path.join(MANIFEST_DIR, "manifest.json");
    const raw = await fs.readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);

    const { databases } = getServerClient();

    // Check which files already exist as projects (by name)
    const existingProjects = await databases.listDocuments(DB, PROJECTS_COLLECTION, [
      Query.equal("creatorEmail", ["system-import@backingscore.app"]),
      Query.limit(500),
    ]);
    const existingNames = new Set(existingProjects.documents.map((d: any) => d.name));

    // Load all wiki entities for mapping UI
    let wikiArtists: { $id: string; name: string; slug: string }[] = [];
    let wikiCompositions: { $id: string; title: string; slug: string; genreId?: string }[] = [];
    let wikiGenres: { $id: string; name: string; slug: string }[] = [];

    try {
      const [artists, compositions, genres] = await Promise.all([
        databases.listDocuments(DB, "wiki_artists", [Query.limit(500)]),
        databases.listDocuments(DB, "wiki_compositions", [Query.limit(500)]),
        databases.listDocuments(DB, "wiki_genres", [Query.limit(500)]),
      ]);
      wikiArtists = artists.documents.map((d: any) => ({ $id: d.$id, name: d.name, slug: d.slug }));
      wikiCompositions = compositions.documents.map((d: any) => ({
        $id: d.$id, title: d.title, slug: d.slug, genreId: d.genreId,
      }));
      wikiGenres = genres.documents.map((d: any) => ({ $id: d.$id, name: d.name, slug: d.slug }));
    } catch { /* wiki collections may not exist */ }

    // Auto-map each piece to wiki entities + build display names
    const pieces = manifest.pieces.map((p: any) => {
      const displayName = p.displayName || generateDisplayName(p);
      const alreadyImported = existingNames.has(displayName) || existingNames.has(p.title || path.basename(p.file, ".musicxml"));

      // Try auto-matching composer
      let matchedArtistId: string | null = null;
      if (p.composer_key) {
        // Try exact slug match, then partial name match
        const bySlug = wikiArtists.find((a) => a.slug === p.composer_key);
        if (bySlug) {
          matchedArtistId = bySlug.$id;
        } else {
          // Try matching by name contains
          const composerLower = p.composer?.toLowerCase() || "";
          const byName = wikiArtists.find(
            (a) => a.name.toLowerCase().includes(composerLower) || composerLower.includes(a.name.toLowerCase())
          );
          if (byName) matchedArtistId = byName.$id;
        }
      }

      // Try auto-matching composition
      let matchedCompositionId: string | null = null;
      if (p.title) {
        const titleLower = p.title.toLowerCase();
        const slugified = titleLower.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const comp = wikiCompositions.find(
          (c) => c.title?.toLowerCase() === titleLower || c.slug === slugified
        );
        if (comp) matchedCompositionId = comp.$id;
      }

      return {
        ...p,
        displayName,
        alreadyImported,
        autoMatchedArtistId: matchedArtistId,
        autoMatchedCompositionId: matchedCompositionId,
      };
    });

    return NextResponse.json({
      ...manifest,
      pieces,
      wikiArtists,
      wikiCompositions,
      wikiGenres,
    });
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return NextResponse.json(
        { error: "No manifest found. Run `python3 scripts/crawl-musicxml.py` first." },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** POST — import selected files with optional wiki overrides */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const adminUserId: string = body.adminUserId || "system";

    // Each item: { file, customName?, wikiArtistId?, wikiCompositionId?, wikiGenreId? }
    const items: {
      file: string;
      customName?: string;
      wikiArtistId?: string;
      wikiCompositionId?: string;
      wikiGenreId?: string;
    }[] = body.items;

    if (!items?.length) {
      return NextResponse.json({ error: "No files specified" }, { status: 400 });
    }

    const { databases, storage } = getServerClient();

    // Load manifest for metadata
    const manifestPath = path.join(MANIFEST_DIR, "manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"));
    const piecesMap = new Map<string, any>();
    for (const p of manifest.pieces) {
      piecesMap.set(p.file, p);
    }

    const results: { file: string; status: string; projectId?: string; error?: string }[] = [];

    for (const item of items) {
      const meta = piecesMap.get(item.file);
      const projectName = item.customName || meta?.displayName || generateDisplayName(meta || { file: item.file });

      try {
        // Check if already imported
        const existing = await databases.listDocuments(DB, PROJECTS_COLLECTION, [
          Query.equal("name", [projectName]),
          Query.equal("creatorEmail", ["system-import@backingscore.app"]),
          Query.limit(1),
        ]);
        if (existing.documents.length > 0) {
          results.push({ file: item.file, status: "skipped", projectId: existing.documents[0].$id });
          continue;
        }

        // 1. Read MusicXML file from disk
        const filePath = path.join(MANIFEST_DIR, item.file);
        const fileBuffer = await fs.readFile(filePath);
        const fileName = path.basename(item.file);

        // 2. Upload to Appwrite Storage
        const fileId = ID.unique();
        const file = new File([fileBuffer], fileName, { type: "application/xml" });
        await storage.createFile(BUCKET_ID, fileId, file, [Permission.read(Role.any())]);

        // 3. Build DAWPayload
        const payload = {
          version: 2,
          metadata: {
            name: projectName,
            artist: meta?.composer || "Unknown",
            keySignature: meta?.key || "",
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

        // 4. Use admin-provided wiki links (override auto-detection)
        const wikiData: Record<string, any> = {};
        if (item.wikiArtistId) wikiData.wikiComposerIds = [item.wikiArtistId];
        if (item.wikiCompositionId) wikiData.wikiCompositionId = item.wikiCompositionId;
        if (item.wikiGenreId) wikiData.wikiGenreId = item.wikiGenreId;

        // 5. Create project document
        const doc = await databases.createDocument(
          DB,
          PROJECTS_COLLECTION,
          ID.unique(),
          {
            userId: adminUserId,
            name: projectName,
            mode: "practice",
            payload: JSON.stringify(payload),
            payloadVersion: 2,
            published: true,
            publishedAt: new Date().toISOString(),
            creatorEmail: "system-import@backingscore.app",
            tags: [meta?.composer_key || "classical", "musicxml-import"].filter(Boolean),
            ...wikiData,
          },
          [Permission.read(Role.any())]
        );

        results.push({ file: item.file, status: "imported", projectId: doc.$id });
      } catch (err: any) {
        results.push({ file: item.file, status: "error", error: err.message });
      }
    }

    const imported = results.filter((r) => r.status === "imported").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const errors = results.filter((r) => r.status === "error").length;

    return NextResponse.json({ imported, skipped, errors, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
