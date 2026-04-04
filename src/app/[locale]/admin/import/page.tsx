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
import { canAccessAdmin, canEditWiki } from "@/lib/auth/roles";
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
    if (!user || !(canAccessAdmin(user.labels) || canEditWiki(user.labels))) {
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
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl shadow-xl text-center">
      <div className="w-16 h-16 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mb-6">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-3">Bulk Import Moved to CLI</h2>
      <p className="text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto mb-8">
        Because Cloudflare Pages strictly enforces the Edge runtime (which lacks access to the local file system), 
        the MusicXML Bulk Import feature has been migrated to a standalone Node.js CLI script.
      </p>
      
      <div className="w-full max-w-2xl bg-zinc-50 dark:bg-zinc-950 p-6 rounded-xl border border-zinc-200 dark:border-white/5 text-left mb-6">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <Square className="w-4 h-4 text-sky-500" /> How to use the new importer
        </h3>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">1. Crawl MusicXML Library (Python)</p>
            <code className="block w-full p-3 bg-zinc-100 dark:bg-zinc-900 rounded-lg text-xs font-mono text-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800">
              source /tmp/music21-env/bin/activate && python3 scripts/crawl-musicxml.py
            </code>
          </div>
          
          <div>
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">2. Import into Database (Node.js/TS)</p>
            <code className="block w-full p-3 bg-zinc-100 dark:bg-zinc-900 rounded-lg text-xs font-mono text-sky-600 dark:text-sky-400 border border-zinc-200 dark:border-zinc-800">
              npx tsx scripts/import_musicxml.ts
            </code>
          </div>
        </div>
      </div>
    </div>
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
      .then((data: any) => {
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
        const data = ((await resp.json()) as any) as any;
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
      const data = ((await resp.json()) as any) as any;
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
      const data = ((await resp.json()) as any) as any;
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
