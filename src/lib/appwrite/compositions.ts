/**
 * Wiki Compositions CRUD API for Backing & Score Encyclopedia.
 */

import { databases, Query } from "./client";
import { APPWRITE_DATABASE_ID as DB, APPWRITE_WIKI_COMPOSITIONS_COLLECTION_ID as COLL } from "./constants";
import type { CompositionDocument } from "./types";

export async function getCompositionBySlug(slug: string): Promise<CompositionDocument | null> {
  try {
    const { documents } = await databases.listDocuments(DB, COLL, [
      Query.equal("slug", slug),
      Query.limit(1),
    ]);
    return (documents[0] as unknown as CompositionDocument) ?? null;
  } catch {
    return null;
  }
}

export async function listCompositions(limit = 20, cursor?: string): Promise<CompositionDocument[]> {
  try {
    const queries = [Query.orderAsc("title"), Query.limit(limit)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const { documents } = await databases.listDocuments(DB, COLL, queries);
    return documents as unknown as CompositionDocument[];
  } catch {
    return [];
  }
}

export async function listCompositionsByGenre(genreId: string, limit = 20): Promise<CompositionDocument[]> {
  try {
    const { documents } = await databases.listDocuments(DB, COLL, [
      Query.equal("genreId", genreId),
      Query.orderAsc("title"),
      Query.limit(limit),
    ]);
    return documents as unknown as CompositionDocument[];
  } catch {
    return [];
  }
}

export async function searchCompositions(term: string, limit = 20): Promise<CompositionDocument[]> {
  try {
    const { documents } = await databases.listDocuments(DB, COLL, [
      Query.search("title", term),
      Query.limit(limit),
    ]);
    return documents as unknown as CompositionDocument[];
  } catch {
    return [];
  }
}
