/**
 * Wiki Artists CRUD API for Backing & Score Encyclopedia.
 */

import { databases, Query } from "./client";
import { APPWRITE_DATABASE_ID as DB, APPWRITE_WIKI_ARTISTS_COLLECTION_ID as COLL } from "./constants";
import type { ArtistDocument } from "./types";

export async function getArtistBySlug(slug: string): Promise<ArtistDocument | null> {
  try {
    const { documents } = await databases.listDocuments(DB, COLL, [
      Query.equal("slug", slug),
      Query.limit(1),
    ]);
    return (documents[0] as unknown as ArtistDocument) ?? null;
  } catch {
    return null;
  }
}

export async function listArtists(limit = 20, cursor?: string): Promise<ArtistDocument[]> {
  try {
    const queries = [Query.orderAsc("name"), Query.limit(limit)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const { documents } = await databases.listDocuments(DB, COLL, queries);
    return documents as unknown as ArtistDocument[];
  } catch {
    return [];
  }
}

export async function searchArtists(term: string, limit = 20): Promise<ArtistDocument[]> {
  try {
    const { documents } = await databases.listDocuments(DB, COLL, [
      Query.search("name", term),
      Query.limit(limit),
    ]);
    return documents as unknown as ArtistDocument[];
  } catch {
    return [];
  }
}

/** Batch-fetch artists by their IDs. Returns a Map of id → name. */
export async function getArtistNamesByIds(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  try {
    const unique = [...new Set(ids)];
    // Appwrite Query.equal supports array of values
    const { documents } = await databases.listDocuments(DB, COLL, [
      Query.equal("$id", unique),
      Query.limit(unique.length),
    ]);
    for (const doc of documents) {
      map.set(doc.$id, (doc as unknown as ArtistDocument).name);
    }
  } catch {}
  return map;
}
