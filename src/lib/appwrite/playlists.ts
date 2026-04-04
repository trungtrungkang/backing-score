import * as PlaylistActions from "@/app/actions/v5/playlists";
import { withDedup } from "../promise-dedup";

export const listMyPlaylists = withDedup("listMyPlaylists", PlaylistActions.listMyPlaylistsV5);
export const listPublishedPlaylists = withDedup("listPublishedPlaylists", PlaylistActions.listPublishedPlaylistsV5);
export const getPlaylist = PlaylistActions.getPlaylistV5;
export const createPlaylist = PlaylistActions.createPlaylistV5;
export const updatePlaylist = PlaylistActions.updatePlaylistV5;
export const deletePlaylist = PlaylistActions.deletePlaylistV5;
export const addProjectToPlaylist = PlaylistActions.addProjectToPlaylistV5;
export const removeProjectFromPlaylist = PlaylistActions.removeProjectFromPlaylistV5;
