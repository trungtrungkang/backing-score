/**
 * Wiki Genres CRUD API for Backing & Score Encyclopedia.
 */

import { databases, Query } from "./client";
import { APPWRITE_DATABASE_ID as DB, APPWRITE_WIKI_GENRES_COLLECTION_ID as COLL } from "./constants";
import type { GenreDocument } from "./types";

export async function getGenreBySlug(slug: string): Promise<GenreDocument | null> {
  try {
    const { documents } = await databases.listDocuments(DB, COLL, [
      Query.equal("slug", slug),
      Query.limit(1),
    ]);
    return (documents[0] as unknown as GenreDocument) ?? null;
  } catch {
    return null;
  }
}

export async function listGenres(limit = 50): Promise<GenreDocument[]> {
  try {
    const { documents } = await databases.listDocuments(DB, COLL, [
      Query.orderAsc("name"),
      Query.limit(limit),
    ]);
    return documents as unknown as GenreDocument[];
  } catch {
    return [];
  }
}

export async function listSubGenres(parentGenreId: string): Promise<GenreDocument[]> {
  try {
    const { documents } = await databases.listDocuments(DB, COLL, [
      Query.equal("parentGenreId", parentGenreId),
      Query.orderAsc("name"),
      Query.limit(50),
    ]);
    return documents as unknown as GenreDocument[];
  } catch {
    return [];
  }
}
