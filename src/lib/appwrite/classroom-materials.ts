import { account } from "./client";
import { isAppwriteConfigured } from "./constants";
import * as D1 from "@/app/actions/v5/classroom-materials";

async function getUserIdFallback() {
  if (!isAppwriteConfigured()) return undefined;
  try {
    const user = await account.get();
    return user.$id;
  } catch {
    return undefined;
  }
}

export async function shareToClassroom(params: any) {
  return D1.shareToClassroomV5(params, await getUserIdFallback());
}

export async function listClassroomMaterials(classroomId: string) {
  return D1.listClassroomMaterialsV5(classroomId, await getUserIdFallback());
}

export async function removeClassroomMaterial(materialId: string) {
  return D1.removeClassroomMaterialV5(materialId, await getUserIdFallback());
}
