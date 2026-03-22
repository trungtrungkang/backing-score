import { useEffect, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { SnippetPlayer } from '@/components/player/SnippetPlayer';
import type { DAWPayload } from '@/lib/daw/types';
import { getProject, type ProjectDocument } from '@/lib/appwrite';
import { Loader2 } from "lucide-react";

export default function MusicSnippetView({ node, updateAttributes, selected }: NodeViewProps) {
  const projectId = node.attrs.projectId;
  const payloadRaw = node.attrs.payloadRaw;
  const snippetId = node.attrs.snippetId;
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!snippetId) {
      // Defer state update to next tick to avoid React flushSync conflicts inside Tiptap NodeView
      setTimeout(() => {
         updateAttributes({ snippetId: `snippet_${Math.random().toString(36).substring(2, 11)}` });
      }, 0);
    }
  }, [snippetId, updateAttributes]);

  useEffect(() => {
    // If a projectId was injected by the Modal but we lack a payload, fetch it!
    if (projectId && !payloadRaw) {
      let cancelled = false;
      setIsLoading(true);
      
      getProject(projectId)
        .then((project: ProjectDocument | null) => {
          if (!cancelled && project) {
             if (project.payload) {
                 // Success! Inject payload.
                 updateAttributes({ payloadRaw: typeof project.payload === 'string' ? project.payload : JSON.stringify(project.payload) });
             } else {
                 // Selected project is missing an interactive JSON payload!
                 setError("This project lacks an interactive layout (Sheet/Tab). Please select a different project.");
             }
          }
        })
        .catch(() => {
          if (!cancelled) setError("Failed to synchronize track payload from cloud.");
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
        
      return () => { cancelled = true; };
    }
  }, [projectId, payloadRaw, updateAttributes]);
  
  return (
    <NodeViewWrapper 
      className={`music-snippet-view my-8 transition-all duration-200 block ${
        selected ? 'ring-2 ring-blue-500 rounded-lg shadow-[0_0_20px_rgba(59,130,246,0.15)] scale-[1.01]' : ''
      }`}
    >
      {payloadRaw ? (
        <div className="select-none" contentEditable={false}>
          {/* We must disable contentEditable inside the custom node to prevent Tiptap from hijacking keyboard inputs */}
          <SnippetPlayer payload={JSON.parse(payloadRaw) as DAWPayload} snippetId={snippetId} />
        </div>
      ) : isLoading ? (
        <div className="p-10 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center animate-pulse">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
            <span className="text-zinc-600 dark:text-zinc-400 font-medium text-sm tracking-wide">
               Preparing interactive learning workspace...
            </span>
        </div>
      ) : error ? (
        <div className="p-8 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/30 flex flex-col items-center justify-center text-red-500 text-center">
            <span className="font-bold mb-1">Download Failed</span>
            <span className="text-sm">{error}</span>
        </div>
      ) : (
        <div className="p-10 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex flex-col items-center justify-center text-center select-none hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
           <span className="text-zinc-600 dark:text-zinc-300 font-bold mb-2">No Interactive Content</span>
           <span className="text-zinc-400 text-sm max-w-sm">
             Click "Insert Music Snippet" in the Tiptap toolbar to embed a Wait Mode evaluation node.
           </span>
        </div>
      )}
    </NodeViewWrapper>
  );
}
