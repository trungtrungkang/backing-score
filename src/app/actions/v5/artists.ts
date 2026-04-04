"use server";

import { getDb } from "@/db";
import { wikiArtists } from "@/db/schema/wiki";
import { eq, like, desc, inArray, gt } from "drizzle-orm";
import type { ArtistDocument } from "@/lib/appwrite/types";

// Mock formatter to keep UI unchanged
function mockFormat(row: any): ArtistDocument {
  return {
    $id: row.id,
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString(),
    slug: row.slug,
    name: row.name,
    nameOriginal: row.nameOriginal,
    bio: row.bio,
    birthDate: row.birthDate,
    deathDate: row.deathDate,
    nationality: row.nationality,
    roles: typeof row.roles === "string" ? JSON.parse(row.roles) : (row.roles || []),
    imageUrl: row.imageUrl,
    coverUrl: row.coverUrl,
    wikipediaUrl: "",
    imslpUrl: "",
  } as unknown as ArtistDocument;
}

export async function getArtistBySlugV5(slug: string): Promise<ArtistDocument | null> {
  const db = getDb();
  const results = await db.select().from(wikiArtists).where(eq(wikiArtists.slug, slug)).limit(1);
  if (results.length === 0) return null;
  return mockFormat(results[0]);
}

export async function listArtistsV5(limit = 20, cursor?: string): Promise<ArtistDocument[]> {
  const db = getDb();
  let query: any = db.select().from(wikiArtists).orderBy(wikiArtists.name).limit(limit);
  
  // Note: Standard pagination often uses offset, but cursor is requested. 
  // For alphabetical order, cursorAfter would literally be name > cursorName 
  if (cursor) {
    // If it's a cursor ID, we should technically pull the doc and find name > X.
    // For simplicity with UI, we'll try to find id > cursor.
    query = db.select().from(wikiArtists).where(gt(wikiArtists.id, cursor)).orderBy(wikiArtists.id).limit(limit);
  }
  
  const results = await query;
  return results.map(mockFormat);
}

export async function searchArtistsV5(term: string, limit = 20): Promise<ArtistDocument[]> {
  const db = getDb();
  const results = await db
    .select()
    .from(wikiArtists)
    .where(like(wikiArtists.name, `%${term}%`))
    .limit(limit);
  
  return results.map(mockFormat);
}

export async function getArtistNamesByIdsV5(ids: string[]): Promise<Map<string, string>> {
  const db = getDb();
  const map = new Map<string, string>();
  if (!ids || ids.length === 0) return map;
  
  const uniqueIds = [...new Set(ids)];
  const results = await db.select().from(wikiArtists).where(inArray(wikiArtists.id, uniqueIds)).limit(uniqueIds.length);
  
  for (const row of results) {
    map.set(row.id, row.name);
  }
  return map;
}
