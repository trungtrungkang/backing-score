"use server";

import { getDb } from "@/db";
import { wikiInstruments } from "@/db/schema/wiki";
import { eq, desc, gt } from "drizzle-orm";
import type { InstrumentDocument } from "@/lib/appwrite/types";

// Mock formatter to keep UI unchanged
function mockFormat(row: any): InstrumentDocument {
  return {
    $id: row.id,
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString(),
    slug: row.slug,
    name: row.name,
    family: row.family,
    description: row.description,
    imageUrl: row.imageUrl,
    tuning: row.tuning,
  } as unknown as InstrumentDocument;
}

export async function getInstrumentBySlugV5(slug: string): Promise<InstrumentDocument | null> {
  const db = getDb();
  const results = await db.select().from(wikiInstruments).where(eq(wikiInstruments.slug, slug)).limit(1);
  if (results.length === 0) return null;
  return mockFormat(results[0]);
}

export async function listInstrumentsV5(limit = 20, cursor?: string): Promise<InstrumentDocument[]> {
  const db = getDb();
  let query = db.select().from(wikiInstruments).orderBy(wikiInstruments.name).limit(limit);
  
  if (cursor) {
    query = db.select().from(wikiInstruments).where(gt(wikiInstruments.id, cursor)).orderBy(wikiInstruments.id).limit(limit);
  }
  
  const results = await query;
  return results.map(mockFormat);
}

export async function listInstrumentsByFamilyV5(family: string, limit = 20): Promise<InstrumentDocument[]> {
  const db = getDb();
  const results = await db
    .select()
    .from(wikiInstruments)
    .where(eq(wikiInstruments.family, family))
    .orderBy(wikiInstruments.name)
    .limit(limit);
  
  return results.map(mockFormat);
}
