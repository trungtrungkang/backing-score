/**
 * Project CRUD and list APIs for Backing & Score.
 * Call from client only (session required). Uses document permissions for owner access.
 */

import {
  account,
  databases,
  ID,
  Query,
  Permission,
  Role,
} from "./client";
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_PROJECTS_COLLECTION_ID,
} from "./constants";
import type { ProjectDocument, ProjectPayload } from "./types";
import { getArtistNamesByIds } from "./artists";

function removeDiacritics(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

async function buildSearchString(
  name: string,
  description?: string,
  tags?: string[],
  creatorEmail?: string,
  wikiComposerIds?: string[]
): Promise<string> {
  let composerNamesStr = "";
  if (wikiComposerIds && wikiComposerIds.length > 0) {
    try {
      const nameMap = await getArtistNamesByIds(wikiComposerIds);
      composerNamesStr = Array.from(nameMap.values()).join(" ");
    } catch (e) {
      console.error("Failed to fetch composer names for search string", e);
    }
  }
  const rawString = `${name || ""} ${description || ""} ${composerNamesStr} ${(tags || []).join(" ")} ${creatorEmail || ""}`;
  return removeDiacritics(rawString);
}

const dbId = APPWRITE_DATABASE_ID;
const collId = APPWRITE_PROJECTS_COLLECTION_ID;

/** Create a new project. Caller must be logged in. */
export async function createProject(params: {
  name: string;
  mode: ProjectDocument["mode"];
  payload: ProjectPayload;
  payloadVersion?: number;
  tags?: string[];
  wikiGenreId?: string;
  wikiInstrumentIds?: string[];
  wikiCompositionId?: string;
  wikiComposerIds?: string[];
}): Promise<ProjectDocument> {
  const user = await account.get();
  const searchString = await buildSearchString(
    params.name,
    "",
    params.tags,
    user.email,
    params.wikiComposerIds
  );
  
  const payloadStr = JSON.stringify(params.payload);
  const doc = await databases.createDocument(
    dbId,
    collId,
    ID.unique(),
    {
      userId: user.$id,
      name: params.name,
      mode: params.mode,
      payload: payloadStr,
      payloadVersion: params.payloadVersion ?? 1,
      published: false,
      creatorEmail: user.email,
      tags: params.tags || [],
      searchString,
      ...(params.wikiGenreId && { wikiGenreId: params.wikiGenreId }),
      ...(params.wikiInstrumentIds?.length && { wikiInstrumentIds: params.wikiInstrumentIds }),
      ...(params.wikiCompositionId && { wikiCompositionId: params.wikiCompositionId }),
      ...(params.wikiComposerIds?.length && { wikiComposerIds: params.wikiComposerIds }),
    },
    [
      Permission.read(Role.user(user.$id)),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ]
  );
  return doc as unknown as ProjectDocument;
}

/** Update an existing project. Caller must be owner. When publishing, pass permissions so anyone can read (Discovery). */
export async function updateProject(
  projectId: string,
  updates: {
    name?: string;
    mode?: ProjectDocument["mode"];
    payload?: ProjectPayload | string;
    payloadVersion?: number;
    published?: boolean;
    publishedAt?: string;
    coverUrl?: string;
    description?: string;
    tags?: string[];
    wikiGenreId?: string;
    wikiInstrumentIds?: string[];
    wikiCompositionId?: string;
    wikiComposerIds?: string[];
  },
  /** When publishing, pass [owner read/update/delete, read(any)] so Discovery can read. */
  permissions?: string[]
): Promise<ProjectDocument> {
  const body: Record<string, unknown> = {};
  if (updates.name !== undefined) body.name = updates.name;
  if (updates.mode !== undefined) body.mode = updates.mode;
  if (updates.payload !== undefined) {
    body.payload =
      typeof updates.payload === "string"
        ? updates.payload
        : JSON.stringify(updates.payload);
  }
  if (updates.payloadVersion !== undefined)
    body.payloadVersion = updates.payloadVersion;
  if (updates.published !== undefined) body.published = updates.published;
  if (updates.publishedAt !== undefined) body.publishedAt = updates.publishedAt;
  if (updates.coverUrl !== undefined) body.coverUrl = updates.coverUrl;
  if (updates.description !== undefined) body.description = updates.description;
  if (updates.tags !== undefined) body.tags = updates.tags;
  if (updates.wikiGenreId !== undefined) body.wikiGenreId = updates.wikiGenreId;
  if (updates.wikiInstrumentIds !== undefined) body.wikiInstrumentIds = updates.wikiInstrumentIds;
  if (updates.wikiCompositionId !== undefined) body.wikiCompositionId = updates.wikiCompositionId;
  if (updates.wikiComposerIds !== undefined) body.wikiComposerIds = updates.wikiComposerIds;

  const needsSearchUpdate = updates.name !== undefined || updates.description !== undefined || updates.tags !== undefined || updates.wikiComposerIds !== undefined;
  if (needsSearchUpdate) {
    const current = await getProject(projectId);
    body.searchString = await buildSearchString(
      updates.name ?? current.name,
      updates.description ?? current.description,
      updates.tags ?? current.tags,
      current.creatorEmail,
      updates.wikiComposerIds ?? current.wikiComposerIds
    );
  }

  const doc = await databases.updateDocument(dbId, collId, projectId, body, permissions);
  return doc as unknown as ProjectDocument;
}

/** Get a single project by ID. Read permission: owner or published. */
export async function getProject(projectId: string): Promise<ProjectDocument> {
  const doc = await databases.getDocument(dbId, collId, projectId);
  return doc as unknown as ProjectDocument;
}

/** List projects owned by the current user (My projects). */
export async function listMyProjects(tagFilters?: string[]): Promise<ProjectDocument[]> {
  const user = await account.get();
  const queries = [
    Query.equal("userId", user.$id),
    Query.orderDesc("$updatedAt"),
    Query.limit(100),
  ];
  if (tagFilters && tagFilters.length > 0) {
    tagFilters.forEach(tag => {
      if (tag !== "All") queries.push(Query.contains("tags", [tag]));
    });
  }
  const { documents } = await databases.listDocuments(dbId, collId, queries);
  return documents as unknown as ProjectDocument[];
}

/** List published projects for Discovery. Supports both legacy tag filters and wiki entity filters. */
export async function listPublished(
  tagFilters?: string[],
  authorId?: string,
  wikiFilters?: { genreId?: string; instrumentIds?: string[] },
  searchQuery?: string
): Promise<ProjectDocument[]> {
  const queries = [
    Query.equal("published", true),
    Query.orderDesc("publishedAt"),
    Query.limit(50),
  ];
  if (searchQuery) {
    queries.push(Query.search("searchString", removeDiacritics(searchQuery)));
  }
  if (authorId) queries.push(Query.equal("userId", authorId));
  if (tagFilters && tagFilters.length > 0) {
    tagFilters.forEach(tag => {
      if (tag !== "All") queries.push(Query.contains("tags", [tag]));
    });
  }
  if (wikiFilters?.genreId) {
    queries.push(Query.equal("wikiGenreId", wikiFilters.genreId));
  }
  if (wikiFilters?.instrumentIds?.length) {
    queries.push(Query.contains("wikiInstrumentIds", wikiFilters.instrumentIds));
  }
  const { documents } = await databases.listDocuments(dbId, collId, queries);
  return documents as unknown as ProjectDocument[];
}

/** Delete a project. Caller must be owner. */
export async function deleteProject(projectId: string): Promise<void> {
  await databases.deleteDocument(dbId, collId, projectId);
}

/**
 * Copy a published project into the current user's projects (for "Copy to my projects" from Discovery).
 * Creates a new project with same name (suffix " (copy)"), mode, and payload; published = false.
 */
export async function copyProjectToMine(projectId: string): Promise<ProjectDocument> {
  const user = await account.get();
  const source = await getProject(projectId);
  if (!source.published) {
    throw new Error("Project is not published");
  }
  let payload: ProjectPayload;
  try {
    payload = JSON.parse(source.payload) as ProjectPayload;
  } catch {
    payload = { version: 1 };
  }
  const name = source.name.trim().replace(/\s*\(copy(?:\s+\d+)?\)\s*$/i, "").trim() || "Untitled";
  const copyName = `${name} (copy)`;
  return createProject({
    name: copyName,
    mode: source.mode,
    payload,
    payloadVersion: source.payloadVersion,
    tags: source.tags || [],
    wikiGenreId: source.wikiGenreId,
    wikiInstrumentIds: source.wikiInstrumentIds,
    wikiCompositionId: source.wikiCompositionId,
    wikiComposerIds: source.wikiComposerIds,
  });
}

/** List published projects linked to a specific wiki composition. */
export async function listProjectsByComposition(compositionId: string, limit = 20): Promise<ProjectDocument[]> {
  const queries = [
    Query.equal("published", true),
    Query.equal("wikiCompositionId", compositionId),
    Query.orderDesc("publishedAt"),
    Query.limit(limit),
  ];
  const { documents } = await databases.listDocuments(dbId, collId, queries);
  return documents as unknown as ProjectDocument[];
}

/**
 * Increment the play count for a published project.
 * Called client-side when a user plays a score. Non-blocking, fire-and-forget.
 */
export async function incrementPlayCount(projectId: string): Promise<void> {
  try {
    const doc = await databases.getDocument(dbId, collId, projectId);
    const currentCount = (doc as any).playCount ?? 0;
    await databases.updateDocument(dbId, collId, projectId, {
      playCount: currentCount + 1,
    });
  } catch {
    // Non-critical — silently fail
  }
}

/** List published projects linked to a specific wiki artist (as composer). */
export async function listProjectsByArtist(artistId: string, limit = 20): Promise<ProjectDocument[]> {
  const queries = [
    Query.equal("published", true),
    Query.contains("wikiComposerIds", [artistId]),
    Query.orderDesc("publishedAt"),
    Query.limit(limit),
  ];
  const { documents } = await databases.listDocuments(dbId, collId, queries);
  return documents as unknown as ProjectDocument[];
}

