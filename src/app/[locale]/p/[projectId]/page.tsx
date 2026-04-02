"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
import JSZip from "jszip";
import {
  getProject,
  updateProject,
  uploadProjectFile,
  getFileViewUrl,
  Permission,
  Role,
  type ProjectDocument,
  type ProjectPayload,
} from "@/lib/appwrite";
import { toast } from "sonner";
import { EditorShell } from "@/components/editor/EditorShell";
import { listInstruments } from "@/lib/appwrite/instruments";
import { listGenres } from "@/lib/appwrite/genres";
import { listCompositions } from "@/lib/appwrite/compositions";
import { listArtists } from "@/lib/appwrite/artists";
import type { InstrumentDocument, GenreDocument, CompositionDocument, ArtistDocument } from "@/lib/appwrite/types";
import {
  normalizePayload,
  defaultDAWPayload,
  type DAWPayload,
  type AudioTrack,
} from "@/lib/daw/types";

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { user, loading: authLoading } = useAuth();
  const [project, setProject] = useState<ProjectDocument | null>(null);
  const [name, setName] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [payload, setPayload] = useState<DAWPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [uploadingScore, setUploadingScore] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [openingFile, setOpeningFile] = useState(false);
  const [openFileError, setOpenFileError] = useState<string | null>(null);
  // Wiki entity state (Phase 2.5)
  const [wikiGenreId, setWikiGenreId] = useState<string | undefined>();
  const [wikiInstrumentIds, setWikiInstrumentIds] = useState<string[]>([]);
  const [wikiInstruments, setWikiInstruments] = useState<InstrumentDocument[]>([]);
  const [wikiGenres, setWikiGenres] = useState<GenreDocument[]>([]);
  const [wikiCompositionId, setWikiCompositionId] = useState<string | undefined>();
  const [wikiComposerIds, setWikiComposerIds] = useState<string[]>([]);
  const [wikiCompositions, setWikiCompositions] = useState<CompositionDocument[]>([]);
  const [wikiComposers, setWikiComposers] = useState<ArtistDocument[]>([]);

  const router = useRouter();
  const t = useTranslations("ProjectDetail");

  // Enforce access control: non-owners go to /play mode
  useEffect(() => {
    if (!loading && !authLoading && project) {
      if (!user || (user.$id !== project.userId && !user.labels?.includes("admin"))) {
        router.replace(`/play/${projectId}`);
      }
    }
  }, [loading, authLoading, project, user, router, projectId]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const doc = await getProject(projectId);
      setProject(doc);
      setName(doc.name);
      setTags(doc.tags || []);
      setWikiGenreId(doc.wikiGenreId || undefined);
      setWikiInstrumentIds(doc.wikiInstrumentIds || []);
      setWikiCompositionId(doc.wikiCompositionId || undefined);
      setWikiComposerIds(doc.wikiComposerIds || []);
      setDescription(doc.description ?? "");
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
    // Fetch wiki data for pickers
    Promise.all([listInstruments(100), listGenres(100), listCompositions(100), listArtists(100)]).then(([insts, gens, comps, arts]) => {
      setWikiInstruments(insts);
      setWikiGenres(gens);
      setWikiCompositions(comps);
      setWikiComposers(arts);
    }).catch(() => {});
  }, [load]);

  const isOwner = user && project && (project.userId === user.$id || user.labels?.includes("admin"));
  const isCurator = user && (user.labels?.includes("admin") || user.labels?.includes("curator"));

  const handleSave = useCallback(async () => {
    if (!project || !isOwner || saving || payload === null) return;
    setSaving(true);
    setError(null);
    try {
      await updateProject(projectId, {
        name: name.trim() || "Untitled",
        payload: payload as ProjectPayload,
        tags: tags,
        wikiGenreId: wikiGenreId || "",
        wikiInstrumentIds: wikiInstrumentIds,
        wikiCompositionId: wikiCompositionId || "",
        wikiComposerIds: wikiComposerIds,
      });
      setProject((prev) =>
        prev ? { ...prev, name: name.trim() || "Untitled" } : null
      );
    } catch (e) {
      setError(
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Failed to save"
      );
    } finally {
      setSaving(false);
    }
  }, [project, projectId, isOwner, saving, name, payload, tags, wikiGenreId, wikiInstrumentIds, wikiCompositionId, wikiComposerIds]);

  const handleUploadScore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file || !project || !isOwner || payload === null || uploadingScore) return;
    e.target.value = "";
    setUploadingScore(true);
    setUploadError(null);
    try {
      // Decompress .mxl on the fly
      if (file.name.toLowerCase().endsWith(".mxl")) {
        try {
          const zip = new JSZip();
          const loadedZip = await zip.loadAsync(file);
          
          const containerFile = loadedZip.file("META-INF/container.xml");
          if (!containerFile) throw new Error("Invalid .mxl file: Missing META-INF/container.xml");
          const containerXml = await containerFile.async("string");
          
          const parser = new DOMParser();
          const doc = parser.parseFromString(containerXml, "text/xml");
          const rootfiles = doc.getElementsByTagName("rootfile");
          
          let targetPath = "";
          for (let i = 0; i < rootfiles.length; i++) {
             const mediaType = rootfiles[i].getAttribute("media-type");
             if (!mediaType || mediaType === "application/vnd.recordare.musicxml+xml") {
                 targetPath = rootfiles[i].getAttribute("full-path") || "";
                 break;
             }
          }
          if (!targetPath && rootfiles.length > 0) targetPath = rootfiles[0].getAttribute("full-path") || "";
          if (!targetPath) throw new Error("Invalid .mxl: no rootfile found");

          const xmlFile = loadedZip.file(targetPath);
          if (!xmlFile) throw new Error(`Missing root file in archive: ${targetPath}`);

          const xmlContent = await xmlFile.async("blob");
          const baseName = file.name.replace(/\.mxl$/i, ".musicxml");
          file = new File([xmlContent], baseName, { type: "application/xml" });
        } catch (mxlErr: any) {
          throw new Error(`Failed to extract .mxl archive: ${mxlErr.message}`);
        }
      }

      const { fileId } = await uploadProjectFile(projectId, file);
      
      let newPayload: DAWPayload = { ...payload };
      newPayload.notationData = {
        type: "music-xml",
        fileId: fileId,
        timemap: payload.notationData?.timemap || [],
      };
      newPayload.metadata = {
        ...(newPayload.metadata || {}),
        scoreSynthMuted: true,
      };
      
      setPayload(newPayload);
      await updateProject(projectId, {
        payload: newPayload as ProjectPayload,
      });
    } catch (err: any) {
      console.error("Upload Score error:", err);
      setUploadError(
        err?.message ? `Upload failed: ${err.message}` : "Upload failed"
      );
    } finally {
      setUploadingScore(false);
    }
  };

  const [uploadingCover, setUploadingCover] = useState(false);
  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project || !isOwner || uploadingCover) return;
    e.target.value = "";
    setUploadingCover(true);
    try {
      const { fileId } = await uploadProjectFile(projectId, file);
      const url = getFileViewUrl(fileId);
      await updateProject(projectId, { coverUrl: url });
      setProject({ ...project, coverUrl: url } as ProjectDocument);
      toast.success("Cover image uploaded successfully.");
    } catch (err: any) {
      console.error("Upload Cover error:", err);
      toast.error(err?.message ? `Failed to upload: ${err.message}` : "Failed to upload cover.");
    } finally {
      setUploadingCover(false);
    }
  };

  const MAX_AUDIO_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleAddAudioTrack = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project || !isOwner || payload === null || uploadingAudio) return;
    e.target.value = "";

    if (file.size > MAX_AUDIO_FILE_SIZE) {
      setUploadError(`File too large. Maximum size is 10MB.`);
      toast.error(`File too large. Maximum size is 10MB.`);
      return;
    }

    setUploadingAudio(true);
    setUploadError(null);
    try {
      const { fileId } = await uploadProjectFile(projectId, file);
      
      let newPayload: DAWPayload = { ...payload };
      newPayload.audioTracks = [
        ...payload.audioTracks,
        {
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^/.]+$/, ""), // Name without extension
          fileId: fileId,
        } as AudioTrack,
      ];
      
      setPayload(newPayload);
      await updateProject(projectId, {
        payload: newPayload as ProjectPayload,
      });
    } catch (err: any) {
      console.error("Add Audio Track error:", err);
      setUploadError(
        err?.message ? `Upload failed: ${err.message}` : "Upload failed"
      );
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    if (!project || !isOwner || payload === null) return;
    try {
      if (trackId === "score-midi") {
        const newPayload: DAWPayload = { ...payload };
        delete newPayload.notationData;
        setPayload(newPayload);
        await updateProject(projectId, {
          payload: newPayload as ProjectPayload,
        });
        return;
      }

      const updatedTracks = payload.audioTracks.filter((t) => t.id !== trackId);
      const newPayload: DAWPayload = {
        ...payload,
        audioTracks: updatedTracks,
      };
      setPayload(newPayload);
      await updateProject(projectId, {
        payload: newPayload as ProjectPayload,
      });
    } catch (err: any) {
      console.error("Delete Track error:", err);
    }
  };

  const handleUploadTrackFile = useCallback(
    async (trackId: string, file: File) => {
      if (!project || !isOwner || payload === null || uploadingAudio) return;

      if (file.size > MAX_AUDIO_FILE_SIZE) {
        setUploadError(`File too large. Maximum size is 10MB.`);
        toast.error(`File too large. Maximum size is 10MB.`);
        return;
      }

      setUploadingAudio(true);
      setUploadError(null);
      try {
        const { fileId } = await uploadProjectFile(projectId, file);
        const updatedTracks = payload.audioTracks.map((t) => {
          if (t.id !== trackId) return t;
          return {
            ...t,
            fileId: fileId,
          } as typeof t;
        });

        const newPayload: DAWPayload = {
          ...payload,
          audioTracks: updatedTracks,
        };
        setPayload(newPayload);

        await updateProject(projectId, {
          payload: newPayload as ProjectPayload,
        });
      } catch (err: any) {
        console.error("Upload Track File error:", err);
        setUploadError(
          err?.message ? `Upload failed: ${err.message}` : "Upload failed"
        );
      } finally {
        setUploadingAudio(false);
      }
    },
    [project, projectId, isOwner, payload, uploadingAudio]
  );

  const handlePublish = async () => {
    if (!project || !isOwner || publishing) return;
    setPublishing(true);
    setError(null);
    try {
      const publishPermissions = [
        Permission.read(Role.user(project.userId)),
        Permission.update(Role.user(project.userId)),
        Permission.delete(Role.user(project.userId)),
        Permission.read(Role.any()),
      ];
      await updateProject(
        projectId,
        {
          published: true,
          publishedAt: new Date().toISOString(),
          description: description.trim() || undefined,
          tags: tags,
          wikiGenreId: wikiGenreId || "",
          wikiInstrumentIds: wikiInstrumentIds,
          wikiCompositionId: wikiCompositionId || "",
          wikiComposerIds: wikiComposerIds,
        },
        publishPermissions
      );
      setProject((prev) =>
        prev
          ? {
              ...prev,
              published: true,
              publishedAt: new Date().toISOString(),
              description: description.trim() || undefined,
            }
          : null
      );
    } catch (e) {
      setError(
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Failed to publish"
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!project || !isOwner || publishing) return;
    setPublishing(true);
    setError(null);
    try {
      await updateProject(projectId, {
        published: false,
        publishedAt: null as any,
      });
      setProject((prev) =>
        prev
          ? {
              ...prev,
              published: false,
              publishedAt: undefined,
            }
          : null
      );
    } catch (e) {
      setError(
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Failed to unpublish"
      );
    } finally {
      setPublishing(false);
    }
  }; // removed useCallback, simply recreate or wrap in useCallback with tags

  if (authLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 h-[calc(100vh-80px)] w-full">
        <div className="text-muted-foreground animate-pulse">{t("loading")}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 h-[calc(100vh-80px)] w-full">
        <div className="text-muted-foreground animate-pulse">{error || t("loadingProject")}</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 h-[calc(100vh-80px)] w-full gap-4">
        <div className="text-destructive font-medium">{error || t("projectNotFound")}</div>
        <Link href="/dashboard" className="text-sm text-foreground hover:underline underline-offset-4">
          {t("backToProjects")}
        </Link>
      </div>
    );
  }

  return (
    <main className="flex flex-col h-[calc(100vh-80px)] w-full overflow-hidden bg-background text-foreground">
      {error && (
        <div className="w-full bg-destructive/10 text-destructive text-sm p-2 text-center border-b border-destructive/20 z-10 shrink-0">
          {error}
        </div>
      )}

      {payload ? (
        <div className="flex-1 w-full min-h-0">
          <EditorShell
            projectId={projectId}
            projectName={name}
            payload={payload}
            isOwner={!!isOwner}
            isPublished={!!project.published}
            saving={saving}
            publishing={publishing}
            onSave={handleSave}
            onPublish={isCurator ? handlePublish : undefined}
            onUnpublish={isCurator ? handleUnpublish : undefined}
            onPayloadChange={setPayload}
            onUploadTrackFile={handleUploadTrackFile}
            onNameChange={isOwner ? setName : undefined}
            onUploadScore={isOwner ? handleUploadScore : undefined}
            onAddAudioTrack={isOwner ? handleAddAudioTrack : undefined}
            onDeleteTrack={isOwner ? handleDeleteTrack : undefined}
            tags={tags}
            onTagsChange={isOwner ? setTags : undefined}
            wikiGenreId={wikiGenreId}
            onWikiGenreIdChange={isOwner ? setWikiGenreId : undefined}
            wikiInstrumentIds={wikiInstrumentIds}
            onWikiInstrumentIdsChange={isOwner ? setWikiInstrumentIds : undefined}
            wikiInstruments={wikiInstruments}
            wikiGenres={wikiGenres}
            wikiCompositionId={wikiCompositionId}
            onWikiCompositionIdChange={isOwner ? setWikiCompositionId : undefined}
            wikiComposerIds={wikiComposerIds}
            onWikiComposerIdsChange={isOwner ? setWikiComposerIds : undefined}
            wikiCompositions={wikiCompositions}
            wikiComposers={wikiComposers}
            uploadingScore={uploadingScore}
            uploadingAudio={uploadingAudio}
            uploadError={uploadError}
            onUploadCover={isOwner ? handleUploadCover : undefined}
            uploadingCover={uploadingCover}
            coverUrl={project.coverUrl}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground">
          {t("noProjectData")}
        </div>
      )}
    </main>
  );
}
