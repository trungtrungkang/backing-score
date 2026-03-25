"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import {
  Loader2, CheckCircle2, XCircle, Play, ExternalLink,
  Music, Globe, Tag, ChevronLeft, ChevronRight, RefreshCw,
  Eye, Trash2, BookOpen, User, AlertTriangle, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import {
  databases,
  Permission,
  Role,
  Query,
} from "@/lib/appwrite/client";
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_PROJECTS_COLLECTION_ID,
  APPWRITE_WIKI_ARTISTS_COLLECTION_ID,
  APPWRITE_WIKI_COMPOSITIONS_COLLECTION_ID,
} from "@/lib/appwrite/constants";
import type { ProjectDocument } from "@/lib/appwrite/types";

// ── Types ──────────────────────────────────────────────────────────────

interface ReviewProject extends ProjectDocument {
  composerName?: string;
  compositionTitle?: string;
}

const PAGE_SIZE = 20;

// ── Main Page ──────────────────────────────────────────────────────────

export default function AdminReviewPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [projects, setProjects] = useState<ReviewProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [filterImported, setFilterImported] = useState(true); // only show importFile projects
  const [filterPublished, setFilterPublished] = useState<"draft" | "published" | "all">("draft");

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user || !(user.labels?.includes("admin") || user.labels?.includes("wiki_editor"))) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const queries: string[] = [
        Query.orderDesc("$createdAt"),
        Query.limit(PAGE_SIZE * 3), // fetch extra since we filter importFile in memory
        Query.offset(page * PAGE_SIZE),
      ];

      if (filterPublished === "draft") {
        queries.push(Query.equal("published", false));
      } else if (filterPublished === "published") {
        queries.push(Query.equal("published", true));
      }

      const res = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_PROJECTS_COLLECTION_ID,
        queries,
      );

      let docs = res.documents as unknown as ProjectDocument[];
      setTotal(res.total);

      // Client-side filter: only imported projects have an importFile: tag
      if (filterImported) {
        docs = docs.filter(d =>
          (d.tags || []).some(t => t.startsWith("importFile:"))
        );
      }

      // Batch-fetch wiki names for display
      const enriched = await enrichWithWikiNames(docs);
      setProjects(enriched);
    } catch (err: any) {
      toast.error("Failed to load projects: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filterImported, filterPublished]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  async function enrichWithWikiNames(docs: ProjectDocument[]): Promise<ReviewProject[]> {
    const artistIds = [...new Set(docs.flatMap(d => d.wikiComposerIds || []))];
    const compIds   = [...new Set(docs.map(d => d.wikiCompositionId).filter(Boolean) as string[])];

    const artistMap: Record<string, string> = {};
    const compMap:   Record<string, string> = {};

    try {
      if (artistIds.length > 0) {
        const res = await databases.listDocuments(
          APPWRITE_DATABASE_ID,
          APPWRITE_WIKI_ARTISTS_COLLECTION_ID,
          [Query.equal("$id", artistIds), Query.limit(50)],
        );
        res.documents.forEach((d: any) => { artistMap[d.$id] = d.name; });
      }
      if (compIds.length > 0) {
        const res = await databases.listDocuments(
          APPWRITE_DATABASE_ID,
          APPWRITE_WIKI_COMPOSITIONS_COLLECTION_ID,
          [Query.equal("$id", compIds), Query.limit(50)],
        );
        res.documents.forEach((d: any) => { compMap[d.$id] = d.title; });
      }
    } catch {}

    return docs.map(doc => ({
      ...doc,
      composerName: (doc.wikiComposerIds || []).map(id => artistMap[id]).filter(Boolean).join(", "),
      compositionTitle: doc.wikiCompositionId ? compMap[doc.wikiCompositionId] : undefined,
    }));
  }

  async function handlePublish(projectId: string) {
    setActionLoading(projectId + ":publish");
    try {
      await databases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_PROJECTS_COLLECTION_ID,
        projectId,
        {
          published: true,
          publishedAt: new Date().toISOString(),
        },
        [
          Permission.read(Role.any()),
          Permission.update(Role.label("admin")),
          Permission.delete(Role.label("admin")),
        ],
      );
      toast.success("Published ✓");
      setProjects(prev => prev.filter(p => p.$id !== projectId));
      setTotal(t => t - 1);
    } catch (err: any) {
      toast.error("Failed to publish: " + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(projectId: string) {
    if (!confirm("Delete this draft permanently?")) return;
    setActionLoading(projectId + ":reject");
    try {
      await databases.deleteDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_PROJECTS_COLLECTION_ID,
        projectId,
      );
      toast.success("Deleted");
      setProjects(prev => prev.filter(p => p.$id !== projectId));
      setTotal(t => t - 1);
    } catch (err: any) {
      toast.error("Failed to delete: " + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnpublish(projectId: string) {
    setActionLoading(projectId + ":unpublish");
    try {
      await databases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_PROJECTS_COLLECTION_ID,
        projectId,
        { published: false },
        [
          Permission.read(Role.label("admin")),
          Permission.update(Role.label("admin")),
          Permission.delete(Role.label("admin")),
        ],
      );
      toast.success("Unpublished");
      loadProjects();
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (authLoading || (!user && !authLoading)) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl shadow-inner">
          <ClipboardList className="w-7 h-7" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-1">Review Queue</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Preview, publish, or reject imported music projects</p>
        </div>
        <button onClick={loadProjects} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 rounded-2xl">
        {/* Status filter */}
        <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
          {(["draft", "published", "all"] as const).map(v => (
            <button key={v} onClick={() => { setFilterPublished(v); setPage(0); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize ${
                filterPublished === v
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700"
              }`}>{v}
            </button>
          ))}
        </div>

        {/* Imported-only toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div
            onClick={() => { setFilterImported(v => !v); setPage(0); }}
            className={`relative w-10 h-5 rounded-full transition-colors ${filterImported ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${filterImported ? "translate-x-5" : ""}`} />
          </div>
          <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Imported only</span>
        </label>

        <div className="ml-auto text-xs text-zinc-400 font-medium">
          {total} project{total !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Empty state */}
      {!loading && projects.length === 0 && (
        <div className="text-center py-20 text-zinc-400">
          <CheckCircle2 className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <p className="font-semibold text-lg">All clear!</p>
          <p className="text-sm mt-1">No projects matching the current filters.</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-zinc-400" />
        </div>
      )}

      {/* Project cards */}
      {!loading && projects.length > 0 && (
        <div className="space-y-3">
          {projects.map(project => {
            const importFileTag = (project.tags || []).find(t => t.startsWith("importFile:"));
            const importFile = importFileTag?.replace("importFile:", "");
            const difficultyTag = (project.tags || []).find(t => t.startsWith("difficulty-"));
            const difficulty = difficultyTag?.replace("difficulty-", "");
            const isPublishing = actionLoading === project.$id + ":publish";
            const isRejecting  = actionLoading === project.$id + ":reject";
            const isUnpublishing = actionLoading === project.$id + ":unpublish";

            return (
              <div key={project.$id}
                className="bg-white dark:bg-zinc-900/60 backdrop-blur border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-start gap-4 p-5">
                  {/* Icon */}
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center">
                    <Music className="w-5 h-5 text-sky-500" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate max-w-[400px]">
                        {project.name}
                      </h3>
                      {project.published ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-full">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Published
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-full">
                          <AlertTriangle className="w-2.5 h-2.5" /> Draft
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                      {project.composerName && (
                        <span className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400">
                          <User className="w-3 h-3" /> {project.composerName}
                        </span>
                      )}
                      {project.compositionTitle && (
                        <span className="flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400">
                          <BookOpen className="w-3 h-3" /> {project.compositionTitle}
                        </span>
                      )}
                      {difficulty && (
                        <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                          <Tag className="w-3 h-3" /> Level {difficulty}
                        </span>
                      )}
                      {!project.composerName && (
                        <span className="flex items-center gap-1 text-xs text-amber-500">
                          <AlertTriangle className="w-3 h-3" /> No composer linked
                        </span>
                      )}
                    </div>

                    {importFile && (
                      <p className="text-[10px] text-zinc-400 mt-1 font-mono truncate max-w-[400px]">
                        {importFile}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Preview */}
                    <a href={`/editor/project/${project.$id}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors">
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </a>

                    {project.published ? (
                      <button onClick={() => handleUnpublish(project.$id)}
                        disabled={!!actionLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-xl transition-colors disabled:opacity-50">
                        {isUnpublishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                        Unpublish
                      </button>
                    ) : (
                      <>
                        <button onClick={() => handlePublish(project.$id)}
                          disabled={!!actionLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed">
                          {isPublishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Publish
                        </button>
                        <button onClick={() => handleReject(project.$id)}
                          disabled={!!actionLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-xl transition-colors disabled:opacity-50">
                          {isRejecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="flex items-center gap-1 px-3 py-2 text-sm font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Page {page + 1} of {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="flex items-center gap-1 px-3 py-2 text-sm font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
