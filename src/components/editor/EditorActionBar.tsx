"use client";

import React, { useState, useCallback } from "react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Music, PlaySquare, MoreHorizontal, ImageIcon, Share, Activity,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createPost } from "@/lib/appwrite";
import { ProjectActionsMenu } from "@/components/ProjectActionsMenu";
import { toast } from "sonner";
import { useDialogs } from "@/components/ui/dialog-provider";
import { Image as LucideImage } from "lucide-react";

interface EditorActionBarProps {
  projectId?: string;
  projectName: string;
  isOwner: boolean;
  isPublished?: boolean;
  coverUrl?: string;
  saving: boolean;
  publishing: boolean;
  // Callbacks
  onNameChange?: (name: string) => void;
  onSave: () => void;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onUploadCover?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadingCover?: boolean;
  // Tags slot
  tagsSlot?: React.ReactNode;
  playModeSlot?: React.ReactNode;
}

export const EditorActionBar = React.memo(function EditorActionBar({
  projectId,
  projectName,
  isOwner,
  isPublished,
  coverUrl,
  saving,
  publishing,
  onNameChange,
  onSave,
  onPublish,
  onUnpublish,
  onUploadCover,
  uploadingCover,
  tagsSlot,
  playModeSlot,
}: EditorActionBarProps) {
  const { prompt } = useDialogs();
  const [shareCopied, setShareCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = origin ? `${origin}/p/${projectId}` : "";
  const embedUrl = origin ? `${origin}/embed?p=${projectId}` : "";

  const handleCopyLink = useCallback(() => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  }, [shareUrl]);

  const handleShareToFeed = useCallback(async () => {
    if (!projectId || !isPublished) {
      toast.error("You must publish the project first to share it on your feed.");
      return;
    }
    const caption = await prompt({
      title: "Share Project to Feed",
      description: "Write a caption for your post:",
      confirmText: "Share",
      cancelText: "Cancel",
    });
    if (caption !== null) {
      try {
        await createPost({
          content: caption,
          attachmentType: "project",
          attachmentId: projectId,
        });
        toast.success("Project shared to your timeline feed!");
      } catch (err) {
        toast.error("Failed to share project to feed.");
      }
    }
  }, [projectId, prompt, isPublished]);

  const handleCopyEmbed = useCallback(() => {
    if (!embedUrl) return;
    const iframeHtml = `<iframe src="${embedUrl}" width="640" height="400" frameborder="0" allow="autoplay" title="Backing & Score"></iframe>`;
    navigator.clipboard.writeText(iframeHtml).then(() => {
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2000);
    });
  }, [embedUrl]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 bg-white dark:bg-[#1A1A1E] border-b border-black/50 px-3 sm:px-6 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 shrink-0 w-full overflow-hidden">
      <Link href="/dashboard" className="flex items-center gap-1 hover:text-white transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Projects
      </Link>
      <div className="w-px h-3 bg-zinc-700"></div>

      {isOwner && onNameChange ? (
        <div className="flex items-center gap-2 shrink-0 flex-1 min-w-[200px] sm:max-w-md">
          {coverUrl && (
            <img src={coverUrl} alt="Cover" className="w-6 h-6 rounded-sm object-cover shadow-sm shrink-0 border border-zinc-200 dark:border-zinc-700" />
          )}
          <span className="shrink-0 hidden sm:inline">Title:</span>
          <input
            value={projectName}
            onChange={e => onNameChange(e.target.value)}
            className="bg-transparent dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-200 w-full min-w-[150px] border border-zinc-300 dark:border-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-[#222] focus:border-blue-500 rounded px-2 py-1 outline-none transition-colors shadow-inner"
            placeholder="Project Name"
          />
        </div>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          {coverUrl && (
            <img src={coverUrl} alt="Cover" className="w-6 h-6 rounded-sm object-cover shadow-sm shrink-0 border border-zinc-200 dark:border-zinc-700" />
          )}
          <span className="truncate max-w-[200px] text-zinc-900 dark:text-zinc-300 font-medium">{projectName || "Untitled"}</span>
        </div>
      )}

      {/* Tags UI slot */}
      {tagsSlot}
      {playModeSlot}

      <div className="flex-1 flex items-center justify-end gap-3 shrink-0">
        {projectId && <ProjectActionsMenu projectId={projectId} />}

        <div className="flex items-center gap-2">
          {isOwner && (
            <>
              <Button size="sm" onClick={onSave} disabled={saving} className="h-7 px-3 bg-zinc-700 hover:bg-zinc-600 text-white text-[11px] uppercase font-bold tracking-wider rounded border border-zinc-600 hidden sm:flex">
                {saving ? "Saving…" : "Save"}
              </Button>
              {onPublish && !isPublished && (
                <Button size="sm" onClick={onPublish} disabled={publishing} className="h-7 px-3 bg-[#C8A856] hover:bg-[#D4B86A] text-black text-[11px] uppercase font-bold tracking-wider rounded border border-[#C8A856]/50 hidden sm:flex">
                  {publishing ? "Publishing…" : "Publish"}
                </Button>
              )}
              {onUnpublish && isPublished && (
                <Button size="sm" onClick={onUnpublish} disabled={publishing} className="h-7 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] uppercase font-bold tracking-wider rounded border border-zinc-600 hidden sm:flex">
                  {publishing ? "Unpublishing…" : "Unpublish"}
                </Button>
              )}
            </>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center justify-center p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors focus:outline-none">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-white dark:bg-[#1A1A1E] border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300 p-1 z-[150] shadow-xl">
              {projectId && (
                <DropdownMenuItem asChild className="cursor-pointer font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800 py-2.5 text-xs transition-colors">
                  <Link href={`/play/${projectId}`} className="flex w-full items-center gap-2 text-blue-600 dark:text-blue-400">
                    <PlaySquare className="w-3.5 h-3.5" /> Play Mode
                  </Link>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem onClick={handleShareToFeed} className="cursor-pointer font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-2.5 text-xs transition-colors flex items-center gap-2">
                <Share className="w-3.5 h-3.5" /> Share to Feed
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-2.5 text-xs transition-colors flex items-center gap-2 mb-1">
                <Activity className="w-3.5 h-3.5" /> {shareCopied ? "Copied Link!" : "Copy Link"}
              </DropdownMenuItem>

              {isOwner && (
                <>
                  <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-1 mx-2" />
                  {onUploadCover && (
                    <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()} className="cursor-pointer font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-2.5 text-xs transition-colors">
                      <label className="flex w-full cursor-pointer items-center gap-2">
                        <LucideImage className="w-3.5 h-3.5" />
                        {uploadingCover ? "Uploading..." : "Upload Cover Art"}
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                          onUploadCover(e);
                        }} disabled={uploadingCover} />
                      </label>
                    </DropdownMenuItem>
                  )}


                  {/* Expose Save/Publish internally on Mobile */}
                  <DropdownMenuItem onClick={onSave} disabled={saving} className="sm:hidden cursor-pointer font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800 py-2.5 mt-1 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white transition-colors">
                    {saving ? "Saving..." : "Save Project"}
                  </DropdownMenuItem>
                  {onPublish && !isPublished && (
                    <DropdownMenuItem onClick={onPublish} disabled={publishing} className="sm:hidden cursor-pointer font-semibold hover:bg-[#C8A856]/10 focus:bg-[#C8A856]/10 py-2.5 text-xs text-[#C8A856] transition-colors">
                      {publishing ? "Publishing..." : "Publish Project"}
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

      </div>
    </div>
  );
});
