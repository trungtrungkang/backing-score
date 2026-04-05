"use client";

import React, { useEffect, useState } from "react";
import { getProject, type ProjectDocument } from "@/lib/appwrite";
import { normalizePayload, type DAWPayload } from "@/lib/daw/types";
import { PlayShell } from "@/components/player/PlayShell";
import { Loader2 } from "lucide-react";
import { useUniversalSync } from "./UniversalSyncProvider";

export function LiveKitPlayShellBridge({ projectId }: { projectId: string }) {
  const { role, latestXmlCoordinates, broadcastPayload } = useUniversalSync();
  const [project, setProject] = useState<ProjectDocument | null>(null);
  const [payload, setPayload] = useState<DAWPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const doc = await getProject(projectId);
        if (!active) return;
        setProject(doc);
        
        // Cần phải parse payload từ String thành Object trước khi đưa vào hàm normalize
        let rawPayload = null;
        try {
          rawPayload = JSON.parse(doc.payload);
        } catch { }

        const normalPayload = normalizePayload(rawPayload);
        setPayload(normalPayload);
      } catch (err: any) {
        if (active) setError(err.message || "Failed to load interactive project");
      }
    })();
    return () => { active = false; };
  }, [projectId]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-100 rounded-xl">
        <p className="text-red-500 font-medium">Failed to load score: {error}</p>
      </div>
    );
  }

  if (!project || !payload) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900 rounded-xl">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
        <p className="text-sm text-zinc-500">Loading interactive score from Ecosystem...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-white dark:bg-black overflow-hidden pointer-events-auto">
      {/* PlayShell is the DAW Player wrapper */}
      <PlayShell
        projectId={project.$id}
        projectName={project.name}
        payload={payload}
        isAssignmentContext={true} // bypass pro restrictions during classroom
        syncMode={role === "teacher" ? "host" : "guest"}
        incomingXmlCoords={latestXmlCoordinates || undefined}
        onBroadcastXmlCoords={(coords) => {
           broadcastPayload({ type: "SYNC_XML", xmlCoords: coords });
        }}
      />
    </div>
  );
}
