
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
import * as ProjectActions from "@/app/actions/v5/projects";
import { withDedup } from "@/lib/promise-dedup";

export const createProject = ProjectActions.createProjectV5;
export const updateProject = ProjectActions.updateProjectV5;
export const getProject = withDedup("getProject", ProjectActions.getProjectV5);
export const listProjects = withDedup("listProjects", ProjectActions.listProjectsV5);
export const listMyProjects = withDedup("listMyProjects", ProjectActions.listMyProjectsV5);
export const listPublished = withDedup("listPublished", ProjectActions.listPublishedV5);
export const deleteProject = ProjectActions.deleteProjectV5;
export const copyProjectToMine = ProjectActions.copyProjectToMineV5;
export const publishMyProject = ProjectActions.publishMyProjectV5;
export const listFeatured = withDedup("listFeatured", ProjectActions.listFeaturedV5);
export const listRecentlyPublished = withDedup("listRecentlyPublished", ProjectActions.listRecentlyPublishedV5);
export const listTrending = withDedup("listTrending", ProjectActions.listTrendingV5);
export const listMostFavorited = withDedup("listMostFavorited", ProjectActions.listMostFavoritedV5);
export const incrementPlayCount = ProjectActions.incrementPlayCountV5;
export const setFeatured = ProjectActions.setFeaturedV5;
export const listProjectsByArtist = withDedup("listProjectsByArtist", ProjectActions.listProjectsByArtistV5);
export const listProjectsByComposition = withDedup("listProjectsByComposition", ProjectActions.listProjectsByCompositionV5);
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
