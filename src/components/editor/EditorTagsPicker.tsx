"use client";

import React, { useState, useCallback } from "react";
import { Search, Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface WikiItem {
  $id: string;
  name?: string;
  family?: string;
  era?: string;
  title?: string;
  period?: string;
  roles?: string[];
}

interface EditorTagsPickerProps {
  tags: string[];
  isOwner: boolean;
  onTagsChange?: (tags: string[]) => void;
  // Wiki instruments
  wikiInstruments: WikiItem[];
  wikiInstrumentIds: string[];
  onWikiInstrumentIdsChange?: (ids: string[]) => void;
  // Wiki genres
  wikiGenres: WikiItem[];
  wikiGenreId?: string;
  onWikiGenreIdChange?: (id: string | undefined) => void;
  // Wiki compositions
  wikiCompositions: WikiItem[];
  wikiCompositionId?: string;
  onWikiCompositionIdChange?: (id: string | undefined) => void;
  // Wiki composers
  wikiComposers: WikiItem[];
  wikiComposerIds: string[];
  onWikiComposerIdsChange?: (ids: string[]) => void;
}

const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Advanced"];

export const EditorTagsPicker = React.memo(function EditorTagsPicker({
  tags,
  isOwner,
  onTagsChange,
  wikiInstruments,
  wikiInstrumentIds,
  onWikiInstrumentIdsChange,
  wikiGenres,
  wikiGenreId,
  onWikiGenreIdChange,
  wikiCompositions,
  wikiCompositionId,
  onWikiCompositionIdChange,
  wikiComposers,
  wikiComposerIds,
  onWikiComposerIdsChange,
}: EditorTagsPickerProps) {
  const [tagTab, setTagTab] = useState<"inst" | "genre" | "comp" | "artist" | "diff">("inst");
  const [tagSearch, setTagSearch] = useState("");

  const handleToggleTag = useCallback((tag: string) => {
    if (!onTagsChange) return;
    tags.includes(tag) ? onTagsChange(tags.filter(t => t !== tag)) : onTagsChange([...tags, tag]);
  }, [tags, onTagsChange]);

  const totalCount = tags.length + wikiInstrumentIds.length + (wikiGenreId ? 1 : 0) + (wikiCompositionId ? 1 : 0) + wikiComposerIds.length;

  return (
    <div className="shrink-0 mr-auto flex items-center">
      <DropdownMenu onOpenChange={() => { setTagSearch(""); setTagTab("inst"); }}>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 rounded-md text-xs font-semibold text-zinc-600 dark:text-zinc-300 shadow-sm transition-colors focus:outline-none">
            <Tag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tags</span>
            {totalCount > 0 && (
              <span className="bg-[#C8A856] text-black text-[10px] font-bold px-1.5 rounded-full min-w-[20px] text-center flex items-center justify-center -ml-0.5">
                {totalCount}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72 bg-white dark:bg-[#1A1A1E] border-zinc-200 dark:border-zinc-800 shadow-xl p-0 z-[150]" align="start">
          {/* Tabs row */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-1 pt-1">
            {([
              { key: "inst" as const, label: "🎹", title: "Instruments", count: wikiInstrumentIds.length },
              { key: "genre" as const, label: "🎵", title: "Genre", count: wikiGenreId ? 1 : 0 },
              { key: "comp" as const, label: "📄", title: "Composition", count: wikiCompositionId ? 1 : 0 },
              { key: "artist" as const, label: "👤", title: "Composer", count: wikiComposerIds.length },
              { key: "diff" as const, label: "📊", title: "Difficulty", count: tags.filter(t => DIFFICULTY_OPTIONS.includes(t)).length },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={(e) => { e.preventDefault(); setTagTab(tab.key); setTagSearch(""); }}
                title={tab.title}
                className={cn(
                  "flex-1 py-1.5 text-center text-sm rounded-t-md transition-colors relative",
                  tagTab === tab.key
                    ? "bg-zinc-100 dark:bg-zinc-800 font-bold"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-400"
                )}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-[#C8A856] text-black text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search (for tabs with many items) */}
          {["inst", "comp", "artist"].includes(tagTab) && (
            <div className="px-2 pt-2 pb-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  value={tagSearch}
                  onChange={e => setTagSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-7 pr-2 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:border-[#C8A856] transition-colors"
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          {/* Tab content */}
          <div className="max-h-64 overflow-y-auto px-1 pb-1">
            {/* Instruments tab */}
            {tagTab === "inst" && wikiInstruments.length > 0 && (
              <div>
                {(isOwner ? wikiInstruments : wikiInstruments.filter(i => wikiInstrumentIds.includes(i.$id)))
                  .filter(i => !tagSearch || (i.name || "").toLowerCase().includes(tagSearch.toLowerCase()))
                  .map(inst => {
                    const isSelected = wikiInstrumentIds.includes(inst.$id);
                    return (
                      <DropdownMenuItem
                        key={inst.$id}
                        onClick={(e) => {
                          if (!isOwner || !onWikiInstrumentIdsChange) { e.preventDefault(); return; }
                          const newIds = isSelected
                            ? wikiInstrumentIds.filter(id => id !== inst.$id)
                            : [...wikiInstrumentIds, inst.$id];
                          onWikiInstrumentIdsChange(newIds);
                          e.preventDefault();
                        }}
                        className={cn(
                          "text-xs font-semibold px-2 py-1.5 cursor-pointer rounded transition-colors flex items-center justify-between group",
                          isOwner ? "hover:bg-zinc-100 dark:hover:bg-zinc-800" : "cursor-default",
                          isSelected ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20" : "text-zinc-600 dark:text-zinc-400"
                        )}
                      >
                        <span>{inst.name}{inst.family && <span className="text-zinc-400 ml-1 text-[10px]">({inst.family})</span>}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />}
                      </DropdownMenuItem>
                    );
                  })}
              </div>
            )}

            {/* Genre tab */}
            {tagTab === "genre" && wikiGenres.length > 0 && (
              <div>
                {(isOwner ? wikiGenres : wikiGenres.filter(g => g.$id === wikiGenreId)).map(genre => {
                  const isSelected = wikiGenreId === genre.$id;
                  return (
                    <DropdownMenuItem
                      key={genre.$id}
                      onClick={(e) => {
                        if (!isOwner || !onWikiGenreIdChange) { e.preventDefault(); return; }
                        onWikiGenreIdChange(isSelected ? undefined : genre.$id);
                        e.preventDefault();
                      }}
                      className={cn(
                        "text-xs font-semibold px-2 py-1.5 cursor-pointer rounded transition-colors flex items-center justify-between group",
                        isOwner ? "hover:bg-zinc-100 dark:hover:bg-zinc-800" : "cursor-default",
                        isSelected ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : "text-zinc-600 dark:text-zinc-400"
                      )}
                    >
                      <span>{genre.name}{genre.era && <span className="text-zinc-400 ml-1 text-[10px]">({genre.era})</span>}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />}
                    </DropdownMenuItem>
                  );
                })}
              </div>
            )}

            {/* Composition tab */}
            {tagTab === "comp" && wikiCompositions.length > 0 && (
              <div>
                {(isOwner ? wikiCompositions : wikiCompositions.filter(c => c.$id === wikiCompositionId))
                  .filter(c => !tagSearch || (c.title || "").toLowerCase().includes(tagSearch.toLowerCase()))
                  .map(comp => {
                    const isSelected = wikiCompositionId === comp.$id;
                    return (
                      <DropdownMenuItem
                        key={comp.$id}
                        onClick={(e) => {
                          if (!isOwner || !onWikiCompositionIdChange) { e.preventDefault(); return; }
                          onWikiCompositionIdChange(isSelected ? undefined : comp.$id);
                          e.preventDefault();
                        }}
                        className={cn(
                          "text-xs font-semibold px-2 py-1.5 cursor-pointer rounded transition-colors flex items-center justify-between group",
                          isOwner ? "hover:bg-zinc-100 dark:hover:bg-zinc-800" : "cursor-default",
                          isSelected ? "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20" : "text-zinc-600 dark:text-zinc-400"
                        )}
                      >
                        <span>{comp.title || comp.name}{comp.period && <span className="text-zinc-400 ml-1 text-[10px]">({comp.period})</span>}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />}
                      </DropdownMenuItem>
                    );
                  })}
              </div>
            )}

            {/* Composer tab */}
            {tagTab === "artist" && wikiComposers.length > 0 && (
              <div>
                {(isOwner ? wikiComposers : wikiComposers.filter(a => wikiComposerIds.includes(a.$id)))
                  .filter(a => !tagSearch || (a.name || "").toLowerCase().includes(tagSearch.toLowerCase()))
                  .map(artist => {
                    const isSelected = wikiComposerIds.includes(artist.$id);
                    return (
                      <DropdownMenuItem
                        key={artist.$id}
                        onClick={(e) => {
                          if (!isOwner || !onWikiComposerIdsChange) { e.preventDefault(); return; }
                          const newIds = isSelected
                            ? wikiComposerIds.filter(id => id !== artist.$id)
                            : [...wikiComposerIds, artist.$id];
                          onWikiComposerIdsChange(newIds);
                          e.preventDefault();
                        }}
                        className={cn(
                          "text-xs font-semibold px-2 py-1.5 cursor-pointer rounded transition-colors flex items-center justify-between group",
                          isOwner ? "hover:bg-zinc-100 dark:hover:bg-zinc-800" : "cursor-default",
                          isSelected ? "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20" : "text-zinc-600 dark:text-zinc-400"
                        )}
                      >
                        <span>{artist.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" />}
                      </DropdownMenuItem>
                    );
                  })}
              </div>
            )}

            {/* Difficulty tab */}
            {tagTab === "diff" && (
              <div>
                {DIFFICULTY_OPTIONS.map(tag => {
                  const isSelected = tags.includes(tag);
                  if (!isOwner && !isSelected) return null;
                  return (
                    <DropdownMenuItem
                      key={tag}
                      onClick={(e) => {
                        if (!isOwner) { e.preventDefault(); return; }
                        handleToggleTag(tag);
                        e.preventDefault();
                      }}
                      className={cn(
                        "text-xs font-semibold px-2 py-1.5 cursor-pointer rounded transition-colors flex items-center justify-between group",
                        isOwner ? "hover:bg-zinc-100 dark:hover:bg-zinc-800" : "cursor-default",
                        isSelected ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "text-zinc-600 dark:text-zinc-400"
                      )}
                    >
                      <span>{tag}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />}
                    </DropdownMenuItem>
                  );
                })}
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
