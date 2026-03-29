/**
 * Playlists CRUD and list APIs for Backing & Score.
 * Uses Appwrite Client SDK directly.
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
  APPWRITE_PLAYLISTS_COLLECTION_ID,
} from "./constants";
import { buildStandardPermissions, buildPublishedPermissions } from "./permissions";
import type { PlaylistDocument } from "./types";

const dbId = APPWRITE_DATABASE_ID;
const collId = APPWRITE_PLAYLISTS_COLLECTION_ID;

/** Create a fresh personal playlist */
export async function createPlaylist(params: {
  name: string;
  description?: string;
  coverImageId?: string;
}): Promise<PlaylistDocument> {
  const user = await account.get();
  
  const doc = await databases.createDocument(
    dbId,
    collId,
    ID.unique(),
    {
      ownerId: user.$id,
      name: params.name,
      description: params.description || "",
      isPublished: false,
      coverImageId: params.coverImageId || null,
      projectIds: [],
    },
    buildStandardPermissions(user.$id)
  );
  return doc as unknown as PlaylistDocument;
}

/** Update an existing playlist */
export async function updatePlaylist(
  playlistId: string,
  updates: Partial<{
    name: string;
    description: string;
    isPublished: boolean;
    coverImageId: string;
    projectIds: string[];
  }>,
  publishOverride?: boolean
): Promise<PlaylistDocument> {
  const body: Record<string, unknown> = {};
  if (updates.name !== undefined) body.name = updates.name;
  if (updates.description !== undefined) body.description = updates.description;
  if (updates.isPublished !== undefined) body.isPublished = updates.isPublished;
  if (updates.coverImageId !== undefined) body.coverImageId = updates.coverImageId;
  if (updates.projectIds !== undefined) body.projectIds = updates.projectIds;

  let permissions;
  if (publishOverride || updates.isPublished) {
      const user = await account.get();
      permissions = buildPublishedPermissions(user.$id);
  } else if (updates.isPublished === false) {
      const user = await account.get();
      permissions = buildStandardPermissions(user.$id);
  }

  const doc = await databases.updateDocument(dbId, collId, playlistId, body, permissions);
  return doc as unknown as PlaylistDocument;
}

/** Helper directly appends/removes a generic track reference to an existing playlist's string array */
export async function addProjectToPlaylist(playlistId: string, projectId: string): Promise<PlaylistDocument> {
   const pl = await databases.getDocument(dbId, collId, playlistId);
   const currentArr: string[] = pl.projectIds || [];
   if (currentArr.includes(projectId)) return pl as unknown as PlaylistDocument;
   
   currentArr.push(projectId);
   const updated = await databases.updateDocument(dbId, collId, playlistId, { projectIds: currentArr });
   return updated as unknown as PlaylistDocument;
}

export async function removeProjectFromPlaylist(playlistId: string, projectId: string): Promise<PlaylistDocument> {
    const pl = await databases.getDocument(dbId, collId, playlistId);
    let currentArr: string[] = pl.projectIds || [];
    currentArr = currentArr.filter(id => id !== projectId);
    
    const updated = await databases.updateDocument(dbId, collId, playlistId, { projectIds: currentArr });
    return updated as unknown as PlaylistDocument;
}

/** Get a single playlist by ID */
export async function getPlaylist(playlistId: string): Promise<PlaylistDocument> {
  const doc = await databases.getDocument(dbId, collId, playlistId);
  return doc as unknown as PlaylistDocument;
}

/** List private playlists owned by the authenticated user */
export async function listMyPlaylists(): Promise<PlaylistDocument[]> {
  const user = await account.get();
  const { documents } = await databases.listDocuments(dbId, collId, [
    Query.equal("ownerId", user.$id),
    Query.orderDesc("$createdAt"), // Must match our "owner_index"
    Query.limit(100),
  ]);
  return documents as unknown as PlaylistDocument[];
}

/** List Global publicly published Playlists */
export async function listPublishedPlaylists(ownerId?: string): Promise<PlaylistDocument[]> {
  const queries = [
    Query.equal("isPublished", true),
    Query.orderDesc("$createdAt"), // Must match our "published_index"
    Query.limit(50),
  ];
  if (ownerId) {
    queries.push(Query.equal("ownerId", ownerId));
  }
  const { documents } = await databases.listDocuments(dbId, collId, queries);
  return documents as unknown as PlaylistDocument[];
}

/** Delete an entire playlist container natively */
export async function deletePlaylist(playlistId: string): Promise<void> {
  await databases.deleteDocument(dbId, collId, playlistId);
}
