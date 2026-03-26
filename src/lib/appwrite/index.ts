export {
  getAppwriteClient,
  account,
  databases,
  storage,
  ID,
  Query,
  Permission,
  Role,
  type Models,
} from "./client";
export {
  APPWRITE_DATABASE_ID,
  APPWRITE_PROJECTS_COLLECTION_ID,
  APPWRITE_PLAYLISTS_COLLECTION_ID,
  APPWRITE_FAVORITES_COLLECTION_ID,
  APPWRITE_UPLOADS_BUCKET_ID,
  isAppwriteConfigured,
} from "./constants";
export type { 
  ProjectDocument, 
  ProjectPayload, 
  PlaylistDocument, 
  FavoriteDocument,
  PostDocument,
  CommentDocument,
  ReactionDocument,
  FollowDocument
} from "./types";
export {
  createProject,
  updateProject,
  getProject,
  listMyProjects,
  listPublished,
  deleteProject,
  copyProjectToMine,
  incrementPlayCount,
} from "./projects";
export {
  uploadProjectFile,
  getFileViewUrl,
  openFileInNewTab,
} from "./upload";

export {
  createPlaylist,
  updatePlaylist,
  getPlaylist,
  listMyPlaylists,
  listPublishedPlaylists,
  addProjectToPlaylist,
  removeProjectFromPlaylist,
  deletePlaylist,
} from "./playlists";

export {
  toggleFavorite,
  checkIsFavorited,
  listMyFavorites,
} from "./favorites";

export {
  createPost,
  deletePost,
  getTimeline,
  followUser,
  unfollowUser,
  checkIsFollowing,
  addComment,
  getComments,
  getCommentsCount,
  toggleReaction,
  getReactionsCount,
  checkIsReacted,
} from "./social";
