"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { X, Plus, Trash2, Save, Map, ListOrdered, ChevronUp, ChevronDown, Play, FileText, Loader2 } from "lucide-react";
import type { Bookmark, NavigationSequence, ParsedSheetNavMap } from "@/lib/appwrite/nav-maps";

interface PdfNavMapPanelProps {
  sheetMusicId: string;
  initialNavMap: ParsedSheetNavMap | null;
  currentPage: number; // 1-based
  currentYPercent: number; // 0.0 to 1.0
  onSave: (bookmarks: Bookmark[], sequence: NavigationSequence) => Promise<void>;
  onJumpToBookmark: (bookmark: Bookmark) => void;
  onClose: () => void;
  isSaving: boolean;
  readOnly?: boolean;
}

export default function PdfNavMapPanel({
  sheetMusicId,
  initialNavMap,
  currentPage,
  currentYPercent,
  onSave,
  onJumpToBookmark,
  onClose,
  isSaving,
  readOnly = false,
}: PdfNavMapPanelProps) {
  const t = useTranslations("Pdfs"); // Assuming we have some translations there
  
  const [activeTab, setActiveTab] = useState<"bookmarks" | "sequence">("bookmarks");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialNavMap?.bookmarks || []);
  const [sequence, setSequence] = useState<NavigationSequence>(initialNavMap?.sequence || []);
  const [newBookmarkName, setNewBookmarkName] = useState("");

  const handleAddBookmark = () => {
    if (!newBookmarkName.trim()) return;
    const bm: Bookmark = {
      id: `bm-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: newBookmarkName.trim(),
      pageIndex: currentPage - 1, // Store as 0-based index
      yPercent: currentYPercent,
    };
    setBookmarks([...bookmarks, bm]);
    setNewBookmarkName("");
  };

  const handleDeleteBookmark = (id: string) => {
    setBookmarks(bookmarks.filter(b => b.id !== id));
    // Also remove from sequence
    setSequence(sequence.filter(seqId => seqId !== id));
  };

  const handleAddToSequence = (id: string) => {
    setSequence([...sequence, id]);
  };

  const handleRemoveFromSequence = (index: number) => {
    const newSeq = [...sequence];
    newSeq.splice(index, 1);
    setSequence(newSeq);
  };

  const moveSequenceItem = (index: number, direction: -1 | 1) => {
    if (index + direction < 0 || index + direction >= sequence.length) return;
    const newSeq = [...sequence];
    const temp = newSeq[index];
    newSeq[index] = newSeq[index + direction];
    newSeq[index + direction] = temp;
    setSequence(newSeq);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50/85 dark:bg-zinc-900/85 backdrop-blur-3xl border border-zinc-200/50 dark:border-zinc-800/50 w-[260px] sm:w-80 shadow-2xl rounded-2xl overflow-hidden transition-all">
      <div className="navmap-drag-handle cursor-move flex items-center justify-between p-3 sm:p-4 bg-white/50 dark:bg-zinc-950/50 border-b border-zinc-200/50 dark:border-zinc-800/50 active:bg-zinc-100/50 dark:active:bg-zinc-900/50 transition-colors">
        <h2 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2 text-sm sm:text-base pointer-events-none">
          <Map className="w-4 h-4 text-indigo-500" />
          Navigation Map
        </h2>
        <div className="flex items-center gap-1">
          <div className="p-1 text-zinc-400 bg-black/5 dark:bg-white/5 rounded pointer-events-none hidden sm:block">
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
          </div>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex bg-zinc-100/50 dark:bg-zinc-950/50 border-b border-zinc-200/50 dark:border-zinc-800/50">
        <button
          onClick={() => setActiveTab("bookmarks")}
          className={`flex-1 py-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 ${
            activeTab === "bookmarks" ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-white/50 dark:bg-zinc-900/50" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Map className="w-3.5 h-3.5" /> Bookmarks
        </button>
        <button
          onClick={() => setActiveTab("sequence")}
          className={`flex-1 py-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 ${
            activeTab === "sequence" ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-white/50 dark:bg-zinc-900/50" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <ListOrdered className="w-3.5 h-3.5" /> Sequence
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {activeTab === "bookmarks" && (
          <div className="space-y-4">
            {!readOnly && (
              <div className="bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl p-3 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm">
                <p className="text-[10px] sm:text-xs text-zinc-500 mb-2">Create bookmark at current view (Page {currentPage}, {Math.round(currentYPercent * 100)}%)</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Chorus..."
                    value={newBookmarkName}
                    onChange={(e) => setNewBookmarkName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddBookmark()}
                    className="flex-1 h-8 px-2 text-xs sm:text-sm rounded-lg bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleAddBookmark}
                    disabled={!newBookmarkName.trim()}
                    className="px-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {bookmarks.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs sm:text-sm">
                  <Map className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No bookmarks yet
                </div>
              ) : (
                bookmarks.map(bm => (
                  <div key={bm.id} className="group flex flex-col p-2.5 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/50 rounded-xl transition-colors hover:bg-white/80 dark:hover:bg-zinc-900/80">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-xs sm:text-sm text-zinc-900 dark:text-white truncate pr-2">{bm.name}</div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => onJumpToBookmark(bm)} className="p-1.5 rounded-md text-zinc-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors" title="Jump to">
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        {!readOnly && (
                          <button onClick={() => handleDeleteBookmark(bm.id)} className="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-[10px] sm:text-xs text-zinc-500">Page {bm.pageIndex + 1} ({Math.round(bm.yPercent * 100)}%)</div>
                      {!readOnly && (
                        <button
                          onClick={() => handleAddToSequence(bm.id)}
                          className="text-[10px] sm:text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                        >
                          + Add to Sequence
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "sequence" && (
          <div className="space-y-4">
            <div className="bg-amber-100/50 dark:bg-amber-950/30 backdrop-blur-sm text-amber-800 dark:text-amber-500 text-[10px] sm:text-xs p-3 rounded-xl border border-amber-200/50 dark:border-amber-900/30">
              Define the reading order. When active, a "Next" button will jump through this sequence.
            </div>

            <div className="space-y-2">
              {sequence.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs sm:text-sm">
                  Add bookmarks to sequence
                </div>
              ) : (
                sequence.map((bmId, index) => {
                  const bm = bookmarks.find(b => b.id === bmId);
                  if (!bm) return null;
                  return (
                    <div key={`${index}-${bmId}`} className="flex items-center gap-1.5 sm:gap-2 p-2 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/50 rounded-xl hover:bg-white/80 dark:hover:bg-zinc-900/80 transition-colors">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-zinc-200/50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 flex items-center justify-center text-[10px] sm:text-xs font-bold shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-white truncate">{bm.name}</div>
                        <div className="text-[10px] sm:text-xs text-zinc-500">Pg. {bm.pageIndex + 1}</div>
                      </div>
                      {!readOnly && (
                        <>
                          <div className="flex items-center flex-col gap-0.5 shrink-0">
                            <button onClick={() => moveSequenceItem(index, -1)} disabled={index === 0} className="p-0.5 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 disabled:opacity-30 transition-colors">
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button onClick={() => moveSequenceItem(index, 1)} disabled={index === sequence.length - 1} className="p-0.5 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 disabled:opacity-30 transition-colors">
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                          <button onClick={() => handleRemoveFromSequence(index)} className="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-500/10 shrink-0 transition-colors ml-0.5">
                             <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {!readOnly && (
        <div className="p-3 sm:p-4 bg-white/50 dark:bg-zinc-950/50 border-t border-zinc-200/50 dark:border-zinc-800/50">
          <button
            onClick={() => onSave(bookmarks, sequence)}
            disabled={isSaving}
            className="w-full h-9 sm:h-10 flex items-center justify-center gap-2 bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Map
          </button>
        </div>
      )}
    </div>
  );
}
