export const runtime = "edge";
import { Client, Databases, Account, Storage, Query, ID, Permission, Role, Models } from "@/lib/appwrite/client";
/**
 * Server-side API for searching Wikipedia and saving compositions to Appwrite.
 *
 * GET  /api/wiki-search?q=...&type=composition  → search Wikipedia
 * POST /api/wiki-search                          → save a composition to Appwrite
 */

import { NextRequest, NextResponse } from "next/server";


const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";
const WIKI_API = "https://en.wikipedia.org/api/rest_v1/page/summary";
const WIKI_SEARCH_API = "https://en.wikipedia.org/w/api.php";
const USER_AGENT = "BackingAndScore/1.0 (music-encyclopedia; educational)";

function getServerClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(client);
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Search Wikipedia for articles matching query */
async function searchWikipedia(query: string, limit = 10) {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: `${query} music composition`,
    srlimit: String(limit),
    format: "json",
    origin: "*",
  });

  const resp = await fetch(`${WIKI_SEARCH_API}?${params}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!resp.ok) return [];

  const data = await resp.json() as any;
  return (data.query?.search || []).map((r: any) => ({
    title: r.title,
    snippet: r.snippet?.replace(/<[^>]+>/g, "") || "",
    pageId: r.pageid,
  }));
}

/** Fetch full summary + image for a Wikipedia article */
async function fetchWikiSummary(title: string) {
  try {
    const resp = await fetch(`${WIKI_API}/${encodeURIComponent(title)}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!resp.ok) return null;
    const data = await resp.json() as any;
    return {
      title: data.titles?.normalized || data.title || title,
      extract: data.extract || "",
      description: data.description || "",
      imageUrl: data.thumbnail?.source || data.originalimage?.source || null,
    };
  } catch {
    return null;
  }
}

/** Fetch detailed HTML extract from Wikipedia */
async function fetchWikiExtract(title: string, maxChars = 3900) {
  try {
    const params = new URLSearchParams({
      action: "query",
      titles: title,
      prop: "extracts",
      exlimit: "1",
      format: "json",
      origin: "*",
    });
    const resp = await fetch(`${WIKI_SEARCH_API}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!resp.ok) return null;

    const data = await resp.json() as any;
    const pages = data.query?.pages || {};
    const page = Object.values(pages)[0] as any;
    if (!page || page.missing !== undefined) return null;

    let html = page.extract || "";
    html = html.replace(/<span[^>]*>|<\/span>/g, "");
    html = html.replace(/<link[^>]*>/g, "");
    html = html.replace(/class="[^"]*"/g, "");
    html = html.replace(/id="[^"]*"/g, "");
    html = html.replace(/<div[^>]*>|<\/div>/g, "");
    html = html.replace(/\n{3,}/g, "\n\n").trim();

    if (html.length > maxChars) {
      let truncated = html.substring(0, maxChars);
      const lastClose = truncated.lastIndexOf("</p>");
      if (lastClose > maxChars * 0.3) {
        truncated = truncated.substring(0, lastClose + 4);
      }
      html = truncated;
    }

    return html || null;
  } catch {
    return null;
  }
}

/** GET — search Wikipedia */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  const title = req.nextUrl.searchParams.get("title"); // fetch details for a specific article

  if (title) {
    // Fetch full details for a specific article
    const [summary, extract] = await Promise.all([
      fetchWikiSummary(title),
      fetchWikiExtract(title),
    ]);
    if (!summary) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    return NextResponse.json({
      ...summary,
      fullDescription: extract,
    });
  }

  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }

  const results = await searchWikipedia(q);
  return NextResponse.json({ results });
}

/** POST — save a composition to Appwrite wiki_compositions */
export async function POST(req: NextRequest) {
  try {
    const body = ((await req.json()) as any) as any;
    const {
      title, year, period, keySignature, difficulty,
      description, genreId, composerIds, imageUrl, wikiArticle,
    } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const db = getServerClient();
    const slug = slugify(title);

    // Check if already exists
    const existing = await db.listDocuments(DB, "wiki_compositions", [
      Query.equal("slug", slug),
      Query.limit(1),
    ]);

    if (existing.documents.length > 0) {
      // Update existing
      const docId = existing.documents[0].$id;
      const updateData: Record<string, any> = { title };
      if (year) updateData.year = year;
      if (period) updateData.period = period;
      if (keySignature) updateData.keySignature = keySignature;
      if (difficulty) updateData.difficulty = difficulty;
      if (description) updateData.description = description;
      if (genreId) updateData.genreId = genreId;
      if (composerIds?.length) updateData.composerIds = composerIds;
      if (imageUrl) updateData.imageUrl = imageUrl;
      if (wikiArticle) updateData.wikiArticle = wikiArticle;

      await db.updateDocument(DB, "wiki_compositions", docId, updateData);
      return NextResponse.json({ id: docId, action: "updated", slug });
    }

    // Create new
    const data: Record<string, any> = { title, slug };
    if (year) data.year = year;
    if (period) data.period = period;
    if (keySignature) data.keySignature = keySignature;
    if (difficulty) data.difficulty = difficulty;
    if (description) data.description = description;
    if (genreId) data.genreId = genreId;
    if (composerIds?.length) data.composerIds = composerIds;
    if (imageUrl) data.imageUrl = imageUrl;
    if (wikiArticle) data.wikiArticle = wikiArticle;

    const doc = await db.createDocument(
      DB, "wiki_compositions", ID.unique(), data,
      [Permission.read(Role.any())]
    );

    return NextResponse.json({ id: doc.$id, action: "created", slug });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
