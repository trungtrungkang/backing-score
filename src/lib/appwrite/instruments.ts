/**
 * Wiki Instruments CRUD API for Backing & Score Encyclopedia.
 */

import { databases, Query } from "./client";
import { APPWRITE_DATABASE_ID as DB, APPWRITE_WIKI_INSTRUMENTS_COLLECTION_ID as COLL } from "./constants";
import type { InstrumentDocument } from "./types";

export async function getInstrumentBySlug(slug: string): Promise<InstrumentDocument | null> {
  try {
    const { documents } = await databases.listDocuments(DB, COLL, [
      Query.equal("slug", slug),
      Query.limit(1),
    ]);
    return (documents[0] as unknown as InstrumentDocument) ?? null;
  } catch {
    return null;
  }
}

export async function listInstruments(limit = 20, cursor?: string): Promise<InstrumentDocument[]> {
  try {
    const queries = [Query.orderAsc("name"), Query.limit(limit)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const { documents } = await databases.listDocuments(DB, COLL, queries);
    return documents as unknown as InstrumentDocument[];
  } catch {
    return [];
  }
}

export async function listInstrumentsByFamily(family: string, limit = 20): Promise<InstrumentDocument[]> {
  try {
    const { documents } = await databases.listDocuments(DB, COLL, [
      Query.equal("family", family),
      Query.orderAsc("name"),
      Query.limit(limit),
    ]);
    return documents as unknown as InstrumentDocument[];
  } catch {
    return [];
  }
}
