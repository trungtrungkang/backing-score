/**
 * Appwrite CRUD for the "reports" collection.
 * Schema:
 *   targetType  (string) — "project" | "playlist" | "post" | "comment"
 *   targetId    (string) — ID of the reported content
 *   reason      (string) — report reason
 *   details     (string) — additional context (optional)
 *   reporterId  (string) — userId of the reporter
 *   status      (string) — "pending" | "reviewed" | "dismissed"
 */

import { databases, ID, Query } from "./client";
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_REPORTS_COLLECTION_ID,
} from "./constants";

const DB = APPWRITE_DATABASE_ID;
const COLL = APPWRITE_REPORTS_COLLECTION_ID;

export interface ReportDoc {
  $id: string;
  $createdAt: string;
  targetType: "project" | "playlist" | "post" | "comment";
  targetId: string;
  reason: string;
  details?: string;
  reporterId: string;
  status: "pending" | "reviewed" | "dismissed";
}

/** Create a report document */
export async function createReport(data: {
  targetType: string;
  targetId: string;
  reason: string;
  details?: string;
  reporterId: string;
}) {
  return await databases.createDocument(DB, COLL, ID.unique(), {
    ...data,
    status: "pending",
  });
}

/** List all reports (admin only) */
export async function listReports(limit = 50): Promise<ReportDoc[]> {
  const res = await databases.listDocuments(DB, COLL, [
    Query.orderDesc("$createdAt"),
    Query.limit(limit),
  ]);
  return res.documents as unknown as ReportDoc[];
}
