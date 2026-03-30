"use server";

import { Client, Databases, ID, Permission, Role } from "node-appwrite";

export async function createSubmissionAction(data: {
  assignmentId: string;
  classroomId: string;
  studentId: string;
  studentName: string;
  accuracy: number;
  tempo: number;
  attempts: number;
  submittedAt: string;
  status: string;
  recordingFileId?: string;
}) {
  if (!process.env.APPWRITE_API_KEY) {
    throw new Error("Missing APPWRITE_API_KEY server environment variable.");
  }

  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";

  // 1. Fetch classroom to cleanly authorize the teacher
  const classroom = await databases.getDocument(
    dbId,
    "classrooms",
    data.classroomId
  );
  
  if (!classroom || !classroom.teacherId) {
    throw new Error("Classroom or Teacher not found.");
  }

  // 2. Create the submission and strictly lock DLS to Student & Teacher
  const doc = await databases.createDocument(
    dbId,
    "submissions",
    ID.unique(),
    data,
    [
      // Student can read/update (retrying assignments)
      Permission.read(Role.user(data.studentId)),
      Permission.update(Role.user(data.studentId)),

      // Teacher can read/update (grading/reviewing)
      Permission.read(Role.user(classroom.teacherId)),
      Permission.update(Role.user(classroom.teacherId)),
    ]
  );

  return JSON.parse(JSON.stringify(doc));
}
