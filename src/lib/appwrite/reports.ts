/**
 * Legacy Appwrite CRUD for "reports" collection.
 * Stubbed out to fix compilation errors during Drizzle migration.
 */

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
  return {};
}

/** List all reports (admin only) */
export async function listReports(limit = 50): Promise<ReportDoc[]> {
  return [];
}
