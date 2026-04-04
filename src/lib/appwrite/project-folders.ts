import * as D1 from "@/app/actions/v5/project-folders";
import type { ProjectFolderDocument } from "./types";

export async function createProjectFolder(name: string, parentFolderId?: string | null): Promise<ProjectFolderDocument> {
  return D1.createProjectFolderV5(name, parentFolderId, undefined);
}

import { withDedup } from "../promise-dedup";

export const listProjectFolders = withDedup("listProjectFolders", async function listProjectFolders(): Promise<ProjectFolderDocument[]> {
  return D1.listProjectFoldersV5(undefined);
});

export async function updateProjectFolder(folderId: string, name?: string, parentFolderId?: string | null): Promise<ProjectFolderDocument> {
  return D1.updateProjectFolderV5(folderId, name, parentFolderId, undefined);
}

export async function deleteProjectFolder(folderId: string): Promise<void> {
  return D1.deleteProjectFolderV5(folderId, undefined);
}

export async function moveProjectToFolder(projectId: string, folderId: string | null): Promise<void> {
  return D1.moveProjectToFolderV5(projectId, folderId, undefined);
}
