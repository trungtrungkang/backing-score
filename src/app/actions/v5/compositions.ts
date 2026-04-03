"use server";

import { getDb } from "@/db";
import { wikiCompositions } from "@/db/schema/wiki";
import { eq, like, gt } from "drizzle-orm";
import type { CompositionDocument } from "@/lib/appwrite/types";

function mockFormat(row: any): CompositionDocument {
  return {
    $id: row.id,
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString(),
    slug: row.slug,
    title: row.title,
    year: row.year,
    period: row.period,
    genreId: row.genreId,
    keySignature: row.keySignature,
    description: row.description,
  } as unknown as CompositionDocument;
}

export async function getCompositionBySlugV5(slug: string): Promise<CompositionDocument | null> {
  const db = getDb();
  const results = await db.select().from(wikiCompositions).where(eq(wikiCompositions.slug, slug)).limit(1);
  if (results.length === 0) return null;
  return mockFormat(results[0]);
}

export async function listCompositionsV5(limit = 20, cursor?: string): Promise<CompositionDocument[]> {
  const db = getDb();
  let query = db.select().from(wikiCompositions).orderBy(wikiCompositions.title).limit(limit);
  
  if (cursor) {
    query = db.select().from(wikiCompositions).where(gt(wikiCompositions.id, cursor)).orderBy(wikiCompositions.id).limit(limit);
  }
  
  const results = await query;
  return results.map(mockFormat);
}

export async function listCompositionsByGenreV5(genreId: string, limit = 20): Promise<CompositionDocument[]> {
  const db = getDb();
  const results = await db
    .select()
    .from(wikiCompositions)
    .where(eq(wikiCompositions.genreId, genreId))
    .orderBy(wikiCompositions.title)
    .limit(limit);
  
  return results.map(mockFormat);
}

export async function searchCompositionsV5(term: string, limit = 20): Promise<CompositionDocument[]> {
  const db = getDb();
  const results = await db
    .select()
    .from(wikiCompositions)
    .where(like(wikiCompositions.title, `%${term}%`))
    .limit(limit);
  
  return results.map(mockFormat);
}
