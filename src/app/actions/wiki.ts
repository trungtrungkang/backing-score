"use server";

import { Client as ServerClient, Databases, ID, Permission, Role, Account } from "node-appwrite";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";

/**
 * Validates that the JWT belongs to a user with "admin" or "wiki_editor" label.
 */
async function requireWikiEditor(jwt: string) {
  if (!process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || !process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID) {
    throw new Error("Missing Server Configuration for Appwrite.");
  }
  const jwtClient = new ServerClient()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
    .setJWT(jwt);
  const user = await new Account(jwtClient).get();
  const labels = user.labels || [];
  if (!labels.includes("admin") && !labels.includes("wiki_editor")) {
    throw new Error("Unauthorized: You need admin or wiki_editor role.");
  }
}

function getAdminDb() {
  const client = new ServerClient()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(client);
}

// ── Generic helpers ──────────────────────────────────────────────────────────

async function createWikiDoc(jwt: string, collectionId: string, data: Record<string, unknown>) {
  await requireWikiEditor(jwt);
  const db = getAdminDb();
  const doc = await db.createDocument(DB, collectionId, ID.unique(), data, [Permission.read(Role.any())]);
  return { id: doc.$id };
}

async function updateWikiDoc(jwt: string, collectionId: string, docId: string, data: Record<string, unknown>) {
  await requireWikiEditor(jwt);
  const db = getAdminDb();
  await db.updateDocument(DB, collectionId, docId, data);
  return { success: true };
}

async function deleteWikiDoc(jwt: string, collectionId: string, docId: string) {
  await requireWikiEditor(jwt);
  const db = getAdminDb();
  await db.deleteDocument(DB, collectionId, docId);
  return { success: true };
}

// ── Artists ───────────────────────────────────────────────────────────────────

export async function createArtist(jwt: string, data: Record<string, unknown>) {
  return createWikiDoc(jwt, "wiki_artists", data);
}

export async function updateArtist(jwt: string, id: string, data: Record<string, unknown>) {
  return updateWikiDoc(jwt, "wiki_artists", id, data);
}

export async function deleteArtist(jwt: string, id: string) {
  return deleteWikiDoc(jwt, "wiki_artists", id);
}

// ── Instruments ──────────────────────────────────────────────────────────────

export async function createInstrument(jwt: string, data: Record<string, unknown>) {
  return createWikiDoc(jwt, "wiki_instruments", data);
}

export async function updateInstrument(jwt: string, id: string, data: Record<string, unknown>) {
  return updateWikiDoc(jwt, "wiki_instruments", id, data);
}

export async function deleteInstrument(jwt: string, id: string) {
  return deleteWikiDoc(jwt, "wiki_instruments", id);
}

// ── Compositions ─────────────────────────────────────────────────────────────

export async function createComposition(jwt: string, data: Record<string, unknown>) {
  return createWikiDoc(jwt, "wiki_compositions", data);
}

export async function updateComposition(jwt: string, id: string, data: Record<string, unknown>) {
  return updateWikiDoc(jwt, "wiki_compositions", id, data);
}

export async function deleteComposition(jwt: string, id: string) {
  return deleteWikiDoc(jwt, "wiki_compositions", id);
}

// ── Genres ────────────────────────────────────────────────────────────────────

export async function createGenre(jwt: string, data: Record<string, unknown>) {
  return createWikiDoc(jwt, "wiki_genres", data);
}

export async function updateGenre(jwt: string, id: string, data: Record<string, unknown>) {
  return updateWikiDoc(jwt, "wiki_genres", id, data);
}

export async function deleteGenre(jwt: string, id: string) {
  return deleteWikiDoc(jwt, "wiki_genres", id);
}

// ── Translations ─────────────────────────────────────────────────────────────

import { Query } from "node-appwrite";

const TRANSLATIONS_COLL = "wiki_translations";

/**
 * Upsert a translation for a wiki entity field.
 * If translation already exists (same entityId+locale+field), update it; otherwise create.
 */
export async function upsertTranslation(
  jwt: string,
  entityId: string,
  entityType: string,
  locale: string,
  field: string,
  value: string
) {
  await requireWikiEditor(jwt);
  const db = getAdminDb();

  // Check if translation already exists
  const { documents } = await db.listDocuments(DB, TRANSLATIONS_COLL, [
    Query.equal("entityId", entityId),
    Query.equal("locale", locale),
    Query.equal("field", field),
    Query.limit(1),
  ]);

  if (documents.length > 0) {
    await db.updateDocument(DB, TRANSLATIONS_COLL, documents[0].$id, { value });
    return { id: documents[0].$id, updated: true };
  } else {
    const doc = await db.createDocument(DB, TRANSLATIONS_COLL, ID.unique(), {
      entityId,
      entityType,
      locale,
      field,
      value,
    }, [Permission.read(Role.any())]);
    return { id: doc.$id, updated: false };
  }
}

/**
 * Delete a specific translation document.
 */
export async function deleteTranslation(jwt: string, translationId: string) {
  return deleteWikiDoc(jwt, TRANSLATIONS_COLL, translationId);
}
