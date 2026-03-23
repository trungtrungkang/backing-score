"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import {
  ShieldAlert, Loader2, Upload, CheckCircle2, XCircle, SkipForward,
  Music, FileMusic, CheckSquare, Square, RefreshCw, ChevronDown, ChevronRight,
  AlertTriangle, Link2, Search, BookOpen, Save, ExternalLink, Globe, Plus,
  Eye, Play, X as XIcon, Maximize2, Minimize2
} from "lucide-react";
import { toast } from "sonner";
import { VerovioWorkerProxy, type IVerovioWorkerProxy } from "@/lib/verovio/worker-proxy";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface WikiEntity {
  $id: string;
  name?: string;
  title?: string;
  slug: string;
  genreId?: string;
}

interface ManifestPiece {
  file: string;
  composer: string;
  composer_key: string;
  title: string;
  displayName: string;
  parts: number;
  measures: number;
  key?: string;
  alreadyImported?: boolean;
  autoMatchedArtistId?: string | null;
  autoMatchedCompositionId?: string | null;
}

interface WikiOverrides {
  [file: string]: {
    customName?: string;
    wikiArtistId?: string;
    wikiCompositionId?: string;
    wikiGenreId?: string;
  };
}

interface ImportResult {
  file: string;
  status: "imported" | "skipped" | "error";
  projectId?: string;
  error?: string;
}

interface WikiSearchResult {
  title: string;
  snippet: string;
  pageId: number;
}

