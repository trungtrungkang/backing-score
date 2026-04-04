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
  createProjectV5 as createProject,
  updateProjectV5 as updateProject,
  getProjectV5 as getProject,
  listProjectsV5 as listProjects,
  listMyProjectsV5 as listMyProjects,
  listPublishedV5 as listPublished,
  deleteProjectV5 as deleteProject,
  copyProjectToMineV5 as copyProjectToMine,
  publishMyProjectV5 as publishMyProject,
  listFeaturedV5 as listFeatured,
  listRecentlyPublishedV5 as listRecentlyPublished,
  listTrendingV5 as listTrending,
  listMostFavoritedV5 as listMostFavorited,
  incrementPlayCountV5 as incrementPlayCount,
  setFeaturedV5 as setFeatured,
  listProjectsByArtistV5 as listProjectsByArtist,
  listProjectsByCompositionV5 as listProjectsByComposition
} from "@/app/actions/v5/projects";
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
  getUserReactionsForPosts,
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
  createInviteTicket,
  listClassroomInvites,
  deleteInviteTicket,
  approveMember,
  declineMember,
  listPendingMembers,
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
export type { ClassroomMaterialDocument } from "./types";
export {
  createFeedback,
  listFeedback,
  updateFeedback,
  deleteFeedback,
} from "./submission-feedback";
export {
  shareToClassroom,
  listClassroomMaterials,
  removeClassroomMaterial,
} from "./classroom-materials";
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
  listSheetMusic,
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
  regenerateThumbnail,
} from "./sheet-music";
export {
  createSheetFolder,
  listSheetFolders,
  updateSheetFolder,
  deleteSheetFolder,
} from "./sheet-music-folders";
export type { Bookmark, NavigationSequence, SheetNavMapDocument, ParsedSheetNavMap } from "./nav-maps";
export {
  getNavMap,
  saveNavMap,
  deleteNavMap,
} from "./nav-maps";

export type { SetlistDocument, SetlistItem } from "./types";
export {
  createSetlist,
  getSetlist,
  listMySetlists,
  updateSetlist,
  deleteSetlist,
} from "./setlists";
