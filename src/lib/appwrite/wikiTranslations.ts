/**
 * Wiki Translations API for Backing & Score Encyclopedia.
 * Handles fetching localized content for wiki entities using the Translation Overlay pattern.
 */

import { databases, Query } from "./client";
import { APPWRITE_DATABASE_ID as DB, APPWRITE_WIKI_TRANSLATIONS_COLLECTION_ID as COLL } from "./constants";
import type { WikiTranslationDocument, WikiEntityType } from "./types";

/**
 * Get all translations for a specific entity in a given locale.
 * Returns a map of field → translated value.
 */
export async function getTranslationsForEntity(
  entityId: string,
  locale: string
): Promise<Record<string, string>> {
  if (locale === "en") return {}; // English is the default, no overlay needed

  try {
    const { documents } = await databases.listDocuments(DB, COLL, [
      Query.equal("entityId", entityId),
      Query.equal("locale", locale),
      Query.limit(50),
    ]);
    const map: Record<string, string> = {};
    for (const doc of documents as unknown as WikiTranslationDocument[]) {
      map[doc.field] = doc.value;
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * List all translations for a specific entity (all locales).
 */
export async function listTranslationsForEntity(
  entityId: string
): Promise<WikiTranslationDocument[]> {
  try {
    const { documents } = await databases.listDocuments(DB, COLL, [
      Query.equal("entityId", entityId),
      Query.limit(100),
    ]);
    return documents as unknown as WikiTranslationDocument[];
  } catch {
    return [];
  }
}

/**
 * Apply translations overlay on an entity document.
 * Replaces field values with translations where available.
 */
export function applyTranslations<T extends Record<string, any>>(
  entity: T,
  translations: Record<string, string>
): T {
  if (Object.keys(translations).length === 0) return entity;
  const result = { ...entity };
  for (const [field, value] of Object.entries(translations)) {
    if (field in result) {
      (result as any)[field] = value;
    }
  }
  return result;
}