interface WikiArticleDetail {
  title: string;
  extract: string;
  description: string;
  fullDescription: string | null;
  imageUrl: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function AdminImportPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"import" | "lookup">("import");

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user || !(user.labels?.includes("admin") || user.labels?.includes("wiki_editor"))) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Page Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 rounded-2xl shadow-inner">
          <FileMusic className="w-7 h-7" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-1">Music Import Hub</h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Import MusicXML scores and manage wiki compositions
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-6 p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("import")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "import"
              ? "bg-white dark:bg-zinc-700 text-sky-600 dark:text-sky-400 shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Upload className="w-4 h-4" /> MusicXML Import
        </button>
        <button
          onClick={() => setActiveTab("lookup")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "lookup"
              ? "bg-white dark:bg-zinc-700 text-violet-600 dark:text-violet-400 shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Globe className="w-4 h-4" /> Composition Lookup
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "import" ? <MusicXMLImportTab user={user} /> : <CompositionLookupTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 1: MusicXML Import (existing functionality)
// ═══════════════════════════════════════════════════════════════════════════════

function MusicXMLImportTab({ user }: { user: any }) {
  const [pieces, setPieces] = useState<ManifestPiece[]>([]);
  const [wikiArtists, setWikiArtists] = useState<WikiEntity[]>([]);
  const [wikiCompositions, setWikiCompositions] = useState<WikiEntity[]>([]);
  const [wikiGenres, setWikiGenres] = useState<WikiEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [wikiOverrides, setWikiOverrides] = useState<WikiOverrides>({});
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [composerFilter, setComposerFilter] = useState<string>("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");

  const loadManifest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/import-musicxml");
      const data = await resp.json();
      if (data.error) {
        setError(data.error);
        setPieces([]);
      } else {
        setPieces(data.pieces || []);
        setWikiArtists(data.wikiArtists || []);
        setWikiCompositions(data.wikiCompositions || []);
        setWikiGenres(data.wikiGenres || []);

        const overrides: WikiOverrides = {};
        for (const p of data.pieces || []) {
          overrides[p.file] = {
            customName: p.displayName || "",
            wikiArtistId: p.autoMatchedArtistId || "",
            wikiCompositionId: p.autoMatchedCompositionId || "",
            wikiGenreId: "",
          };
        }
        setWikiOverrides(overrides);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadManifest(); }, [loadManifest]);

  const availablePieces = pieces.filter((p) => !p.alreadyImported);
  const allSelected = availablePieces.length > 0 && availablePieces.every((p) => selected.has(p.file));

  function toggleSelect(file: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(availablePieces.map((p) => p.file)));
  }

  function getOverride(file: string) {
    return wikiOverrides[file] || { customName: "", wikiArtistId: "", wikiCompositionId: "", wikiGenreId: "" };
  }

  function setOverride(file: string, field: string, value: string) {
    setWikiOverrides((prev) => ({ ...prev, [file]: { ...prev[file], [field]: value } }));
  }

  function applyArtistToAll(composerKey: string, artistId: string) {
    setWikiOverrides((prev) => {
      const next = { ...prev };
      for (const p of pieces) {
        if (p.composer_key === composerKey) {
          next[p.file] = { ...next[p.file], wikiArtistId: artistId };
        }
      }
      return next;
    });
    toast.success(`Applied to all "${composerKey}" pieces`);
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setImporting(true);
    setResults([]);
    setProgress({ current: 0, total: selected.size });

    try {
      const items = Array.from(selected).map((file) => {
        const override = getOverride(file);
        return {
          file,
          customName: override.customName || undefined,
          wikiArtistId: override.wikiArtistId || undefined,
          wikiCompositionId: override.wikiCompositionId || undefined,
          wikiGenreId: override.wikiGenreId || undefined,
        };
      });

      const resp = await fetch("/api/import-musicxml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, adminUserId: user?.$id || "system" }),
      });
      const data = await resp.json();

      if (data.error) {
        toast.error(data.error);
      } else {
        setResults(data.results || []);
        toast.success(`Imported ${data.imported} projects (${data.skipped} skipped, ${data.errors} errors)`);
        setProgress({ current: selected.size, total: selected.size });
        await loadManifest();
        setSelected(new Set());
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  }

  const groupedPieces = pieces.reduce((acc, p) => {
    const key = p.composer || "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {} as Record<string, ManifestPiece[]>);

  const composerKeys = Object.keys(groupedPieces).sort();
  const filteredGroups = composerFilter === "all"
    ? groupedPieces
    : { [composerFilter]: groupedPieces[composerFilter] || [] };

  const filteredPieces = composerFilter === "all" ? pieces : pieces.filter(p => p.composer === composerFilter);
  const filteredAvailable = filteredPieces.filter(p => !p.alreadyImported);

  function toggleGroup(composer: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(composer)) next.delete(composer);
      else next.add(composer);
      return next;
    });
  }

  return (
    <>
      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/20 rounded-2xl text-red-700 dark:text-red-400 text-sm">
          <p className="font-semibold mb-1">⚠ Error loading manifest</p>
          <p>{error}</p>
          <p className="mt-2 text-xs opacity-70">Run: <code className="px-1 py-0.5 bg-red-100 dark:bg-red-900/30 rounded">source /tmp/music21-env/bin/activate && python3 scripts/crawl-musicxml.py</code></p>
        </div>
      )}

      {/* Stats bar */}
      {!loading && pieces.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 rounded-2xl">
          <div className="flex items-center gap-2 text-sm">
            <Music className="w-4 h-4 text-sky-500" />
            <span className="text-zinc-600 dark:text-zinc-400"><strong className="text-zinc-900 dark:text-white">{filteredPieces.length}</strong> total</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-zinc-600 dark:text-zinc-400"><strong className="text-emerald-600 dark:text-emerald-400">{filteredPieces.filter(p => p.alreadyImported).length}</strong> imported</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Upload className="w-4 h-4 text-amber-500" />
            <span className="text-zinc-600 dark:text-zinc-400"><strong className="text-amber-600 dark:text-amber-400">{filteredAvailable.length}</strong> available</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link2 className="w-4 h-4 text-violet-500" />
            <span className="text-zinc-600 dark:text-zinc-400">
              Wiki: <strong className="text-violet-600 dark:text-violet-400">{wikiArtists.length}</strong> artists,{" "}
              <strong className="text-violet-600 dark:text-violet-400">{wikiCompositions.length}</strong> compositions,{" "}
              <strong className="text-violet-600 dark:text-violet-400">{wikiGenres.length}</strong> genres
            </span>
          </div>
          <div className="flex-1" />
          {/* Composer filter */}
          <select
            value={composerFilter}
            onChange={(e) => setComposerFilter(e.target.value)}
            className="text-xs px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-lg text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-sky-500/30 font-semibold">
            <option value="all">All composers ({composerKeys.length})</option>
            {composerKeys.map(c => (
              <option key={c} value={c}>{c} ({groupedPieces[c].length})</option>
            ))}
          </select>
          <button onClick={loadManifest} disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold text-xs rounded-lg transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={toggleAll}
            className="flex items-center gap-2 text-sm font-semibold text-sky-600 dark:text-sky-400 hover:underline">
            {allSelected ? "Deselect All" : "Select All"}
          </button>
          <button onClick={handleImport} disabled={importing || selected.size === 0}
            className="flex items-center gap-2 px-5 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-semibold text-sm rounded-xl transition-colors shadow-lg shadow-sky-600/20 disabled:cursor-not-allowed disabled:shadow-none">
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Import {selected.size > 0 ? `(${selected.size})` : "Selected"}
          </button>
        </div>
      )}

      {/* Progress bar */}
      {progress && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
              {importing ? "Importing..." : "Import complete"} {progress.current}/{progress.total}
            </span>
          </div>
          <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="mb-6 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl shadow-xl">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">Import Results</h3>
          <div className="max-h-40 overflow-y-auto space-y-1.5 text-xs">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                {r.status === "imported" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                {r.status === "skipped" && <SkipForward className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                {r.status === "error" && <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                <span className="text-zinc-600 dark:text-zinc-400 truncate">{r.file}</span>
                {r.status === "error" && <span className="text-red-500 truncate">{r.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File list grouped by composer */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
      ) : pieces.length === 0 && !error ? (
        <div className="text-center py-16 text-zinc-400"><FileMusic className="w-12 h-12 mx-auto mb-4 opacity-30" /><p>No files found in manifest</p></div>
      ) : (
        <div className="space-y-4">
          {Object.entries(filteredGroups).map(([composer, composerPieces]) => {
            const composerKey = composerPieces[0]?.composer_key;
            const hasArtistMatch = composerPieces.some((p) => p.autoMatchedArtistId);
            const groupOverride = getOverride(composerPieces[0]?.file);
            const isGroupCollapsed = collapsedGroups.has(composer);

            return (
              <div key={composer} className="bg-white dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-xl">
                <div className="px-6 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-white/5 cursor-pointer" onClick={() => toggleGroup(composer)}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="shrink-0 text-zinc-400">
                      {isGroupCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                      <Music className="w-4 h-4 text-sky-500" /> {composer}
                      <span className="text-xs font-normal text-zinc-400">({composerPieces.length} pieces)</span>
                    </h3>
                    {hasArtistMatch ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-lg">
                        <CheckCircle2 className="w-3 h-3" /> Matched
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-lg">
                        <AlertTriangle className="w-3 h-3" /> No wiki match
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-xs text-zinc-400">Composer:</span>
                      <select
                        value={groupOverride.wikiArtistId || composerPieces[0]?.autoMatchedArtistId || ""}
                        onChange={(e) => applyArtistToAll(composerKey, e.target.value)}
                        className="text-xs px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-lg text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-violet-500/30 max-w-[200px]">
                        <option value="">— none —</option>
                        {wikiArtists.map((a) => <option key={a.$id} value={a.$id}>{a.name} ({a.slug})</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                {!isGroupCollapsed && (
                <div className="divide-y divide-zinc-100 dark:divide-white/5">
                  {composerPieces.map((piece) => {
                    const override = getOverride(piece.file);
                    const isExpanded = expandedFile === piece.file;

                    return (
                      <div key={piece.file}>
                        <div className={`flex items-center gap-3 px-6 py-3 transition-colors ${
                          piece.alreadyImported ? "opacity-50 cursor-not-allowed bg-zinc-50 dark:bg-zinc-900/30"
                            : selected.has(piece.file) ? "bg-sky-50 dark:bg-sky-950/20"
                              : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        }`}>
                          <div className="shrink-0 cursor-pointer" onClick={() => !piece.alreadyImported && toggleSelect(piece.file)}>
                            {piece.alreadyImported ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                              : selected.has(piece.file) ? <CheckSquare className="w-5 h-5 text-sky-600" />
                                : <Square className="w-5 h-5 text-zinc-300 dark:text-zinc-600" />}
                          </div>
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !piece.alreadyImported && toggleSelect(piece.file)}>
                            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{override.customName || piece.displayName}</h4>
                            <p className="text-xs text-zinc-400 truncate">{piece.file}</p>
                          </div>
                          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                            {piece.key && <span className="px-2 py-0.5 text-xs font-medium bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 rounded-lg">{piece.key}</span>}
                            <span className="px-2 py-0.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-lg">{piece.parts}p · {piece.measures}m</span>
                          </div>
                          {/* Preview button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); setPreviewFile(piece.file); setPreviewTitle(override.customName || piece.displayName); }}
                            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-colors"
                            title="Preview sheet music"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {piece.alreadyImported ? (
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">Imported</span>
                          ) : (
                            <button onClick={(e) => { e.stopPropagation(); setExpandedFile(isExpanded ? null : piece.file); }}
                              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors">
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                        {isExpanded && !piece.alreadyImported && (
                          <div className="px-6 py-4 bg-violet-50/50 dark:bg-violet-950/10 border-t border-violet-100 dark:border-violet-500/10">
                            <h5 className="text-xs font-bold text-violet-700 dark:text-violet-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              <Link2 className="w-3.5 h-3.5" /> Wiki References
                            </h5>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Project Name</label>
                                <input type="text" value={override.customName || ""}
                                  onChange={(e) => setOverride(piece.file, "customName", e.target.value)}
                                  placeholder={piece.displayName}
                                  className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-violet-500/30 text-zinc-900 dark:text-white font-medium" />
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Composer (Artist)</label>
                                  <select value={override.wikiArtistId || ""} onChange={(e) => setOverride(piece.file, "wikiArtistId", e.target.value)}
                                    className={`w-full px-3 py-2 text-xs bg-white dark:bg-zinc-800 border rounded-xl outline-none focus:ring-2 focus:ring-violet-500/30 ${
                                      override.wikiArtistId ? "border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                                        : "border-amber-300 dark:border-amber-500/30 text-zinc-700 dark:text-zinc-300"}`}>
                                    <option value="">— not linked —</option>
                                    {wikiArtists.map((a) => <option key={a.$id} value={a.$id}>{a.name} ({a.slug})</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Composition</label>
                                  <select value={override.wikiCompositionId || ""} onChange={(e) => setOverride(piece.file, "wikiCompositionId", e.target.value)}
                                    className={`w-full px-3 py-2 text-xs bg-white dark:bg-zinc-800 border rounded-xl outline-none focus:ring-2 focus:ring-violet-500/30 ${
                                      override.wikiCompositionId ? "border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                                        : "border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300"}`}>
                                    <option value="">— not linked —</option>
                                    {wikiCompositions.map((c) => <option key={c.$id} value={c.$id}>{c.title} ({c.slug})</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Genre</label>
                                  <select value={override.wikiGenreId || ""} onChange={(e) => setOverride(piece.file, "wikiGenreId", e.target.value)}
                                    className={`w-full px-3 py-2 text-xs bg-white dark:bg-zinc-800 border rounded-xl outline-none focus:ring-2 focus:ring-violet-500/30 ${
                                      override.wikiGenreId ? "border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                                        : "border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300"}`}>
                                    <option value="">— not linked —</option>
                                    {wikiGenres.map((g) => <option key={g.$id} value={g.$id}>{g.name} ({g.slug})</option>)}
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Score Preview Modal */}
      {previewFile && (
        <ScorePreviewModal
          file={previewFile}
          title={previewTitle}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 2: Composition Lookup (Wikipedia Search → Save to Appwrite)
// ═══════════════════════════════════════════════════════════════════════════════

function CompositionLookupTab() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WikiSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<WikiArticleDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSlugs, setSavedSlugs] = useState<Set<string>>(new Set());
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Form state for saving
  const [formTitle, setFormTitle] = useState("");
  const [formYear, setFormYear] = useState("");
  const [formPeriod, setFormPeriod] = useState("");
  const [formKey, setFormKey] = useState("");
  const [formDifficulty, setFormDifficulty] = useState("");

  // Load existing compositions to show which are already saved
  useEffect(() => {
    fetch("/api/import-musicxml")
      .then((r) => r.json())
      .then((data) => {
        const slugs = new Set<string>();
        for (const c of data.wikiCompositions || []) {
          slugs.add(c.slug);
        }
        setSavedSlugs(slugs);
      })
      .catch(() => {});
  }, []);

  // Debounced search
  function handleSearchInput(value: string) {
    setQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.length < 2) { setSearchResults([]); return; }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const resp = await fetch(`/api/wiki-search?q=${encodeURIComponent(value)}`);
        const data = await resp.json();
        setSearchResults(data.results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }

  // Fetch article details
  async function selectArticle(title: string) {
    setLoadingDetail(true);
    setSelectedArticle(null);
    try {
      const resp = await fetch(`/api/wiki-search?title=${encodeURIComponent(title)}`);
      const data = await resp.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setSelectedArticle(data);
      setFormTitle(data.title || title);
      // Try to extract year from description
      const yearMatch = data.description?.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
      if (yearMatch) setFormYear(yearMatch[1]);
      else setFormYear("");
      setFormPeriod("");
      setFormKey("");
      setFormDifficulty("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingDetail(false);
    }
  }

  // Save composition
  async function handleSave() {
    if (!formTitle) return;
    setSaving(true);
    try {
      const resp = await fetch("/api/wiki-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          year: formYear ? parseInt(formYear) : undefined,
          period: formPeriod || undefined,
          keySignature: formKey || undefined,
          difficulty: formDifficulty || undefined,
          description: selectedArticle?.fullDescription || selectedArticle?.extract || undefined,
          imageUrl: selectedArticle?.imageUrl || undefined,
          wikiArticle: selectedArticle?.title || undefined,
        }),
      });
      const data = await resp.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`${data.action === "created" ? "Created" : "Updated"}: ${formTitle}`);
        setSavedSlugs((prev) => new Set([...prev, data.slug]));
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const slug = formTitle ? formTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") : "";
  const alreadySaved = savedSlugs.has(slug);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Search Panel */}
      <div className="space-y-4">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search Wikipedia for compositions (e.g. 'BWV 846', 'Moonlight Sonata'…)"
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-violet-500/30 shadow-lg"
          />
          {searching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-violet-500" />}
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-white/5">
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Wikipedia Results ({searchResults.length})
              </span>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-white/5 max-h-[60vh] overflow-y-auto">
              {searchResults.map((r) => {
                const rSlug = r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                const isSaved = savedSlugs.has(rSlug);
                return (
                  <button
                    key={r.pageId}
                    onClick={() => selectArticle(r.title)}
                    className={`w-full text-left px-4 py-3 hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-colors ${
                      selectedArticle?.title === r.title ? "bg-violet-50 dark:bg-violet-950/20 border-l-2 border-violet-500" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-violet-500 shrink-0" />
                      <h4 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{r.title}</h4>
                      {isSaved && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded shrink-0">
                          <CheckCircle2 className="w-2.5 h-2.5" /> saved
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">{r.snippet}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!searching && query.length >= 2 && searchResults.length === 0 && (
          <div className="text-center py-8 text-zinc-400">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No results found for &ldquo;{query}&rdquo;</p>
          </div>
        )}

        {query.length < 2 && (
          <div className="text-center py-12 text-zinc-400">
            <Globe className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Search Wikipedia for musical compositions</p>
            <p className="text-xs mt-1 opacity-70">Results will be enriched with descriptions and images</p>
          </div>
        )}
      </div>

      {/* Right: Article Preview + Save Form */}
      <div className="space-y-4">
        {loadingDetail && (
          <div className="flex items-center justify-center py-16 bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 rounded-2xl">
            <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
          </div>
        )}

        {selectedArticle && !loadingDetail && (
          <>
            {/* Preview card */}
            <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-xl">
              {selectedArticle.imageUrl && (
                <div className="h-40 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                  <img src={selectedArticle.imageUrl} alt={selectedArticle.title}
                    className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{selectedArticle.title}</h3>
                    {selectedArticle.description && (
                      <p className="text-sm text-violet-600 dark:text-violet-400 mt-0.5">{selectedArticle.description}</p>
                    )}
                  </div>
                  <a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(selectedArticle.title)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="shrink-0 p-2 text-zinc-400 hover:text-violet-500 transition-colors">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-4">{selectedArticle.extract}</p>
                {selectedArticle.fullDescription && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Rich description fetched ({selectedArticle.fullDescription.length} chars)
                  </p>
                )}
              </div>
            </div>

            {/* Save form */}
            <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/10 rounded-2xl p-5 shadow-xl">
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                <Save className="w-4 h-4 text-violet-500" />
                Save to Wiki Compositions
                {alreadySaved && (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg">
                    Will update existing
                  </span>
                )}
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Title *</label>
                  <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-violet-500/30 text-zinc-900 dark:text-white" />
                  <p className="text-[10px] text-zinc-400 mt-0.5">Slug: {slug}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Year</label>
                    <input type="number" value={formYear} onChange={(e) => setFormYear(e.target.value)}
                      placeholder="e.g. 1722"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-violet-500/30 text-zinc-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Period</label>
                    <select value={formPeriod} onChange={(e) => setFormPeriod(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-violet-500/30 text-zinc-900 dark:text-white">
                      <option value="">— select —</option>
                      <option value="Medieval">Medieval</option>
                      <option value="Renaissance">Renaissance</option>
                      <option value="Baroque">Baroque</option>
                      <option value="Classical">Classical</option>
                      <option value="Romantic">Romantic</option>
                      <option value="Classical/Romantic">Classical/Romantic</option>
                      <option value="Impressionist">Impressionist</option>
                      <option value="Modern">Modern</option>
                      <option value="Contemporary">Contemporary</option>
                      <option value="Modern Jazz">Modern Jazz</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Key Signature</label>
                    <input type="text" value={formKey} onChange={(e) => setFormKey(e.target.value)}
                      placeholder="e.g. C minor"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-violet-500/30 text-zinc-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Difficulty</label>
                    <select value={formDifficulty} onChange={(e) => setFormDifficulty(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-violet-500/30 text-zinc-900 dark:text-white">
                      <option value="">— select —</option>
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>
                </div>
                <button onClick={handleSave} disabled={saving || !formTitle}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-semibold text-sm rounded-xl transition-colors shadow-lg shadow-violet-600/20 disabled:cursor-not-allowed disabled:shadow-none">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {alreadySaved ? "Update Composition" : "Save Composition"}
                </button>
              </div>
            </div>
          </>
        )}

        {!selectedArticle && !loadingDetail && (
          <div className="flex items-center justify-center py-20 bg-white/50 dark:bg-zinc-900/30 border border-dashed border-zinc-300 dark:border-white/10 rounded-2xl">
            <div className="text-center text-zinc-400">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Select a Wikipedia article</p>
              <p className="text-xs mt-1 opacity-70">Preview and save it as a wiki composition</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { injectMidiInstruments } from "@/lib/score/midi-instruments";


// ═══════════════════════════════════════════════════════════════════════════════
// Score Preview Modal — Verovio Rendering + MIDI Playback
// ═══════════════════════════════════════════════════════════════════════════════

function ScorePreviewModal({ file, title, onClose }: { file: string; title: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [midiBase64, setMidiBase64] = useState<string | null>(null);
  const [midiPianoBase64, setMidiPianoBase64] = useState<string | null>(null);
  const [pianoOnly, setPianoOnly] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const svgContainerRef = useRef<HTMLDivElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const midiPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let canceled = false;

    const loadAndRender = async () => {
      setLoading(true);
      setError(null);
      setMidiBase64(null);
      setMidiPianoBase64(null);

      try {
        // 1. Fetch MusicXML content
        const resp = await fetch(`/api/import-musicxml/preview?file=${encodeURIComponent(file)}`);
        if (!resp.ok) throw new Error(`Failed to load file: HTTP ${resp.status}`);
        const xmlText = await resp.text();
        if (canceled) return;

        // 1.5 Inject MIDI instrument tags for proper instrument sounds
        const enrichedXml = injectMidiInstruments(xmlText);

        // 2. Initialize Verovio Worker
        const workerUrl = "/dist/verovio/verovio-worker.js";
        const worker = new Worker(workerUrl);
        workerRef.current = worker;
        worker.postMessage({
          verovioUrl: "https://www.verovio.org/javascript/latest/verovio-toolkit-wasm.js"
        });

        const proxy = new VerovioWorkerProxy(worker) as unknown as IVerovioWorkerProxy;
        await proxy.onRuntimeInitialized();
        if (canceled) return;

        // 3. Configure Verovio
        await proxy.setOptions({
          pageHeight: 60000,
          pageWidth: 2100,
          pageMarginLeft: 50,
          pageMarginRight: 50,
          pageMarginTop: 50,
          pageMarginBottom: 50,
          scale: 50,
          spacingLinear: 0.25,
          spacingNonLinear: 0.6,
          adjustPageHeight: true,
          breaks: "auto"
        });

        // 4. Load & Render SVG (use original for visual rendering)
        await proxy.loadData(enrichedXml);
        if (canceled) return;

        const svg = await proxy.renderToSVG(1);
        if (canceled) return;

        if (svgContainerRef.current) {
          svgContainerRef.current.innerHTML = svg;
          // Fix SVG sizing
          const topSvg = svgContainerRef.current.querySelector(':scope > svg') as SVGSVGElement | null;
          if (topSvg) {
            let w = parseFloat(topSvg.getAttribute('width') ?? '0');
            let h = parseFloat(topSvg.getAttribute('height') ?? '0');
            if (h <= 0 || isNaN(h)) {
              const defVb = topSvg.querySelector('.definition-scale')?.getAttribute('viewBox');
              if (defVb) {
                const parts = defVb.split(/\s+/).map(Number);
                if (parts.length === 4) { w = parts[2] / 10; h = parts[3] / 10; }
              }
            }
            if (w > 0 && h > 0) topSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
            topSvg.removeAttribute('width');
            topSvg.removeAttribute('height');
            topSvg.style.display = 'block';
            topSvg.style.width = '100%';
            topSvg.style.height = 'auto';
          }
        }

        // 5. Extract MIDI (enriched with proper instruments)
        const midiStr = await proxy.renderToMIDI();
        if (!canceled && midiStr) {
          setMidiBase64('data:audio/midi;base64,' + midiStr);
        }

        // 6. Also generate piano-only MIDI (from original XML without instrument injection)
        if (!canceled) {
          await proxy.loadData(xmlText);
          const pianoMidiStr = await proxy.renderToMIDI();
          if (!canceled && pianoMidiStr) {
            setMidiPianoBase64('data:audio/midi;base64,' + pianoMidiStr);
          }
        }

      } catch (err: any) {
        if (!canceled) setError(err.message || "Failed to load score");
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    loadAndRender();

    return () => {
      canceled = true;
      // Stop MIDI playback when dialog closes
      if (midiPlayerRef.current && typeof (midiPlayerRef.current as any).stop === 'function') {
        (midiPlayerRef.current as any).stop();
      }
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [file]);

  // Eagerly stop MIDI before unmounting (React cleanup runs too late for web components)
  const handleClose = useCallback(() => {
    try {
      if (midiPlayerRef.current && typeof (midiPlayerRef.current as any).stop === 'function') {
        (midiPlayerRef.current as any).stop();
      }
    } catch {}
    onClose();
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={handleClose}>
      <div
        className={`relative bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
          isExpanded
            ? "w-screen h-screen rounded-none"
            : "w-[95vw] max-w-5xl max-h-[90vh] rounded-3xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-200 dark:border-white/10 shrink-0">
          <div className="p-2 bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 rounded-xl">
            <Music className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white truncate">{title}</h3>
            <p className="text-xs text-zinc-400 truncate">{file}</p>
          </div>

          {/* MIDI Play Button */}
          {midiBase64 && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
                <input
                  type="checkbox"
                  checked={pianoOnly}
                  onChange={(e) => setPianoOnly(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-zinc-300 dark:border-zinc-600 text-sky-500 focus:ring-sky-500"
                />
                <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Piano only</span>
              </label>
              <midi-player
                ref={(el: any) => { midiPlayerRef.current = el; }}
                src={(pianoOnly && midiPianoBase64) ? midiPianoBase64 : midiBase64}
                sound-font="https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus"
                className="midi-player-preview"
                // @ts-ignore
                style={{ '--primary-color': '#0ea5e9' } as any}
              />
            </div>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={handleClose}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Score Content */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-sky-500 mb-4" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Rendering sheet music…</p>
            </div>
          )}
          {error && (
            <div className="text-center py-20">
              <XCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
          <div ref={svgContainerRef} className="score-preview-container" />
        </div>
      </div>
    </div>
  );
}
