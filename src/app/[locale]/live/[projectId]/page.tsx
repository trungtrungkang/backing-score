"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getProject,
  type ProjectDocument,
} from "@/lib/appwrite";
import { LiveShell } from "@/components/live/LiveShell";
import {
  normalizePayload,
  defaultDAWPayload,
  type DAWPayload,
} from "@/lib/daw/types";

export default function LiveProjectPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<ProjectDocument | null>(null);
  const [payload, setPayload] = useState<DAWPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const doc = await getProject(projectId);
      setProject(doc);
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
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl font-medium tracking-widest uppercase">Loading Live Mode...</p>
        </div>
      </div>
    );
  }

  if (error || !project || !payload) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
        <div className="text-red-400 bg-red-900/20 px-6 py-4 rounded-lg border border-red-900">Error: {error || "Failed to load"}</div>
        <button onClick={load} className="px-6 py-3 bg-white/10 rounded hover:bg-white/20 font-bold transition-colors">Retry Connection</button>
      </div>
    );
  }

  return <LiveShell projectId={projectId} projectName={project.name} payload={payload} />;
}
