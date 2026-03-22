"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { getProject } from "@/lib/appwrite";
import {
  normalizePayload,
  type DAWPayload,
} from "@/lib/daw/types";
import { MusicXMLVisualizer } from "@/components/editor/MusicXMLVisualizer";
import { Button } from "@/components/ui/button";

import { Suspense } from "react";

/**
 * Share view — minimal player for shared project.
 * Route: /s?p=<projectId>
 * Loads project (must be published or owner); shows score + "Open in app".
 */
function ShareContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("p") ?? "";
  const [projectName, setProjectName] = useState<string | null>(null);
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
      setProjectName(doc.name);
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
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
        <p className="text-destructive mb-4">{error ?? "Project not found"}</p>
        <Link href="/" className="text-primary underline underline-offset-2">
          Back to Home
        </Link>
      </div>
    );
  }

  const scoreFileId = payload.notationData?.fileId;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="shrink-0 border-b border-border px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-semibold truncate">{projectName ?? "Shared project"}</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/p/${projectId}`}>Open in app</Link>
        </Button>
      </header>
      <main className="flex-1 min-h-0 p-4">
        {scoreFileId ? (
          <MusicXMLVisualizer scoreFileId={scoreFileId} className="w-full h-[80vh] border border-border rounded shadow-sm overflow-hidden" />
        ) : (
          <div className="max-w-md mx-auto py-12 text-center text-muted-foreground">
            <p>This project has no score to display.</p>
            <Link href={`/p/${projectId}`} className="text-primary underline underline-offset-2 mt-2 inline-block">
              Open in app
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Loading Share View...</p></div>}>
      <ShareContent />
    </Suspense>
  );
}
