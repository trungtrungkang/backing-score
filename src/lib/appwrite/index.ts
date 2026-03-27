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
  publishMyProject,
  listFeatured,
  listRecentlyPublished,
  listTrending,
  listMostFavorited,
  setFeatured,
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
  getPost,
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

// Classroom
export type {
  ClassroomDocument,
  ClassroomMemberDocument,
  AssignmentDocument,
  SubmissionDocument,
} from "./types";
export {
  createClassroom,
  getClassroom,
  listMyClassrooms,
  updateClassroom,
  deleteClassroom,
  joinClassroom,
  leaveClassroom,
  listClassroomMembers,
  removeClassroomMember,
  isClassroomMember,
} from "./classrooms";
export {
  createAssignment,
  listAssignments,
  getAssignment,
  deleteAssignment,
} from "./assignments";
export {
  submitAssignment,
  listSubmissions,
  getMySubmission,
  listMySubmissions,
} from "./submissions";
