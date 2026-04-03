"use server";

import { getDb } from "@/db";
import { wikiGenres } from "@/db/schema/wiki";
import { eq, gt } from "drizzle-orm";
import type { GenreDocument } from "@/lib/appwrite/types";

function mockFormat(row: any): GenreDocument {
  return {
    $id: row.id,
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString(),
    slug: row.slug,
    name: row.name,
    description: row.description,
    parentGenreId: row.parentGenreId,
    era: row.era,
  } as unknown as GenreDocument;
}

export async function getGenreBySlugV5(slug: string): Promise<GenreDocument | null> {
  const db = getDb();
  const results = await db.select().from(wikiGenres).where(eq(wikiGenres.slug, slug)).limit(1);
  if (results.length === 0) return null;
  return mockFormat(results[0]);
}

export async function listGenresV5(limit = 50): Promise<GenreDocument[]> {
  const db = getDb();
  const results = await db.select().from(wikiGenres).orderBy(wikiGenres.name).limit(limit);
  return results.map(mockFormat);
}

export async function listSubGenresV5(parentGenreId: string): Promise<GenreDocument[]> {
  const db = getDb();
  const results = await db
    .select()
    .from(wikiGenres)
    .where(eq(wikiGenres.parentGenreId, parentGenreId))
    .orderBy(wikiGenres.name)
    .limit(50);
  
  return results.map(mockFormat);
}
