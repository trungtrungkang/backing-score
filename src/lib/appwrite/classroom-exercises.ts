/**
 * Classroom Exercise CRUD for Classroom Library.
 * Links existing projects to a classroom's library.
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

/** Add an exercise (project link) to the classroom library. */
export async function addClassroomExercise(params: {
  classroomId: string;
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
      classroomId: params.classroomId,
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

/** List exercises in a classroom, optionally filtered by folder. */
export async function listClassroomExercises(
  classroomId: string,
  folderId?: string | null
): Promise<ClassroomExerciseDocument[]> {
  const queries = [
    Query.equal("classroomId", classroomId),
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

/** Remove an exercise from the classroom library. */
export async function removeClassroomExercise(exerciseId: string): Promise<void> {
  await databases.deleteDocument(dbId, collId, exerciseId);
}
