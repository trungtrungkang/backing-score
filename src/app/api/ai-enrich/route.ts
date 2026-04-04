export const runtime = "edge";
/**
 * AI Enrich API route.
 * POST /api/ai-enrich
 * Body: { projectId: string } or { projectIds: string[] }
 * Returns enrichment suggestions without saving (admin reviews first).
 */

import { NextRequest, NextResponse } from "next/server";
import { Client, Databases, Query } from "@/lib/appwrite/client";
import { enrichProject, type EnrichmentInput } from "@/lib/ai/gemini";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";
const PROJECTS_COLLECTION = process.env.NEXT_PUBLIC_APPWRITE_PROJECTS_COLLECTION_ID || "projects";

function getServerClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(client);
}

async function resolveComposerName(databases: Databases, composerIds?: string[]): Promise<string | undefined> {
  if (!composerIds?.length) return undefined;
  try {
    const res = await databases.listDocuments(DB, "wiki_artists", [
      Query.equal("$id", composerIds),
      Query.limit(5),
    ]);
    return res.documents.map((d: any) => d.name).join(", ");
  } catch {
    return undefined;
  }
}

function extractMetadataFromPayload(payloadStr: string): { keySignature?: string; instruments?: string[]; tempo?: number } {
  try {
    const payload = JSON.parse(payloadStr);
    return {
      keySignature: payload?.metadata?.keySignature,
      instruments: payload?.metadata?.instruments,
      tempo: payload?.metadata?.tempo,
    };
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as any;
    const projectIds: string[] = body.projectIds || (body.projectId ? [body.projectId] : []);

    if (!projectIds.length) {
      return NextResponse.json({ error: "No projectId(s) provided" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const databases = getServerClient();
    const results: Record<string, any> = {};

    for (const projectId of projectIds) {
      try {
        // Fetch project
        const project = await databases.getDocument(DB, PROJECTS_COLLECTION, projectId);

        // Resolve wiki composer name
        const composerName = await resolveComposerName(databases, (project as any).wikiComposerIds);

        // Extract metadata from payload
        const payloadMeta = extractMetadataFromPayload((project as any).payload || "{}");

        // Build enrichment input
        const input: EnrichmentInput = {
          name: (project as any).name,
          composerName,
          keySignature: payloadMeta.keySignature,
          instruments: payloadMeta.instruments,
          tempo: payloadMeta.tempo,
          existingDescription: (project as any).description,
          existingTags: (project as any).tags,
        };

        // Call Gemini
        const enrichment = await enrichProject(input);
        results[projectId] = { status: "ok", ...enrichment };
      } catch (err: any) {
        results[projectId] = { status: "error", error: err.message };
      }
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
