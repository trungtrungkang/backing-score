import { account } from "./client";
import { isAppwriteConfigured } from "./constants";
import * as D1 from "@/app/actions/v5/project-folders";
import type { ProjectFolderDocument } from "./types";

async function getUserIdFallback() {
  if (!isAppwriteConfigured()) return undefined;
  try {
    const user = await account.get();
    return user.$id;
  } catch {
    return undefined;
  }
}

export async function createProjectFolder(name: string, parentFolderId?: string | null): Promise<ProjectFolderDocument> {
  return D1.createProjectFolderV5(name, parentFolderId, await getUserIdFallback());
}

export async function listProjectFolders(): Promise<ProjectFolderDocument[]> {
  return D1.listProjectFoldersV5(await getUserIdFallback());
}

export async function updateProjectFolder(folderId: string, name?: string, parentFolderId?: string | null): Promise<ProjectFolderDocument> {
  return D1.updateProjectFolderV5(folderId, name, parentFolderId, await getUserIdFallback());
}

export async function deleteProjectFolder(folderId: string): Promise<void> {
  return D1.deleteProjectFolderV5(folderId, await getUserIdFallback());
}

export async function moveProjectToFolder(projectId: string, folderId: string | null): Promise<void> {
  return D1.moveProjectToFolderV5(projectId, folderId, await getUserIdFallback());
}
