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
  APPWRITE_CLASSROOM_MATERIALS_COLLECTION_ID,
} from "./constants";
import type { ClassroomMaterialDocument } from "./types";

const dbId = APPWRITE_DATABASE_ID;
const collId = APPWRITE_CLASSROOM_MATERIALS_COLLECTION_ID;

/** Share a PDF to a classroom. Caller must be teacher. */
export async function shareToClassroom(params: {
  classroomId: string;
  sheetMusicId: string;
  note?: string;
}): Promise<ClassroomMaterialDocument> {
  const user = await account.get();

  // Check for duplicate: same PDF already shared to same classroom
  const { documents: existing } = await databases.listDocuments(dbId, collId, [
    Query.equal("classroomId", params.classroomId),
    Query.equal("sheetMusicId", params.sheetMusicId),
    Query.limit(1),
  ]);
  if (existing.length > 0) {
    throw new Error("This PDF is already shared to this classroom.");
  }

  const doc = await databases.createDocument(
    dbId,
    collId,
    ID.unique(),
    {
      classroomId: params.classroomId,
      sheetMusicId: params.sheetMusicId,
      sharedById: user.$id,
      note: params.note || "",
    },
    [
      // All authenticated users can read (membership checked in UI)
      Permission.read(Role.users()),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ]
  );

  return doc as unknown as ClassroomMaterialDocument;
}

/** List all shared materials for a classroom. */
export async function listClassroomMaterials(classroomId: string): Promise<ClassroomMaterialDocument[]> {
  const { documents } = await databases.listDocuments(dbId, collId, [
    Query.equal("classroomId", classroomId),
    Query.orderDesc("$createdAt"),
    Query.limit(100),
  ]);
  return documents as unknown as ClassroomMaterialDocument[];
}

/** Remove a shared material. Caller must be teacher who shared it. */
export async function removeClassroomMaterial(materialId: string): Promise<void> {
  await databases.deleteDocument(dbId, collId, materialId);
}
