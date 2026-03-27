/**
 * Project Folder CRUD for My Uploads.
 * Folders organize user's projects in the dashboard.
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
  APPWRITE_PROJECT_FOLDERS_COLLECTION_ID,
  APPWRITE_PROJECTS_COLLECTION_ID,
} from "./constants";
import type { ProjectFolderDocument } from "./types";

const dbId = APPWRITE_DATABASE_ID;
const collId = APPWRITE_PROJECT_FOLDERS_COLLECTION_ID;
const projectsCollId = APPWRITE_PROJECTS_COLLECTION_ID;

/** Create a folder for the current user. */
export async function createProjectFolder(name: string): Promise<ProjectFolderDocument> {
  const user = await account.get();
  const doc = await databases.createDocument(
    dbId,
    collId,
    ID.unique(),
    { userId: user.$id, name, order: 0 },
    [
      Permission.read(Role.user(user.$id)),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ]
  );
  return doc as unknown as ProjectFolderDocument;
}

/** List folders belonging to the current user. */
export async function listProjectFolders(): Promise<ProjectFolderDocument[]> {
  const user = await account.get();
  const { documents } = await databases.listDocuments(dbId, collId, [
    Query.equal("userId", user.$id),
    Query.orderAsc("order"),
    Query.limit(100),
  ]);
  return documents as unknown as ProjectFolderDocument[];
}

/** Update a folder name. */
export async function updateProjectFolder(
  folderId: string,
  name: string
): Promise<ProjectFolderDocument> {
  const doc = await databases.updateDocument(dbId, collId, folderId, { name });
  return doc as unknown as ProjectFolderDocument;
}

/** Delete a folder. Projects inside are unfiled (folderId → null), not deleted. */
export async function deleteProjectFolder(folderId: string): Promise<void> {
  // Unfile projects in this folder
  try {
    const { documents } = await databases.listDocuments(dbId, projectsCollId, [
      Query.equal("folderId", folderId),
      Query.limit(200),
    ]);
    await Promise.all(
      documents.map(p => databases.updateDocument(dbId, projectsCollId, p.$id, { folderId: null }))
    );
  } catch { /* best-effort */ }

  await databases.deleteDocument(dbId, collId, folderId);
}

/** Move a project to a folder (or null to unfile). */
export async function moveProjectToFolder(
  projectId: string,
  folderId: string | null
): Promise<void> {
  await databases.updateDocument(dbId, projectsCollId, projectId, { folderId });
}
