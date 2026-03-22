"use client";

import { useEffect, useState } from "react";
import { listMyProjects, ProjectDocument } from "@/lib/appwrite";
import { X, Search, Music4, CloudUpload, PlaySquare } from "lucide-react";

interface ProjectSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (projectId: string) => void;
}

export function ProjectSelectorModal({ isOpen, onClose, onSelect }: ProjectSelectorModalProps) {
  const [projects, setProjects] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    
    // Fetch user's uploaded audio projects to inject as Wait Mode exercises
    listMyProjects()
      .then((list) => {
        if (!cancelled) setProjects(list);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load your project library.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1A1A1E] border border-zinc-200 dark:border-zinc-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Insert Interactive Snippet</h2>
            <p className="text-sm text-zinc-500 mt-1">Select a backing track from your Library to embed into this lesson.</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/50 dark:bg-zinc-950/20">
          {error && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/10 text-red-500 text-sm font-medium border border-red-200 dark:border-red-900/50">
              {error}
            </div>
          )}

          {loading ? (
             <div className="py-20 flex flex-col items-center justify-center">
               <div className="w-8 h-8 border-4 border-zinc-200 dark:border-zinc-800 border-t-blue-500 rounded-full animate-spin mb-4" />
               <p className="text-zinc-500 font-medium text-sm tracking-wide">Scanning Library...</p>
             </div>
          ) : projects.length === 0 ? (
             <div className="py-16 flex flex-col items-center justify-center text-center px-4 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900/50">
               <CloudUpload className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
               <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Library Empty</h3>
               <p className="text-sm text-zinc-500 max-w-sm">
                 You haven't uploaded any MusicXML + MP3 combo projects yet. Close this modal and navigate to the Dashboard to create a project first.
               </p>
             </div>
          ) : (
            <div className="flex flex-col gap-3">
              {projects.map(p => (
                 <div 
                   key={p.$id} 
                   onClick={() => {
                     onSelect(p.$id);
                     onClose();
                   }}
                   className="group flex items-center gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121214] hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-500/5 cursor-pointer transition-all shadow-sm"
                 >
                    <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-zinc-200 dark:border-zinc-700/50">
                      {p.coverUrl ? (
                         <img src={p.coverUrl} className="w-full h-full object-cover" alt="cover" />
                      ) : (
                         <Music4 className="w-5 h-5 text-zinc-400 group-hover:text-blue-500 transition-colors" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-bold text-zinc-900 dark:text-white mb-1 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {p.name}
                      </h4>
                      <p className="text-xs text-zinc-500 truncate font-mono">
                        {new Date(p.$updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 group-hover:bg-blue-500 text-zinc-400 group-hover:text-white transition-colors">
                      <PlaySquare className="w-4 h-4 ml-0.5" />
                    </div>
                 </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
