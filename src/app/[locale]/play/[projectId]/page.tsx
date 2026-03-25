"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  getProject,
  getPlaylist,
  type ProjectDocument,
} from "@/lib/appwrite";
import { PlayShell } from "@/components/player/PlayShell";
import {
  normalizePayload,
  defaultDAWPayload,
  type DAWPayload,
} from "@/lib/daw/types";

export default function PlayProjectPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const projectId = params.projectId as string;
  const playlistId = searchParams.get("list");

  const [project, setProject] = useState<ProjectDocument | null>(null);
  const [composerName, setComposerName] = useState<string>("Loading...");
  const [payload, setPayload] = useState<DAWPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Playlist Context
  const [nextProjectId, setNextProjectId] = useState<string | null>(null);
  const [prevProjectId, setPrevProjectId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const doc = await getProject(projectId);
      setProject(doc);
      
      let resolvedComposerName = doc.creatorEmail ? doc.creatorEmail.split('@')[0] : "Community Composer";
      if (doc.wikiComposerIds?.length) {
        try {
          const { getArtistNamesByIds } = await import("@/lib/appwrite/artists");
          const nameMap = await getArtistNamesByIds(doc.wikiComposerIds);
          const names = doc.wikiComposerIds.map(id => nameMap.get(id)).filter(Boolean);
          if (names.length) resolvedComposerName = names.join(", ");
        } catch (err) {
          console.warn("Failed to resolve composer names", err);
        }
      }
      setComposerName(resolvedComposerName);
      
      if (playlistId) {
         try {
            const pl = await getPlaylist(playlistId);
            if (pl.projectIds) {
               const idx = pl.projectIds.indexOf(projectId);
               if (idx !== -1) {
                  if (idx > 0) setPrevProjectId(pl.projectIds[idx - 1]);
                  if (idx < pl.projectIds.length - 1) setNextProjectId(pl.projectIds[idx + 1]);
               }
            }
         } catch {
            console.warn("Failed to load playlist context");
         }
      }

      try {
        const raw = JSON.parse(doc.payload) as Record<string, unknown> | null;
        setPayload(normalizePayload(raw));
      } catch {
        setPayload(defaultDAWPayload());
      }
    } catch (e) {
      setError(
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Failed to load project"
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 h-[100dvh] w-full bg-[#fdfdfc] dark:bg-[#151518]">
        <div className="text-zinc-500 animate-pulse">Loading score…</div>
      </div>
    );
  }

  if (!project || !payload) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 h-[100dvh] w-full gap-4 bg-[#fdfdfc] dark:bg-[#151518]">
        <div className="text-red-500 dark:text-red-400 font-medium">{error || "Score not found."}</div>
        <Link href="/discover" className="text-sm text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white hover:underline underline-offset-4">
          Back to Discover
        </Link>
      </div>
    );
  }

  return (
    <main className="flex flex-col h-[100dvh] w-full overflow-hidden bg-[#fdfdfc] dark:bg-[#151518] text-zinc-900 dark:text-zinc-100">
      {error && (
        <div className="absolute top-0 w-full bg-red-500/10 text-red-500 text-sm p-2 text-center border-b border-red-500/20 z-50 shrink-0">
          {error}
        </div>
      )}
      <PlayShell
        projectId={projectId}
        projectName={project.name}
        composer={composerName}
        payload={payload}
        difficulty={project.difficulty}
        playlistId={playlistId}
        nextProjectId={nextProjectId}
        prevProjectId={prevProjectId}
        onNext={() => nextProjectId && router.push(`/play/${nextProjectId}?list=${playlistId}&autoplay=true`)}
        onPrev={() => prevProjectId && router.push(`/play/${prevProjectId}?list=${playlistId}&autoplay=true`)}
        autoplayOnLoad={searchParams.get("autoplay") === "true"}
      />
    </main>
  );
}
