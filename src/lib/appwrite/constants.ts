/**
 * Appwrite resource IDs. Set via env or use these defaults after creating resources in Console.
 * See docs/appwrite-setup.md.
 */

export const APPWRITE_DATABASE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "backing_score_db";

export const APPWRITE_PROJECTS_COLLECTION_ID =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECTS_COLLECTION_ID ?? "projects";

export const APPWRITE_UPLOADS_BUCKET_ID =
  process.env.NEXT_PUBLIC_APPWRITE_UPLOADS_BUCKET_ID ?? "uploads";

export const APPWRITE_PLAYLISTS_COLLECTION_ID = "playlists";
export const APPWRITE_FAVORITES_COLLECTION_ID = "favorites";
export const APPWRITE_POSTS_COLLECTION_ID = "posts";
export const APPWRITE_COMMENTS_COLLECTION_ID = "comments";
export const APPWRITE_REACTIONS_COLLECTION_ID = "reactions";
export const APPWRITE_FOLLOWS_COLLECTION_ID = "follows";
export const APPWRITE_NOTIFICATIONS_COLLECTION_ID = "notifications";
export const APPWRITE_REPORTS_COLLECTION_ID = "reports";

// Wiki / Encyclopedia collections
export const APPWRITE_WIKI_ARTISTS_COLLECTION_ID = "wiki_artists";
export const APPWRITE_WIKI_INSTRUMENTS_COLLECTION_ID = "wiki_instruments";
export const APPWRITE_WIKI_COMPOSITIONS_COLLECTION_ID = "wiki_compositions";
export const APPWRITE_WIKI_GENRES_COLLECTION_ID = "wiki_genres";
export const APPWRITE_WIKI_TRANSLATIONS_COLLECTION_ID = "wiki_translations";

// Classroom collections
export const APPWRITE_CLASSROOMS_COLLECTION_ID = "classrooms";
export const APPWRITE_CLASSROOM_MEMBERS_COLLECTION_ID = "classroom_members";
export const APPWRITE_ASSIGNMENTS_COLLECTION_ID = "assignments";
export const APPWRITE_SUBMISSIONS_COLLECTION_ID = "submissions";
export const APPWRITE_SUBMISSION_FEEDBACK_COLLECTION_ID = "submission_feedback";
export const APPWRITE_CLASSROOM_RECORDINGS_BUCKET_ID = "classroom_recordings";
export const APPWRITE_CLASSROOM_MATERIALS_COLLECTION_ID = "classroom_materials";
export const APPWRITE_PROJECT_FOLDERS_COLLECTION_ID = "project_folders";

// Sheet Music (PDF) collections & bucket
export const APPWRITE_SHEET_MUSIC_COLLECTION_ID = "sheet_music";
export const APPWRITE_SHEET_MUSIC_FOLDERS_COLLECTION_ID = "sheet_music_folders";
export const APPWRITE_SHEET_PDFS_BUCKET_ID = "sheet_pdfs";
export const APPWRITE_SETLISTS_COLLECTION_ID = "setlists";

// Monetization & Marketplace collections
export const APPWRITE_PRODUCTS_COLLECTION_ID = "products";
export const APPWRITE_PURCHASES_COLLECTION_ID = "purchases";
export const APPWRITE_ENTITLEMENTS_COLLECTION_ID = "entitlements";

export function isAppwriteConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT &&
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
  );
}
