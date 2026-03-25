"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import {
  Loader2, CheckCircle2, XCircle, Play, ExternalLink,
  Music, Globe, Tag, ChevronLeft, ChevronRight, RefreshCw,
  Eye, Trash2, BookOpen, User, AlertTriangle, ClipboardList,
  Sparkles, Wand2, X, Save, RotateCcw,
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

interface AIEnrichment {
  description: string;
  tags: string[];
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  coverPrompt: string;
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

  // AI Enrichment state
  const [enrichments, setEnrichments] = useState<Record<string, AIEnrichment>>({});
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

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

  // ── AI Enrichment ────────────────────────────────────────────────────

  async function handleAIEnrich(projectId: string) {
    setEnrichingIds(prev => new Set(prev).add(projectId));
    try {
      const res = await fetch("/api/ai-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (data.results?.[projectId]?.status === "ok") {
        setEnrichments(prev => ({ ...prev, [projectId]: data.results[projectId] }));
        toast.success("AI suggestions ready");
      } else {
        toast.error("AI enrich failed: " + (data.results?.[projectId]?.error || data.error || "Unknown error"));
      }
    } catch (err: any) {
      toast.error("AI enrich error: " + err.message);
    } finally {
      setEnrichingIds(prev => { const n = new Set(prev); n.delete(projectId); return n; });
    }
  }

  async function handleBulkEnrich() {
    const draftIds = projects.filter(p => !p.published).map(p => p.$id);
    if (!draftIds.length) { toast.info("No drafts to enrich"); return; }
    setBulkEnriching(true);
    setBulkProgress({ done: 0, total: draftIds.length });
    for (let i = 0; i < draftIds.length; i++) {
      await handleAIEnrich(draftIds[i]);
      setBulkProgress({ done: i + 1, total: draftIds.length });
    }
    setBulkEnriching(false);
    toast.success(`Enriched ${draftIds.length} projects`);
  }

  async function handleApplyEnrichment(projectId: string) {
    const enrichment = enrichments[projectId];
    if (!enrichment) return;
    setActionLoading(projectId + ":apply");
    try {
      // Merge AI tags with existing tags (avoid duplicates)
      const project = projects.find(p => p.$id === projectId);
      const existingTags = (project?.tags || []).filter(t => !t.startsWith("importFile:") && !t.startsWith("difficulty-"));
      const mergedTags = [...new Set([...existingTags, ...enrichment.tags, enrichment.difficulty])];

      await databases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_PROJECTS_COLLECTION_ID,
        projectId,
        {
          description: enrichment.description,
          tags: mergedTags,
        },
      );
      toast.success("Applied AI suggestions ✓");
      setEnrichments(prev => { const n = { ...prev }; delete n[projectId]; return n; });
      // Update local state
      setProjects(prev => prev.map(p => p.$id === projectId ? { ...p, description: enrichment.description, tags: mergedTags } : p));
    } catch (err: any) {
      toast.error("Failed to apply: " + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  function handleDiscardEnrichment(projectId: string) {
    setEnrichments(prev => { const n = { ...prev }; delete n[projectId]; return n; });
  }

  function handleEditEnrichment(projectId: string, field: keyof AIEnrichment, value: any) {
    setEnrichments(prev => ({
      ...prev,
      [projectId]: { ...prev[projectId], [field]: value },
    }));
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
        <div className="flex items-center gap-2">
          <button onClick={handleBulkEnrich} disabled={loading || bulkEnriching}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-violet-100 dark:bg-violet-500/10 hover:bg-violet-200 dark:hover:bg-violet-500/20 text-violet-700 dark:text-violet-400 font-semibold rounded-xl transition-colors disabled:opacity-50">
            {bulkEnriching ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {bulkProgress.done}/{bulkProgress.total}</>
            ) : (
              <><Wand2 className="w-4 h-4" /> Enrich All Drafts</>
            )}
          </button>
          <button onClick={loadProjects} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
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
                    {/* AI Enrich */}
                    <button onClick={() => handleAIEnrich(project.$id)}
                      disabled={enrichingIds.has(project.$id) || !!enrichments[project.$id]}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20 rounded-xl transition-colors disabled:opacity-50">
                      {enrichingIds.has(project.$id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {enrichments[project.$id] ? "Done" : "AI Enrich"}
                    </button>

                    {/* Preview */}
                    <a href={`/play/${project.$id}`} target="_blank" rel="noopener noreferrer"
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

              {/* AI Enrichment Suggestions Panel */}
              {enrichments[project.$id] && (
                <div className="border-t border-violet-200 dark:border-violet-500/20 bg-violet-50/50 dark:bg-violet-500/5 px-5 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-violet-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">AI Suggestions</span>
                    <div className="ml-auto flex items-center gap-2">
                      <button onClick={() => handleApplyEnrichment(project.$id)}
                        disabled={actionLoading === project.$id + ":apply"}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors shadow-lg shadow-violet-600/20 disabled:opacity-50">
                        {actionLoading === project.$id + ":apply" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Apply
                      </button>
                      <button onClick={() => handleDiscardEnrichment(project.$id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                        <X className="w-3 h-3" /> Discard
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Description */}
                    <div className="md:col-span-2">
                      <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1 block">Description</label>
                      <textarea
                        value={enrichments[project.$id].description}
                        onChange={(e) => handleEditEnrichment(project.$id, "description", e.target.value)}
                        rows={2}
                        className="w-full text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none focus:border-violet-500 resize-none"
                      />
                    </div>

                    {/* Tags */}
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1 block">Tags</label>
                      <input
                        value={enrichments[project.$id].tags.join(", ")}
                        onChange={(e) => handleEditEnrichment(project.$id, "tags", e.target.value.split(",").map((t: string) => t.trim()).filter(Boolean))}
                        className="w-full text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none focus:border-violet-500"
                        placeholder="Comma-separated tags"
                      />
                    </div>

                    {/* Difficulty */}
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1 block">Difficulty</label>
                      <select
                        value={enrichments[project.$id].difficulty}
                        onChange={(e) => handleEditEnrichment(project.$id, "difficulty", e.target.value)}
                        className="w-full text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none focus:border-violet-500"
                      >
                        <option value="Beginner">Beginner</option>
                        <option value="Intermediate">Intermediate</option>
                        <option value="Advanced">Advanced</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
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
