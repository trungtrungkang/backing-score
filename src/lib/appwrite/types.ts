/**
 * Types for Backing & Score Appwrite documents.
 * Matches APPWRITE-BACKEND-DESIGN.md and WEB-DAW-AND-LIVE-VISION.md (Project payload).
 */

export interface ProjectDocument {
  /** Appwrite document ID */
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  /** Owner (Appwrite user ID) */
  userId: string;
  name: string;
  /** Legacy mode label; prefer payload for view type. */
  mode: "practice" | "arrange" | "chart";
  /** Full project data (tracks, arrangement, sectionLibrary, etc.) — JSON string */
  payload: string;
  payloadVersion: number;
  published: boolean;
  publishedAt?: string;
  coverUrl?: string;
  description?: string;
  /** Author email added in Phase 6 */
  creatorEmail?: string;
  /** Project Tags for discovery filters Phase 9 */
  tags?: string[];
  instruments?: string[];
  difficulty?: number;
  durationSec?: number;
  /** Wiki entity links (Phase 2.5) */
  wikiGenreId?: string;
  wikiInstrumentIds?: string[];
  wikiCompositionId?: string;
  wikiComposerIds?: string[];
  /** Play count for discovery ranking (Sprint 1) */
  playCount?: number;
}

export type ProjectPayload = Record<string, any>;

export interface PlaylistDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  ownerId: string;
  name: string;
  description?: string;
  isPublished: boolean;
  coverImageId?: string;
  projectIds: string[];
}

export interface FavoriteDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  userId: string;
  targetType: "project" | "playlist";
  targetId: string;
}

export interface PostDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  authorId: string;
  content?: string;
  attachmentType?: "project" | "playlist" | "none";
  attachmentId?: string;
}

export interface CommentDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  postId: string;
  authorId: string;
  content: string;
}

export interface ReactionDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  targetType: "post" | "comment" | "project" | "playlist";
  targetId: string;
  userId: string;
  type: string;
}

export interface FollowDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  followerId: string;
  followingId: string;
}

// ==========================================
// Wiki / Encyclopedia Document Types
// ==========================================

export interface ArtistDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  name: string;
  nameOriginal?: string;
  slug: string;
  bio?: string;
  birthDate?: string;
  deathDate?: string;
  nationality?: string;
  roles?: string[];
  imageUrl?: string;
  coverUrl?: string;
  genreIds?: string[];
  instrumentIds?: string[];
  externalLinks?: string;
}

export interface InstrumentDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  name: string;
  slug: string;
  family?: string;
  description?: string;
  imageUrl?: string;
  tuning?: string;
  range?: string;
  origin?: string;
}

export interface CompositionDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  title: string;
  slug: string;
  composerIds?: string[];
  performerIds?: string[];
  year?: number;
  period?: string;
  genreId?: string;
  instrumentIds?: string[];
  keySignature?: string;
  tempo?: string;
  timeSignature?: string;
  description?: string;
  difficulty?: string;
  projectIds?: string[];
}

export interface GenreDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  name: string;
  slug: string;
  description?: string;
  parentGenreId?: string;
  era?: string;
}

export type WikiEntityType = "artist" | "instrument" | "composition" | "genre";

export interface WikiTranslationDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  entityId: string;
  entityType: WikiEntityType;
  locale: string;
  field: string;
  value: string;
}
