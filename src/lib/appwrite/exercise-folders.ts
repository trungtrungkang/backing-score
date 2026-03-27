/**
 * Exercise Folder CRUD for Classroom Library.
 * Folders organize exercises within a classroom.
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
  APPWRITE_EXERCISE_FOLDERS_COLLECTION_ID,
  APPWRITE_CLASSROOM_EXERCISES_COLLECTION_ID,
} from "./constants";
import type { ExerciseFolderDocument } from "./types";

const dbId = APPWRITE_DATABASE_ID;
const collId = APPWRITE_EXERCISE_FOLDERS_COLLECTION_ID;
const exercisesCollId = APPWRITE_CLASSROOM_EXERCISES_COLLECTION_ID;

/** Create a folder in the classroom library. */
export async function createExerciseFolder(params: {
  classroomId: string;
  name: string;
  parentFolderId?: string | null;
  order?: number;
}): Promise<ExerciseFolderDocument> {
  const user = await account.get();

  const doc = await databases.createDocument(
    dbId,
    collId,
    ID.unique(),
    {
      classroomId: params.classroomId,
      name: params.name,
      parentFolderId: params.parentFolderId || null,
      order: params.order ?? 0,
    },
    [
      Permission.read(Role.users()),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ]
  );
  return doc as unknown as ExerciseFolderDocument;
}

/** List folders in a classroom (optionally filtered by parent). */
export async function listExerciseFolders(
  classroomId: string,
  parentFolderId?: string | null
): Promise<ExerciseFolderDocument[]> {
  const queries = [
    Query.equal("classroomId", classroomId),
    Query.orderAsc("order"),
    Query.limit(100),
  ];
  if (parentFolderId !== undefined) {
    queries.push(
      parentFolderId
        ? Query.equal("parentFolderId", parentFolderId)
        : Query.isNull("parentFolderId")
    );
  }
  const { documents } = await databases.listDocuments(dbId, collId, queries);
  return documents as unknown as ExerciseFolderDocument[];
}

/** Update a folder name or order. */
export async function updateExerciseFolder(
  folderId: string,
  updates: { name?: string; order?: number }
): Promise<ExerciseFolderDocument> {
  const body: Record<string, unknown> = {};
  if (updates.name !== undefined) body.name = updates.name;
  if (updates.order !== undefined) body.order = updates.order;
  const doc = await databases.updateDocument(dbId, collId, folderId, body);
  return doc as unknown as ExerciseFolderDocument;
}

/** Delete a folder and all exercises inside it (cascade). */
export async function deleteExerciseFolder(folderId: string): Promise<void> {
  // Delete all exercises in this folder
  try {
    const { documents: exercises } = await databases.listDocuments(dbId, exercisesCollId, [
      Query.equal("folderId", folderId),
      Query.limit(200),
    ]);
    await Promise.all(
      exercises.map(ex => databases.deleteDocument(dbId, exercisesCollId, ex.$id))
    );
  } catch { /* best-effort */ }

  // Delete sub-folders recursively
  try {
    const { documents: subFolders } = await databases.listDocuments(dbId, collId, [
      Query.equal("parentFolderId", folderId),
      Query.limit(100),
    ]);
    for (const sub of subFolders) {
      await deleteExerciseFolder(sub.$id);
    }
  } catch { /* best-effort */ }

  await databases.deleteDocument(dbId, collId, folderId);
}
