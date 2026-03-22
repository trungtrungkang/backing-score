"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getProject } from "@/lib/appwrite";
import {
  normalizePayload,
  type DAWPayload,
} from "@/lib/daw/types";
import { MusicXMLVisualizer } from "@/components/editor/MusicXMLVisualizer";

import { Suspense } from "react";

/**
 * Embed view — minimal player for iframe (no nav).
 * Route: /embed?p=<projectId>
 */
function EmbedContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("p") ?? "";
  const [payload, setPayload] = useState<DAWPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) {
      setError("No project specified");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const doc = await getProject(projectId);
      try {
        const raw = JSON.parse(doc.payload) as Record<string, unknown> | null;
        setPayload(normalizePayload(raw));
      } catch {
        setPayload(normalizePayload(null));
      }
    } catch (e) {
      setError(
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Project not found or not shared"
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
      <div className="min-h-[240px] flex items-center justify-center p-4 bg-background text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="min-h-[240px] flex items-center justify-center p-4 bg-background text-destructive text-sm">
        {error ?? "Project not found"}
      </div>
    );
  }

  const scoreFileId = payload.notationData?.fileId;

  if (!scoreFileId) {
    return (
      <div className="min-h-[240px] flex items-center justify-center p-4 bg-background text-muted-foreground text-sm">
        No score to display
      </div>
    );
  }

  return (
    <div className="min-h-0 flex flex-col bg-background">
      <MusicXMLVisualizer scoreFileId={scoreFileId} className="flex-1 w-full bg-white dark:bg-zinc-950 overflow-hidden" isDarkMode={false} />
    </div>
  );
}

export default function EmbedPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading Embed...</div>}>
      <EmbedContent />
    </Suspense>
  );
}
