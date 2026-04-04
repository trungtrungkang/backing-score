export const runtime = "edge";
/**
 * Server-side API for searching Wikipedia.
 *
 * GET  /api/wiki-search?q=...&type=composition  → search Wikipedia
 * POST /api/wiki-search                          → save to Appwrite (Temporarily disabled)
 */

import { NextRequest, NextResponse } from "next/server";

const WIKI_API = "https://en.wikipedia.org/api/rest_v1/page/summary";
const WIKI_SEARCH_API = "https://en.wikipedia.org/w/api.php";
const USER_AGENT = "BackingAndScore/1.0 (music-encyclopedia; educational)";

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
  return NextResponse.json({ error: "Permanently disabled due to DB migration" }, { status: 501 });
}
