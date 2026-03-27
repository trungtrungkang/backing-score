/**
 * Teacher Exercise CRUD for Teacher Library.
 * Links existing projects to a teacher's personal library.
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
  APPWRITE_CLASSROOM_EXERCISES_COLLECTION_ID,
} from "./constants";
import type { ClassroomExerciseDocument } from "./types";

const dbId = APPWRITE_DATABASE_ID;
const collId = APPWRITE_CLASSROOM_EXERCISES_COLLECTION_ID;

/** Add an exercise (project link) to the teacher's library. */
export async function addClassroomExercise(params: {
  folderId?: string | null;
  projectId: string;
  title: string;
  description?: string;
}): Promise<ClassroomExerciseDocument> {
  const user = await account.get();

  const doc = await databases.createDocument(
    dbId,
    collId,
    ID.unique(),
    {
      teacherId: user.$id,
      folderId: params.folderId || null,
      projectId: params.projectId,
      title: params.title,
      description: params.description || "",
    },
    [
      Permission.read(Role.users()),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ]
  );
  return doc as unknown as ClassroomExerciseDocument;
}

/** List exercises belonging to the current teacher, optionally filtered by folder. */
export async function listClassroomExercises(
  folderId?: string | null
): Promise<ClassroomExerciseDocument[]> {
  const user = await account.get();
  const queries = [
    Query.equal("teacherId", user.$id),
    Query.orderDesc("$createdAt"),
    Query.limit(100),
  ];
  if (folderId !== undefined) {
    queries.push(
      folderId
        ? Query.equal("folderId", folderId)
        : Query.isNull("folderId")
    );
  }
  const { documents } = await databases.listDocuments(dbId, collId, queries);
  return documents as unknown as ClassroomExerciseDocument[];
}

/** Remove an exercise from the teacher's library. */
export async function removeClassroomExercise(exerciseId: string): Promise<void> {
  await databases.deleteDocument(dbId, collId, exerciseId);
}
