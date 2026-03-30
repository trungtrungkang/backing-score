"use server";

import { Client, Databases, ID, Permission, Role } from "node-appwrite";

export async function createFeedbackAction(data: {
  submissionId: string;
  teacherId: string;
  teacherName: string;
  content: string;
  grade?: number;
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

  // 1. Fetch the submission to cleanly authorize the student
  const submission = await databases.getDocument(
    dbId,
    "submissions",
    data.submissionId
  );
  
  if (!submission || !submission.studentId) {
    throw new Error("Submission or Student not found.");
  }

  // 2. Create the feedback and strictly lock DLS to Student & Teacher
  const doc = await databases.createDocument(
    dbId,
    "submission_feedback",
    ID.unique(),
    data,
    [
      // Student can read
      Permission.read(Role.user(submission.studentId)),

      // Teacher can read/update/delete
      Permission.read(Role.user(data.teacherId)),
      Permission.update(Role.user(data.teacherId)),
      Permission.delete(Role.user(data.teacherId)),
    ]
  );

  return JSON.parse(JSON.stringify(doc));
}
