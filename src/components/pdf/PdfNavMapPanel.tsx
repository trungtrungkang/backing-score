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
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 w-80 shadow-xl overflow-hidden">
      <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <Map className="w-4 h-4 text-indigo-500" />
          Navigation Map
        </h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex bg-zinc-100 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("bookmarks")}
          className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-2 ${
            activeTab === "bookmarks" ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-white dark:bg-zinc-900" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Map className="w-4 h-4" /> Bookmarks
        </button>
        <button
          onClick={() => setActiveTab("sequence")}
          className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-2 ${
            activeTab === "sequence" ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-white dark:bg-zinc-900" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <ListOrdered className="w-4 h-4" /> Sequence
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "bookmarks" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-zinc-950 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 mb-2">Create bookmark at current view (Page {currentPage}, {Math.round(currentYPercent * 100)}%)</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Chorus, Bridge..."
                  value={newBookmarkName}
                  onChange={(e) => setNewBookmarkName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddBookmark()}
                  className="flex-1 h-8 px-2 text-sm rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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

            <div className="space-y-2">
              {bookmarks.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-sm">
                  <Map className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No bookmarks yet
                </div>
              ) : (
                bookmarks.map(bm => (
                  <div key={bm.id} className="group flex flex-col p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm text-zinc-900 dark:text-white truncate">{bm.name}</div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => onJumpToBookmark(bm)} className="p-1 rounded text-zinc-400 hover:text-indigo-500" title="Jump to">
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteBookmark(bm.id)} className="p-1 rounded text-zinc-400 hover:text-red-500" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-xs text-zinc-500">Page {bm.pageIndex + 1} ({Math.round(bm.yPercent * 100)}%)</div>
                      <button
                        onClick={() => handleAddToSequence(bm.id)}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        + Add to Sequence
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "sequence" && (
          <div className="space-y-4">
            <div className="bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-500 text-xs p-3 rounded-lg border border-amber-200 dark:border-amber-900/50">
              Define the reading order. When active, a "Next" button will jump through this sequence.
            </div>

            <div className="space-y-2">
              {sequence.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-sm">
                  Add bookmarks to sequence
                </div>
              ) : (
                sequence.map((bmId, index) => {
                  const bm = bookmarks.find(b => b.id === bmId);
                  if (!bm) return null;
                  return (
                    <div key={`${index}-${bmId}`} className="flex items-center gap-2 p-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                      <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-500 flex items-center justify-center text-xs font-medium shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-900 dark:text-white truncate">{bm.name}</div>
                        <div className="text-xs text-zinc-500">Pg. {bm.pageIndex + 1}</div>
                      </div>
                      <div className="flex items-center flex-col gap-0.5">
                        <button onClick={() => moveSequenceItem(index, -1)} disabled={index === 0} className="p-0.5 rounded text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30">
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button onClick={() => moveSequenceItem(index, 1)} disabled={index === sequence.length - 1} className="p-0.5 rounded text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30">
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                      <button onClick={() => handleRemoveFromSequence(index)} className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0">
                         <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => onSave(bookmarks, sequence)}
          disabled={isSaving}
          className="w-full h-10 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Map
        </button>
      </div>
    </div>
  );
}
