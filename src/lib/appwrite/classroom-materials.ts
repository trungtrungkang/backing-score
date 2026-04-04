import * as D1 from "@/app/actions/v5/classroom-materials";

export async function shareToClassroom(params: any) {
  return D1.shareToClassroomV5(params, undefined);
}

export async function listClassroomMaterials(classroomId: string) {
  return D1.listClassroomMaterialsV5(classroomId, undefined);
}

export async function removeClassroomMaterial(materialId: string) {
  return D1.removeClassroomMaterialV5(materialId, undefined);
}
