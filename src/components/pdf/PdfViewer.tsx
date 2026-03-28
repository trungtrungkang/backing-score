"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  Play,
  Pause,
  ChevronsUp,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  Columns2,
  Timer,
} from "lucide-react";
import { loadPdfJs, type PdfDocument } from "@/lib/pdf-utils";

interface PdfViewerProps {
  pdfUrl: string;
  pageCount: number;
  title: string;
}

export default function PdfViewer({ pdfUrl, pageCount, title }: PdfViewerProps) {
  const t = useTranslations("Pdfs");
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRAF = useRef<number>(0);
  const pdfDocRef = useRef<PdfDocument | null>(null);

  // Track active render tasks so we can cancel them
  const activeRenders = useRef<Map<number, { cancel: () => void }>>(new Map());
  const renderGeneration = useRef(0); // incremented on each full re-render

  // State
  const [numPages, setNumPages] = useState(pageCount);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0); // start at 0, wait for measurement
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [halfPageTurn, setHalfPageTurn] = useState(false);
  const [performanceMode, setPerformanceMode] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState("");

  // Auto-scroll
  const [autoScrolling, setAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(30);
  const lastTimeRef = useRef(0);

  // Bookmarks — persisted in localStorage
  const storageKey = `pdf-bookmarks-${title}`;
  const [bookmarkedPages, setBookmarkedPages] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? new Set(JSON.parse(saved) as number[]) : new Set();
    } catch { return new Set(); }
  });
  const [showBookmarkMenu, setShowBookmarkMenu] = useState(false);

  const toggleBookmark = (page: number) => {
    setBookmarkedPages((prev) => {
      const next = new Set(prev);
      if (next.has(page)) next.delete(page); else next.add(page);
      localStorage.setItem(storageKey, JSON.stringify([...next].sort((a, b) => a - b)));
      return next;
    });
  };

  // Spread view (two-page)
  const [spreadView, setSpreadView] = useState(false);
  const isNarrow = containerWidth > 0 && containerWidth < 900;
  const effectiveSpread = spreadView && !isNarrow;

  // ─── Metronome ───
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [timeSignature, setTimeSignature] = useState<[number, number]>([4, 4]);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [showMetronomePanel, setShowMetronomePanel] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const metronomeTimerRef = useRef<number>(0);
  const nextBeatTimeRef = useRef(0);
  const beatCountRef = useRef(0);

  // Tap tempo
  const tapTimesRef = useRef<number[]>([]);
  const handleTapTempo = () => {
    const now = performance.now();
    const taps = tapTimesRef.current;
    // Reset if last tap was >2s ago
    if (taps.length > 0 && now - taps[taps.length - 1] > 2000) {
      tapTimesRef.current = [];
    }
    taps.push(now);
    if (taps.length > 1) {
      const intervals = taps.slice(-6).reduce<number[]>((acc, t, i, arr) => {
        if (i > 0) acc.push(t - arr[i - 1]);
        return acc;
      }, []);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const newBpm = Math.round(60000 / avg);
      setBpm(Math.max(40, Math.min(240, newBpm)));
    }
  };

  // Metronome audio scheduling
  useEffect(() => {
    if (!metronomeOn) {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      cancelAnimationFrame(metronomeTimerRef.current);
      setCurrentBeat(0);
      beatCountRef.current = 0;
      return;
    }

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    nextBeatTimeRef.current = ctx.currentTime + 0.05;
    beatCountRef.current = 0;

    const beatsPerMeasure = timeSignature[0];
    const scheduleAhead = 0.1; // seconds
    const lookahead = 25; // ms

    function scheduleBeat(time: number, isAccent: boolean) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = isAccent ? 1000 : 800;
      gain.gain.setValueAtTime(isAccent ? 0.3 : 0.15, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
      osc.start(time);
      osc.stop(time + 0.05);
    }

    function scheduler() {
      while (nextBeatTimeRef.current < ctx.currentTime + scheduleAhead) {
        const isAccent = beatCountRef.current % beatsPerMeasure === 0;
        scheduleBeat(nextBeatTimeRef.current, isAccent);
        setCurrentBeat(beatCountRef.current % beatsPerMeasure);
        const secondsPerBeat = 60.0 / bpm;
        nextBeatTimeRef.current += secondsPerBeat;
        beatCountRef.current++;
      }
      metronomeTimerRef.current = window.setTimeout(scheduler, lookahead) as unknown as number;
    }

    scheduler();

    return () => {
      clearTimeout(metronomeTimerRef.current);
      ctx.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, [metronomeOn, bpm, timeSignature]);

  // Measure container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Set initial width immediately
    setContainerWidth(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Load PDF document
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setPdfLoading(true);
        setPdfError("");
        const pdfjsLib = await loadPdfJs();
        if (cancelled) return;
        const pdf = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
        if (cancelled) return;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setPdfLoading(false);
      } catch (err) {
        if (!cancelled) {
          setPdfError(String(err));
          setPdfLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  // Render a single page to its canvas (with cancel support)
  const renderPage = useCallback(
    async (pageNum: number, gen: number) => {
      const pdf = pdfDocRef.current;
      if (!pdf || containerWidth === 0) return;

      const canvas = document.getElementById(`pdf-canvas-${pageNum}`) as HTMLCanvasElement | null;
      if (!canvas) return;

      // Cancel any existing render on this canvas
      const existing = activeRenders.current.get(pageNum);
      if (existing) {
        try {
          existing.cancel();
        } catch {
          /* ignore */
        }
        activeRenders.current.delete(pageNum);
      }

      // Abort if a newer generation was triggered
      if (gen !== renderGeneration.current) return;

      try {
        const page = await pdf.getPage(pageNum);
        if (gen !== renderGeneration.current) return;

        const pageWidth = (effectiveSpread ? (containerWidth / 2 - 16) : containerWidth) * scale;
        const baseViewport = page.getViewport({ scale: 1 });
        const renderScale = pageWidth / baseViewport.width;
        const viewport = page.getViewport({ scale: renderScale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const renderTask = page.render({ canvasContext: ctx, viewport });
        activeRenders.current.set(pageNum, renderTask);

        await renderTask.promise;
        activeRenders.current.delete(pageNum);
      } catch (err) {
        // RenderingCancelledException is expected when we cancel
        if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "RenderingCancelledException") {
          return;
        }
        console.error(`Failed to render page ${pageNum}:`, err);
      }
    },
    [containerWidth, scale]
  );

  // Re-render all pages when PDF loads, scale changes, or container resizes
  useEffect(() => {
    if (!pdfDocRef.current || containerWidth === 0) return;

    // Cancel all previous renders
    renderGeneration.current += 1;
    const gen = renderGeneration.current;
    activeRenders.current.forEach((task) => {
      try {
        task.cancel();
      } catch {
        /* ignore */
      }
    });
    activeRenders.current.clear();

    // Small delay to let DOM settle after state change
    const timer = setTimeout(() => {
      for (let i = 1; i <= numPages; i++) {
        renderPage(i, gen);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [numPages, renderPage, containerWidth, scale, pdfLoading, effectiveSpread]);

  // Page navigation
  const goToPage = useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(page, numPages));
      setCurrentPage(clamped);
      const el = document.getElementById(`pdf-page-${clamped}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [numPages]
  );

  const prevPage = useCallback(() => {
    if (halfPageTurn && scrollRef.current) {
      scrollRef.current.scrollBy({ top: -scrollRef.current.clientHeight / 2, behavior: "smooth" });
    } else {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage, halfPageTurn]);

  const nextPage = useCallback(() => {
    if (halfPageTurn && scrollRef.current) {
      scrollRef.current.scrollBy({ top: scrollRef.current.clientHeight / 2, behavior: "smooth" });
    } else {
      goToPage(currentPage + 1);
    }
  }, [currentPage, goToPage, halfPageTurn]);

  // Zoom
  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const fitWidth = () => setScale(1);

  // Auto-scroll
  useEffect(() => {
    if (!autoScrolling || !scrollRef.current) {
      cancelAnimationFrame(autoScrollRAF.current);
      return;
    }
    lastTimeRef.current = performance.now();
    const tick = (now: number) => {
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      if (scrollRef.current) scrollRef.current.scrollTop += scrollSpeed * delta;
      autoScrollRAF.current = requestAnimationFrame(tick);
    };
    autoScrollRAF.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(autoScrollRAF.current);
  }, [autoScrolling, scrollSpeed]);

  // Fullscreen
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Performance mode
  const togglePerformanceMode = () => {
    setPerformanceMode((v) => !v);
    if (!performanceMode) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    }
  };

  // Track current page from scroll position
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      for (let i = 1; i <= numPages; i++) {
        const pageEl = document.getElementById(`pdf-page-${i}`);
        if (pageEl) {
          const rect = pageEl.getBoundingClientRect();
          const containerRect = el.getBoundingClientRect();
          if (rect.top <= containerRect.top + containerRect.height / 3) {
            setCurrentPage(i);
          }
        }
      }
    };
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [numPages]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          prevPage();
          break;
        case "ArrowRight":
        case "PageDown":
          e.preventDefault();
          nextPage();
          break;
        case " ":
          e.preventDefault();
          setAutoScrolling((v) => !v);
          break;
        case "+":
        case "=":
          e.preventDefault();
          zoomIn();
          break;
        case "-":
          e.preventDefault();
          zoomOut();
          break;
        case "w":
        case "W":
          e.preventDefault();
          fitWidth();
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "Escape":
          if (performanceMode) setPerformanceMode(false);
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevPage, nextPage, performanceMode]);

  // Performance mode tap
  const handlePerformanceTap = () => {
    if (!performanceMode) return;
    nextPage();
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full bg-zinc-950 ${performanceMode ? "cursor-none" : ""}`}
    >
      {/* Scroll container */}
      <div ref={scrollRef} className="flex-1 overflow-auto" onClick={handlePerformanceTap}>
        <div className="flex flex-col items-center py-4 gap-4">
          {pdfLoading && (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
          )}

          {pdfError && (
            <div className="text-red-400 text-center py-20">Failed to load PDF: {pdfError}</div>
          )}

          {!pdfLoading && !pdfError && (
            effectiveSpread ? (
              /* Two-page spread */
              <div className="grid grid-cols-2 gap-4 px-2" style={{ maxWidth: containerWidth * scale }}>
                {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                  <div key={pageNum} id={`pdf-page-${pageNum}`} className="shadow-lg relative">
                    {bookmarkedPages.has(pageNum) && (
                      <div className="absolute top-2 right-2 z-10">
                        <BookmarkCheck className="w-5 h-5 text-amber-400 drop-shadow" />
                      </div>
                    )}
                    <canvas
                      id={`pdf-canvas-${pageNum}`}
                      className="bg-white"
                      style={{ maxWidth: "100%" }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              /* Single page view */
              Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <div key={pageNum} id={`pdf-page-${pageNum}`} className="shadow-lg mb-2 relative">
                  {bookmarkedPages.has(pageNum) && (
                    <div className="absolute top-2 right-2 z-10">
                      <BookmarkCheck className="w-5 h-5 text-amber-400 drop-shadow" />
                    </div>
                  )}
                  <canvas
                    id={`pdf-canvas-${pageNum}`}
                    className="bg-white"
                    style={{ maxWidth: "100%" }}
                  />
                </div>
              ))
            )
          )}
        </div>
      </div>

      {/* Bottom toolbar */}
      {!performanceMode && (
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-t border-zinc-800 flex-shrink-0 select-none">
          {/* Page navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={prevPage}
              disabled={currentPage <= 1 && !halfPageTurn}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-zinc-400 min-w-[80px] text-center">
              {t("pageOf", { current: currentPage, total: numPages })}
            </span>
            <button
              onClick={nextPage}
              disabled={currentPage >= numPages && !halfPageTurn}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-1">
            <button
              onClick={zoomOut}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title={t("zoomOut")}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={fitWidth}
              className="px-2 py-1 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title={t("fitWidth")}
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={zoomIn}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title={t("zoomIn")}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Feature toggles */}
          <div className="flex items-center gap-1">
            {/* Auto-scroll */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setAutoScrolling((v) => !v)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${
                  autoScrolling
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
                title={t("autoScroll")}
              >
                {autoScrolling ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                Auto
              </button>
              {autoScrolling && (
                <input
                  type="range"
                  min={5}
                  max={150}
                  value={scrollSpeed}
                  onChange={(e) => setScrollSpeed(Number(e.target.value))}
                  className="w-20 h-1 accent-indigo-500"
                  title={t("speed")}
                />
              )}
            </div>

            {/* Half-page turn */}
            <button
              onClick={() => setHalfPageTurn((v) => !v)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${
                halfPageTurn
                  ? "bg-amber-600 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
              title={t("halfPageTurn")}
            >
              <ChevronsUp className="w-3.5 h-3.5" />½
            </button>

            {/* Spread view toggle */}
            <button
              onClick={() => setSpreadView((v) => !v)}
              className={`p-1.5 rounded-md transition-colors ${spreadView ? "text-indigo-400 bg-indigo-500/10" : "text-zinc-400 hover:text-white hover:bg-zinc-800"} ${isNarrow ? "opacity-30 cursor-not-allowed" : ""}`}
              title={t("spreadView")}
              disabled={isNarrow}
            >
              <Columns2 className="w-4 h-4" />
            </button>

            {/* Metronome toggle + panel */}
            <div className="relative">
              <button
                onClick={() => {
                  if (!metronomeOn) setShowMetronomePanel((v) => !v);
                  else { setMetronomeOn(false); setShowMetronomePanel(false); }
                }}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${metronomeOn ? "bg-green-600 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                title={t("metronome")}
              >
                <Timer className="w-3.5 h-3.5" />
                {metronomeOn && (
                  <span className="font-mono">{bpm}</span>
                )}
                {/* Visual beat dots */}
                {metronomeOn && (
                  <span className="flex gap-0.5 ml-1">
                    {Array.from({ length: timeSignature[0] }, (_, i) => (
                      <span
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentBeat ? (i === 0 ? "bg-amber-400 scale-125" : "bg-white scale-110") : "bg-zinc-600"}`}
                      />
                    ))}
                  </span>
                )}
              </button>

              {showMetronomePanel && !metronomeOn && (
                <div className="absolute bottom-full mb-2 right-0 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-3 min-w-[200px] z-50" onClick={(e) => e.stopPropagation()}>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2">{t("metronome")}</div>

                  {/* BPM slider */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-zinc-400 w-8">{t("bpm")}</span>
                    <input
                      type="range"
                      min={40}
                      max={240}
                      value={bpm}
                      onChange={(e) => setBpm(Number(e.target.value))}
                      className="flex-1 h-1.5 accent-indigo-500"
                    />
                    <input
                      type="number"
                      min={40}
                      max={240}
                      value={bpm}
                      onChange={(e) => setBpm(Math.max(40, Math.min(240, Number(e.target.value))))}
                      className="w-14 bg-zinc-800 text-white text-xs text-center rounded px-1 py-1 border border-zinc-700 font-mono"
                    />
                  </div>

                  {/* Tap Tempo */}
                  <button
                    onClick={handleTapTempo}
                    className="w-full mb-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 font-medium transition-colors"
                  >
                    {t("tapTempo")}
                  </button>

                  {/* Time signature */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-zinc-400">{t("timeSignature")}</span>
                    <div className="flex gap-1">
                      {([[2,4],[3,4],[4,4],[6,8]] as [number,number][]).map(([n,d]) => (
                        <button
                          key={`${n}/${d}`}
                          onClick={() => setTimeSignature([n, d])}
                          className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                            timeSignature[0] === n && timeSignature[1] === d
                              ? "bg-indigo-600 text-white"
                              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                          }`}
                        >
                          {n}/{d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Start button */}
                  <button
                    onClick={() => { setMetronomeOn(true); setShowMetronomePanel(false); }}
                    className="w-full py-2 rounded-md bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors"
                  >
                    ▶ Start
                  </button>
                </div>
              )}
            </div>

            {/* Bookmark current page */}
            <div className="relative">
              <button
                onClick={() => toggleBookmark(currentPage)}
                className={`p-1.5 rounded-md transition-colors ${bookmarkedPages.has(currentPage) ? "text-amber-400 bg-amber-500/10" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                title={t("bookmark")}
              >
                {bookmarkedPages.has(currentPage) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              </button>
              {bookmarkedPages.size > 0 && (
                <button
                  onClick={() => setShowBookmarkMenu((v) => !v)}
                  className="p-0.5 rounded text-zinc-500 hover:text-white transition-colors"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              )}
              {showBookmarkMenu && bookmarkedPages.size > 0 && (
                <div className="absolute bottom-full mb-2 right-0 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[120px] z-50" onMouseLeave={() => setShowBookmarkMenu(false)}>
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-500 font-bold">{t("bookmark")}s</div>
                  {[...bookmarkedPages].sort((a, b) => a - b).map((p) => (
                    <button
                      key={p}
                      onClick={() => { goToPage(p); setShowBookmarkMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800 flex items-center gap-2 ${p === currentPage ? "text-amber-400 font-semibold" : "text-zinc-300"}`}
                    >
                      <BookmarkCheck className="w-3 h-3 text-amber-400" />
                      {t("pageOf", { current: String(p), total: String(numPages) })}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Performance mode */}
            <button
              onClick={togglePerformanceMode}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title={t("performanceMode")}
            >
              <Maximize className="w-4 h-4" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
