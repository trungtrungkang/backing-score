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
  updateAssignment,
} from "./assignments";
export {
  submitAssignment,
  listSubmissions,
  getMySubmission,
  listMySubmissions,
  getRecordingUrl,
  getRecordingDownloadUrl,
} from "./submissions";
export type { SubmissionFeedbackDocument } from "./types";
export {
  createFeedback,
  listFeedback,
  updateFeedback,
  deleteFeedback,
} from "./submission-feedback";
export type { ProjectFolderDocument } from "./types";
export {
  createProjectFolder,
  listProjectFolders,
  updateProjectFolder,
  deleteProjectFolder,
  moveProjectToFolder,
} from "./project-folders";

// Sheet Music (PDF)
export type { SheetMusicDocument, SheetMusicFolderDocument } from "./types";
export {
  uploadSheetPdf,
  listMySheetMusic,
  getSheetMusic,
  updateSheetMusic,
  deleteSheetMusic,
  moveSheetToFolder,
  toggleSheetFavorite,
  getSheetPdfUrl,
  getSheetPdfBlobUrl,
  getThumbnailUrl,
  touchSheetLastOpened,
  backfillThumbnails,
} from "./sheet-music";
export {
  createSheetFolder,
  listSheetFolders,
  updateSheetFolder,
  deleteSheetFolder,
} from "./sheet-music-folders";
