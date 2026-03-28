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
  Bookmark as BookmarkIcon,
  BookmarkCheck,
  ChevronDown,
  Columns2,
  Timer,
  ArrowDownToLine,
  PanelTop,
  Footprints,
  MoreVertical,
  Moon,
  Sun,
  Map as MapIcon,
  X,
} from "lucide-react";
import Draggable from 'react-draggable';
import { loadPdfJs, type PdfDocument } from "@/lib/pdf-utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import PdfNavMapPanel from "./PdfNavMapPanel";
import { saveNavMap, type ParsedSheetNavMap, type Bookmark, type NavigationSequence } from "@/lib/appwrite/nav-maps";

interface PdfViewerProps {
  sheetMusicId: string;
  pdfUrl: string;
  pageCount: number;
  title: string;
  initialNavMap?: ParsedSheetNavMap | null;
  readOnlyMap?: boolean;
}

export default function PdfViewer({ sheetMusicId, pdfUrl, pageCount, title, initialNavMap, readOnlyMap = false }: PdfViewerProps) {
  const t = useTranslations("Pdfs");
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navMapDragRef = useRef<HTMLDivElement>(null);
  const autoScrollRAF = useRef<number>(0);
  const pdfDocRef = useRef<PdfDocument | null>(null);

  // Track active render tasks so we can cancel them
  const activeRenders = useRef<Map<number, { cancel: () => void }>>(new Map());
  const renderGeneration = useRef(0); // incremented on each full re-render

  // State
  const [numPages, setNumPages] = useState(pageCount);
  const [currentPage, setCurrentPage] = useState(() => {
    if (typeof window === "undefined") return 1;
    const saved = localStorage.getItem(`pdf-lastpage-${title}`);
    return saved ? Math.max(1, Math.min(Number(saved), pageCount)) : 1;
  });
  const [scale, setScale] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [halfPageTurn, setHalfPageTurn] = useState(false);
  const [performanceMode, setPerformanceMode] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState("");

  // Nav Map State
  const [navMap, setNavMap] = useState<ParsedSheetNavMap | null>(initialNavMap || null);
  const [showNavMapPanel, setShowNavMapPanel] = useState(false);
  const [navSeqIndex, setNavSeqIndex] = useState(-1);
  const [savingNavMap, setSavingNavMap] = useState(false);
  const [followModeActive, setFollowModeActive] = useState(true);

  // Auto-scroll
  const [autoScrolling, setAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(30);
  const lastTimeRef = useRef(0);

  // Dark mode (invert PDF colors)
  const [darkMode, setDarkMode] = useState(false);

  // Wake Lock — prevent screen sleep during performance/auto-scroll
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

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

  // View mode: fitWidth (default), fitHeight, twoPages
  type ViewMode = 'fitWidth' | 'fitHeight' | 'twoPages';
  const [viewMode, setViewMode] = useState<ViewMode>('fitWidth');
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showScreenMenu, setShowScreenMenu] = useState(false);
  const isNarrow = containerWidth > 0 && containerWidth < 900;
  const effectiveSpread = viewMode === 'twoPages' && !isNarrow;
  const [spreadPairStart, setSpreadPairStart] = useState(1); // first page of current pair

  // ─── Pedal ───
  const pedalStorageKey = `pdf-pedal-config`;
  const [pedalEnabled, setPedalEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`${pedalStorageKey}-enabled`) === 'true';
  });
  const [pedalNextKeys, setPedalNextKeys] = useState<string[]>(() => {
    if (typeof window === "undefined") return ['PageDown', 'ArrowRight', 'ArrowDown'];
    try {
      const saved = localStorage.getItem(`${pedalStorageKey}-next`);
      return saved ? JSON.parse(saved) : ['PageDown', 'ArrowRight', 'ArrowDown'];
    } catch { return ['PageDown', 'ArrowRight', 'ArrowDown']; }
  });
  const [pedalPrevKeys, setPedalPrevKeys] = useState<string[]>(() => {
    if (typeof window === "undefined") return ['PageUp', 'ArrowLeft', 'ArrowUp'];
    try {
      const saved = localStorage.getItem(`${pedalStorageKey}-prev`);
      return saved ? JSON.parse(saved) : ['PageUp', 'ArrowLeft', 'ArrowUp'];
    } catch { return ['PageUp', 'ArrowLeft', 'ArrowUp']; }
  });
  const [showPedalPanel, setShowPedalPanel] = useState(false);
  const [pedalFlash, setPedalFlash] = useState<'next' | 'prev' | null>(null);
  const [isListeningKey, setIsListeningKey] = useState<'next' | 'prev' | null>(null);
  const pedalFlashTimer = useRef<ReturnType<typeof setTimeout>>(null);

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
        audioCtxRef.current.close().catch(() => { });
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
      ctx.close().catch(() => { });
      audioCtxRef.current = null;
    };
  }, [metronomeOn, bpm, timeSignature]);

  // Measure container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Lock body scroll to prevent iOS Safari outer scroll
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;

    // Save original styles
    const origHtmlOverflow = html.style.overflow;
    const origBodyOverflow = body.style.overflow;
    const origBodyPosition = body.style.position;
    const origBodyTop = body.style.top;
    const origBodyWidth = body.style.width;

    // Lock scroll — position:fixed is required for iOS Safari
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';

    return () => {
      html.style.overflow = origHtmlOverflow;
      body.style.overflow = origBodyOverflow;
      body.style.position = origBodyPosition;
      body.style.top = origBodyTop;
      body.style.width = origBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Wake Lock — keep screen on during performance mode or auto-scroll
  useEffect(() => {
    const shouldLock = performanceMode || autoScrolling;
    if (!shouldLock) {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      return;
    }
    let cancelled = false;
    async function requestLock() {
      try {
        if ('wakeLock' in navigator && !cancelled) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch { /* user denied or not supported */ }
    }
    requestLock();
    // Re-acquire on visibility change (browser releases on tab switch)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !cancelled) requestLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [performanceMode, autoScrolling]);

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

      let canvasId: string;
      if (effectiveSpread) {
        // In spread mode, canvases use stable IDs: spread-0, spread-1
        const idx = pageNum - spreadPairStart;
        canvasId = `pdf-canvas-spread-${idx}`;
      } else {
        canvasId = `pdf-canvas-${pageNum}`;
      }
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
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

        const baseViewport = page.getViewport({ scale: 1 });
        let renderScale: number;
        if (effectiveSpread) {
          // Fit to half-width AND scroll-area height, pick smaller
          const scrollH = scrollRef.current?.clientHeight || 600;
          const availWidth = containerWidth / 2 - 20;
          const availHeight = scrollH - 24;
          const scaleW = availWidth / baseViewport.width;
          const scaleH = availHeight / baseViewport.height;
          renderScale = Math.min(scaleW, scaleH);
        } else if (viewMode === 'fitHeight') {
          // Fit page height to scroll container height
          const scrollH = scrollRef.current?.clientHeight || 600;
          const availHeight = scrollH - 24;
          renderScale = availHeight / baseViewport.height;
        } else {
          // fitWidth (default)
          const pageWidth = containerWidth * scale;
          renderScale = pageWidth / baseViewport.width;
        }
        if (renderScale <= 0 || !isFinite(renderScale)) return;
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
    [containerWidth, scale, effectiveSpread, spreadPairStart, viewMode]
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
      if (effectiveSpread) {
        // Only render visible pair
        const pages = [spreadPairStart];
        if (spreadPairStart + 1 <= numPages) pages.push(spreadPairStart + 1);
        pages.forEach((p) => renderPage(p, gen));
      } else {
        for (let i = 1; i <= numPages; i++) {
          renderPage(i, gen);
        }
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [numPages, renderPage, containerWidth, scale, pdfLoading, effectiveSpread, spreadPairStart]);

  // Scroll to saved page on initial load
  const hasRestored = useRef(false);
  useEffect(() => {
    if (pdfLoading || hasRestored.current) return;
    hasRestored.current = true;
    if (currentPage > 1) {
      setTimeout(() => {
        const el = document.getElementById(`pdf-page-${currentPage}`);
        if (el) el.scrollIntoView({ block: "start" });
      }, 200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfLoading]);

  // Page navigation
  const goToPage = useCallback(
    (page: number, yPercent?: number) => {
      const clamped = Math.max(1, Math.min(page, numPages));
      setCurrentPage(clamped);
      localStorage.setItem(`pdf-lastpage-${title}`, String(clamped));
      
      const el = document.getElementById(`pdf-page-${clamped}`);
      if (el && scrollRef.current) {
         if (yPercent !== undefined) {
           const containerTop = scrollRef.current.getBoundingClientRect().top;
           const pageTop = el.getBoundingClientRect().top;
           const targetScrollY = scrollRef.current.scrollTop + (pageTop - containerTop) + (el.offsetHeight * yPercent);
           scrollRef.current.scrollTo({ top: targetScrollY, behavior: autoScrolling ? "auto" : "smooth" });
         } else {
           el.scrollIntoView({ behavior: autoScrolling ? "auto" : "smooth", block: "start" });
         }
      }
    },
    [numPages, title, autoScrolling]
  );

  // ─── Nav Map Actions ───
  const handleSaveNavMap = async (bookmarks: Bookmark[], sequence: NavigationSequence) => {
    setSavingNavMap(true);
    try {
      const updated = await saveNavMap(sheetMusicId, bookmarks, sequence);
      setNavMap(updated);
    } catch (err) {
      console.error(err);
      alert(t("saveFailed") || "Failed to save Nav Map");
    } finally {
      setSavingNavMap(false);
    }
  };

  const jumpToBookmark = useCallback((bm: Bookmark) => {
    goToPage(bm.pageIndex + 1, bm.yPercent);
  }, [goToPage]);

  const jumpToNextSequenceIndex = () => {
    if (!navMap || navMap.sequence.length === 0) return;
    const nextIdx = (navSeqIndex + 1) % navMap.sequence.length;
    setNavSeqIndex(nextIdx);
    const bmId = navMap.sequence[nextIdx];
    const bm = navMap.bookmarks.find(b => b.id === bmId);
    if (bm) jumpToBookmark(bm);
  };

  const jumpToPrevSequenceIndex = () => {
    if (!navMap || navMap.sequence.length === 0) return;
    const nextIdx = navSeqIndex - 1 < 0 ? navMap.sequence.length - 1 : navSeqIndex - 1;
    setNavSeqIndex(nextIdx);
    const bmId = navMap.sequence[nextIdx];
    const bm = navMap.bookmarks.find(b => b.id === bmId);
    if (bm) jumpToBookmark(bm);
  };
  // Check if a page's top is aligned with the scroll container (within tolerance)
  const isPageAligned = useCallback((pageNum: number) => {
    const el = scrollRef.current;
    if (!el) return true;
    const pageEl = document.getElementById(`pdf-page-${pageNum}`);
    if (!pageEl) return true;
    const containerRect = el.getBoundingClientRect();
    const pageRect = pageEl.getBoundingClientRect();
    return Math.abs(pageRect.top - containerRect.top) < 20;
  }, []);

  const prevPage = useCallback(() => {
    if (effectiveSpread) {
      setSpreadPairStart((s) => Math.max(1, s - 2));
    } else if (scrollRef.current) {
      if (halfPageTurn) {
        if (scrollRef.current.scrollTop <= 0) return; // already at top
        scrollRef.current.scrollBy({ top: -scrollRef.current.clientHeight / 2, behavior: autoScrolling ? "auto" : "smooth" });
        return;
      }
      // Find the previous page to scroll to
      const el = scrollRef.current;
      const containerTop = el.getBoundingClientRect().top;
      for (let i = numPages; i >= 1; i--) {
        const pageEl = document.getElementById(`pdf-page-${i}`);
        if (pageEl) {
          const pageTop = pageEl.getBoundingClientRect().top;
          if (pageTop < containerTop - 10) {
            pageEl.scrollIntoView({ behavior: autoScrolling ? "auto" : "smooth", block: "start" });
            return;
          }
        }
      }
      el.scrollTo({ top: 0, behavior: autoScrolling ? "auto" : "smooth" });
    }
  }, [halfPageTurn, effectiveSpread, numPages, autoScrolling]);

  const nextPage = useCallback(() => {
    if (effectiveSpread) {
      setSpreadPairStart((s) => Math.min(numPages, s + 2));
    } else if (scrollRef.current) {
      if (halfPageTurn) {
        const el = scrollRef.current;
        // Find the bottom of the last page to limit scrolling
        const lastPageEl = document.getElementById(`pdf-page-${numPages}`);
        if (lastPageEl) {
          const lastPageBottom = lastPageEl.getBoundingClientRect().bottom;
          const containerBottom = el.getBoundingClientRect().bottom;
          if (lastPageBottom <= containerBottom) return; // already showing all content
        }
        el.scrollBy({ top: el.clientHeight / 2, behavior: autoScrolling ? "auto" : "smooth" });
        return;
      }
      // Find the next page to scroll to
      const el = scrollRef.current;
      const containerTop = el.getBoundingClientRect().top;
      for (let i = 1; i <= numPages; i++) {
        const pageEl = document.getElementById(`pdf-page-${i}`);
        if (pageEl) {
          const pageTop = pageEl.getBoundingClientRect().top;
          if (pageTop > containerTop + 10) {
            pageEl.scrollIntoView({ behavior: autoScrolling ? "auto" : "smooth", block: "start" });
            return;
          }
        }
      }
      el.scrollTo({ top: el.scrollHeight, behavior: autoScrolling ? "auto" : "smooth" });
    }
  }, [halfPageTurn, effectiveSpread, numPages, autoScrolling]);

  // Zoom
  const zoomIn = () => { if (viewMode === 'fitWidth') setScale((s) => Math.min(s + 0.25, 3)); };
  const zoomOut = () => { if (viewMode === 'fitWidth') setScale((s) => Math.max(s - 0.25, 0.5)); };
  const fitWidth = () => { setViewMode('fitWidth'); setScale(1); setShowViewMenu(false); };

  // Auto-scroll
  const scrollAccumulator = useRef(0);
  useEffect(() => {
    if (!autoScrolling || !scrollRef.current) {
      cancelAnimationFrame(autoScrollRAF.current);
      scrollAccumulator.current = 0;
      return;
    }
    lastTimeRef.current = performance.now();
    const tick = (now: number) => {
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      // Accumulate fractional pixels — mobile browsers ignore sub-pixel scrollTop
      scrollAccumulator.current += scrollSpeed * delta;
      if (scrollAccumulator.current >= 1 && scrollRef.current) {
        const px = Math.floor(scrollAccumulator.current);
        scrollRef.current.scrollTop += px;
        scrollAccumulator.current -= px;
      }
      autoScrollRAF.current = requestAnimationFrame(tick);
    };
    autoScrollRAF.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(autoScrollRAF.current);
  }, [autoScrolling, scrollSpeed]);

  // Fullscreen (native API with CSS fallback)
  const canNativeFs = typeof document !== 'undefined' && document.fullscreenEnabled;
  const toggleFullscreen = async () => {
    if (!isFullscreen) {
      if (canNativeFs) {
        await containerRef.current?.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (canNativeFs && document.fullscreenElement) {
        await document.exitFullscreen();
      }
      setIsFullscreen(false);
      setPerformanceMode(false);
    }
  };

  // Sync fullscreen state when user exits via Escape or browser controls
  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        setPerformanceMode(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Performance mode
  const togglePerformanceMode = () => {
    if (!performanceMode) {
      if (canNativeFs) containerRef.current?.requestFullscreen().catch(() => { });
      setIsFullscreen(true);
      setPerformanceMode(true);
    } else {
      setPerformanceMode(false);
    }
  };

  const [currentYPercent, setCurrentYPercent] = useState(0);

  // Track current page from scroll position
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      let newPage = 1;
      // If scrolled to bottom, force last page
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 5;
      if (atBottom) {
        newPage = numPages;
      } else {
        for (let i = 1; i <= numPages; i++) {
          const pageEl = document.getElementById(`pdf-page-${i}`);
          if (pageEl) {
            const rect = pageEl.getBoundingClientRect();
            const containerRect = el.getBoundingClientRect();
            if (rect.top <= containerRect.top + containerRect.height / 3) {
              newPage = i;
            }
          }
        }
      }
      
      setCurrentPage((prev) => {
        if (prev !== newPage) {
          localStorage.setItem(`pdf-lastpage-${title}`, String(newPage));
          return newPage;
        }
        return prev;
      });

      // Update Y percent if NavMap panel is open to avoid unnecessary rendering loops when closed
      if (showNavMapPanel) {
        const pageEl = document.getElementById(`pdf-page-${newPage}`);
        if (pageEl) {
          const rect = pageEl.getBoundingClientRect();
          const scrollY = el.getBoundingClientRect().top;
          const offset = scrollY - rect.top;
          setCurrentYPercent(Math.max(0, Math.min(1, offset / rect.height)));
        }
      }
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    // Also trigger once on mount/open to initialize
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, [numPages, title, showNavMapPanel]);

  // Keyboard shortcuts + pedal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      // Pedal key listening mode (for remapping)
      if (isListeningKey) {
        e.preventDefault();
        const key = e.key;
        if (isListeningKey === 'next') {
          const updated = pedalNextKeys.includes(key) ? pedalNextKeys : [...pedalNextKeys, key];
          setPedalNextKeys(updated);
          localStorage.setItem(`${pedalStorageKey}-next`, JSON.stringify(updated));
        } else {
          const updated = pedalPrevKeys.includes(key) ? pedalPrevKeys : [...pedalPrevKeys, key];
          setPedalPrevKeys(updated);
          localStorage.setItem(`${pedalStorageKey}-prev`, JSON.stringify(updated));
        }
        setIsListeningKey(null);
        return;
      }

      // Pedal flash indicator and Navigation
      if (pedalEnabled) {
        if (pedalNextKeys.includes(e.key)) {
          e.preventDefault();
          setPedalFlash('next');
          if (pedalFlashTimer.current) clearTimeout(pedalFlashTimer.current);
          pedalFlashTimer.current = setTimeout(() => setPedalFlash(null), 400);

          if (navMap && navMap.sequence.length > 0 && followModeActive) {
            jumpToNextSequenceIndex();
          } else {
            nextPage();
          }
          return;
        } else if (pedalPrevKeys.includes(e.key)) {
          e.preventDefault();
          setPedalFlash('prev');
          if (pedalFlashTimer.current) clearTimeout(pedalFlashTimer.current);
          pedalFlashTimer.current = setTimeout(() => setPedalFlash(null), 400);

          if (navMap && navMap.sequence.length > 0 && followModeActive) {
            jumpToPrevSequenceIndex();
          } else {
            prevPage();
          }
          return;
        }
      }

      switch (e.key) {
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          if (navMap && navMap.sequence.length > 0 && followModeActive) { jumpToPrevSequenceIndex(); } else { prevPage(); }
          break;
        case "ArrowRight":
        case "PageDown":
          e.preventDefault();
          if (navMap && navMap.sequence.length > 0 && followModeActive) { jumpToNextSequenceIndex(); } else { nextPage(); }
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
        case "b":
        case "B":
          e.preventDefault();
          toggleBookmark(currentPage);
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevPage, nextPage, performanceMode, currentPage, toggleBookmark, pedalEnabled, pedalNextKeys, pedalPrevKeys, isListeningKey, pedalStorageKey, navMap, followModeActive, jumpToNextSequenceIndex, jumpToPrevSequenceIndex]);

  // Swipe gesture for page navigation on touch devices
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      touchStartRef.current = null;
      // Only trigger if horizontal swipe > 50px and more horizontal than vertical
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) {
           if (navMap && navMap.sequence.length > 0 && followModeActive) jumpToNextSequenceIndex(); else nextPage();
        } else {
           if (navMap && navMap.sequence.length > 0 && followModeActive) jumpToPrevSequenceIndex(); else prevPage();
        }
      }
    };
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [nextPage, prevPage, navMap, followModeActive, jumpToNextSequenceIndex, jumpToPrevSequenceIndex]);

  // Performance mode tap
  const handlePerformanceTap = () => {
    if (!performanceMode) return;
    if (navMap && navMap.sequence.length > 0 && followModeActive) {
      jumpToNextSequenceIndex();
    } else {
      nextPage();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full bg-zinc-950 ${performanceMode ? "cursor-none" : ""} ${isFullscreen && !canNativeFs ? "fixed inset-0 z-[9999]" : ""}`}
    >
      {/* Floating exit fullscreen button for touch devices */}
      {isFullscreen && (
        <button
          onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
          className="fixed top-3 right-3 z-[10000] p-2 rounded-full bg-black/50 text-white/30 hover:text-white hover:bg-black/80 active:text-white active:bg-black/80 transition-all backdrop-blur-sm"
          title="Exit fullscreen"
        >
          <Minimize className="w-5 h-5" />
        </button>
      )}
      {/* Scroll container */}
      <div ref={scrollRef} className={`flex-1 min-h-0 ${effectiveSpread ? 'overflow-hidden' : 'overflow-auto'} ${!performanceMode ? 'pb-28 sm:pb-14' : ''} ${darkMode ? '[&_canvas]:invert [&_canvas]:hue-rotate-180' : ''}`} onClick={handlePerformanceTap}>
        <div className={`flex flex-col items-center ${effectiveSpread ? 'h-full' : 'py-0 gap-4'}`}>
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
              /* Two-page spread — paginated, fit to viewport */
              <div className="flex items-center justify-center gap-4 w-full h-full">
                {[0, 1].map((idx) => {
                  const pageNum = spreadPairStart + idx;
                  if (pageNum > numPages) return null;
                  return (
                    <div
                      key={`spread-${idx}`}
                      id={`pdf-page-${pageNum}`}
                      className="relative shadow-lg"
                    >
                      {bookmarkedPages.has(pageNum) && (
                        <div className="absolute top-2 right-2 z-10">
                          <BookmarkCheck className="w-5 h-5 text-amber-400 drop-shadow" />
                        </div>
                      )}
                      <canvas
                        id={`pdf-canvas-spread-${idx}`}
                        className="bg-white block"
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Single page — continuous scroll */
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
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-2 sm:px-4 py-1.5 sm:py-2 bg-zinc-900 border-t border-zinc-800 select-none">
          {/* Left group: Page nav */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={prevPage}
              disabled={effectiveSpread ? spreadPairStart <= 1 : (currentPage <= 1 && !halfPageTurn)}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-zinc-400 min-w-[80px] text-center">
              {effectiveSpread
                ? `${spreadPairStart}-${Math.min(spreadPairStart + 1, numPages)} / ${numPages}`
                : t("pageOf", { current: currentPage, total: numPages })}
            </span>
            <button
              onClick={nextPage}
              disabled={effectiveSpread ? spreadPairStart + 1 >= numPages : (currentPage >= numPages && !halfPageTurn)}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Center group: Zoom + View mode */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={zoomOut}
              disabled={viewMode !== 'fitWidth'}
              className="hidden sm:flex p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-colors"
              title={t("zoomOut")}
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <Popover open={showViewMenu} onOpenChange={setShowViewMenu}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors" title={t("fitWidth")}>
                  {viewMode === 'twoPages' && <Columns2 className="w-3 h-3" />}
                  {viewMode === 'fitHeight' && <ArrowDownToLine className="w-3 h-3" />}
                  {viewMode === 'fitWidth' && `${Math.round(scale * 100)}%`}
                  {viewMode === 'fitHeight' && ` ${t('fitHeight')}`}
                  {viewMode === 'twoPages' && ` ${t('spreadView')}`}
                  <ChevronDown className="w-3 h-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="center" collisionPadding={8} className="w-auto min-w-[160px] p-0 bg-zinc-900 border-zinc-700">
                <div className="py-1">
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-500 font-bold">{t('viewMode')}</div>
                  <button onClick={() => { setViewMode('fitWidth'); setScale(1); setShowViewMenu(false); }} className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-zinc-800 transition-colors ${viewMode === 'fitWidth' ? 'text-indigo-400 font-semibold' : 'text-zinc-300'}`}><PanelTop className="w-3.5 h-3.5" />{t('fitWidth')}</button>
                  <button onClick={() => { setViewMode('fitHeight'); setShowViewMenu(false); }} className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-zinc-800 transition-colors ${viewMode === 'fitHeight' ? 'text-indigo-400 font-semibold' : 'text-zinc-300'}`}><ArrowDownToLine className="w-3.5 h-3.5" />{t('fitHeight')}</button>
                  <button onClick={() => { setViewMode('twoPages'); setShowViewMenu(false); }} disabled={isNarrow} className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-zinc-800 transition-colors ${viewMode === 'twoPages' ? 'text-indigo-400 font-semibold' : 'text-zinc-300'} ${isNarrow ? 'opacity-30 cursor-not-allowed' : ''}`}><Columns2 className="w-3.5 h-3.5" />{t('spreadView')}</button>
                </div>
              </PopoverContent>
            </Popover>

            <button
              onClick={zoomIn}
              disabled={viewMode !== 'fitWidth'}
              className="hidden sm:flex p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-colors"
              title={t("zoomIn")}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Right group: Feature toggles */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Half-page turn (desktop only) */}
            <button
              onClick={() => setHalfPageTurn((v) => !v)}
              className={`hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${halfPageTurn ? "bg-amber-600 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
              title={t("halfPageTurn")}
            >
              <ChevronsUp className="w-3.5 h-3.5" />½
            </button>

            {/* Page-turn pedal — always visible */}
            <Popover open={showPedalPanel && !pedalEnabled} onOpenChange={(open) => { if (!open) setShowPedalPanel(false); }}>
              <PopoverTrigger asChild>
                <button
                  onClick={() => {
                    if (pedalEnabled) { setPedalEnabled(false); setShowPedalPanel(false); localStorage.setItem(`${pedalStorageKey}-enabled`, 'false'); }
                    else setShowPedalPanel((v) => !v);
                  }}
                  className={`flex items-center gap-1 px-1.5 sm:px-2 py-1.5 rounded-md text-xs transition-all ${pedalEnabled ? pedalFlash ? "bg-emerald-400 text-black scale-105" : "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                  title={t("pedalMode")}
                >
                  <Footprints className="w-3.5 h-3.5" />
                  {pedalEnabled && <span className={`w-1.5 h-1.5 rounded-full transition-colors ${pedalFlash ? 'bg-white' : 'bg-emerald-300'}`} />}
                </button>
              </PopoverTrigger>
                <PopoverContent side="top" align="end" collisionPadding={16} className="w-[200px] p-3 bg-zinc-900 border-zinc-700">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2">{t("pedalMode")}</div>
                  <div className="mb-2">
                    <div className="text-[10px] text-zinc-500 mb-1">{t("next")} →</div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {pedalNextKeys.map((k) => (
                        <span key={k} className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-zinc-800 rounded text-[9px] text-zinc-300 font-mono">
                          {k}
                          <button onClick={() => { const updated = pedalNextKeys.filter((x) => x !== k); setPedalNextKeys(updated); localStorage.setItem(`${pedalStorageKey}-next`, JSON.stringify(updated)); }} className="text-zinc-500 hover:text-red-400 ml-0.5">×</button>
                        </span>
                      ))}
                    </div>
                    <button onClick={() => setIsListeningKey('next')} className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${isListeningKey === 'next' ? 'border-indigo-500 text-indigo-400 animate-pulse' : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}>
                      {isListeningKey === 'next' ? t("pressAnyKey") : `+ ${t("addKey")}`}
                    </button>
                  </div>
                  <div className="mb-3">
                    <div className="text-[10px] text-zinc-500 mb-1">← {t("prev")}</div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {pedalPrevKeys.map((k) => (
                        <span key={k} className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-zinc-800 rounded text-[9px] text-zinc-300 font-mono">
                          {k}
                          <button onClick={() => { const updated = pedalPrevKeys.filter((x) => x !== k); setPedalPrevKeys(updated); localStorage.setItem(`${pedalStorageKey}-prev`, JSON.stringify(updated)); }} className="text-zinc-500 hover:text-red-400 ml-0.5">×</button>
                        </span>
                      ))}
                    </div>
                    <button onClick={() => setIsListeningKey('prev')} className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${isListeningKey === 'prev' ? 'border-indigo-500 text-indigo-400 animate-pulse' : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}>
                      {isListeningKey === 'prev' ? t("pressAnyKey") : `+ ${t("addKey")}`}
                    </button>
                  </div>
                  <button onClick={() => { setPedalEnabled(true); setShowPedalPanel(false); localStorage.setItem(`${pedalStorageKey}-enabled`, 'true'); }} className="w-full py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors">
                    ▶ {t("enablePedal")}
                  </button>
                </PopoverContent>
            </Popover>

            {/* Metronome — always visible */}
            <Popover open={showMetronomePanel} onOpenChange={setShowMetronomePanel}>
              <PopoverTrigger asChild>
                <button
                  onClick={() => setShowMetronomePanel((v) => !v)}
                  className={`flex items-center gap-1 px-1.5 sm:px-2 py-1.5 rounded-md text-xs transition-colors ${metronomeOn ? "bg-green-600 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                  title={t("metronome")}
                >
                  <Timer className="w-3.5 h-3.5" />
                  {metronomeOn && <span className="font-mono">{bpm}</span>}
                  {metronomeOn && (
                    <span className="flex gap-0.5 ml-1">
                      {Array.from({ length: timeSignature[0] }, (_, i) => (
                        <span key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentBeat ? (i === 0 ? "bg-amber-400 scale-125" : "bg-white scale-110") : "bg-zinc-600"}`} />
                      ))}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="end" collisionPadding={8} className="w-auto min-w-[200px] p-3 bg-zinc-900 border-zinc-700">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2">{t("metronome")}</div>
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="text-xs text-zinc-400">{t("bpm")}</span>
                  <button onClick={() => setBpm((b) => Math.max(40, b - 1))} className="w-7 h-7 flex items-center justify-center rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-sm font-bold transition-colors">−</button>
                  <span className="text-lg font-mono text-white w-10 text-center">{bpm}</span>
                  <button onClick={() => setBpm((b) => Math.min(240, b + 1))} className="w-7 h-7 flex items-center justify-center rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-sm font-bold transition-colors">+</button>
                </div>
                <button onClick={handleTapTempo} className="w-full mb-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 font-medium transition-colors">{t("tapTempo")}</button>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-zinc-400">{t("timeSignature")}</span>
                  <div className="flex gap-1">
                    {([[2, 4], [3, 4], [4, 4], [6, 8]] as [number, number][]).map(([n, d]) => (
                      <button key={`${n}/${d}`} onClick={() => setTimeSignature([n, d])} className={`px-2 py-1 rounded text-xs font-mono transition-colors ${timeSignature[0] === n && timeSignature[1] === d ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>{n}/{d}</button>
                    ))}
                  </div>
                </div>
                {metronomeOn ? (
                  <button onClick={() => setMetronomeOn(false)} className="w-full py-2 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors">■ Stop</button>
                ) : (
                  <button onClick={() => setMetronomeOn(true)} className="w-full py-2 rounded-md bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors">▶ Start</button>
                )}
              </PopoverContent>
            </Popover>

            {/* === Always visible === */}
            {/* Bookmark */}
            <Popover open={showBookmarkMenu && bookmarkedPages.size > 0} onOpenChange={setShowBookmarkMenu}>
              <div className="flex items-center">
                <button
                  onClick={() => toggleBookmark(currentPage)}
                  className={`p-1.5 rounded-md transition-colors ${bookmarkedPages.has(currentPage) ? "text-amber-400 bg-amber-500/10" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                  title={t("bookmark")}
                >
                  {bookmarkedPages.has(currentPage) ? <BookmarkCheck className="w-4 h-4" /> : <BookmarkIcon className="w-4 h-4" />}
                </button>
                {bookmarkedPages.size > 0 && (
                  <PopoverTrigger asChild>
                    <button className="p-0.5 rounded text-zinc-500 hover:text-white transition-colors">
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </PopoverTrigger>
                )}
              </div>
              <PopoverContent side="top" align="end" collisionPadding={8} className="w-auto min-w-[120px] p-0 bg-zinc-900 border-zinc-700">
                <div className="py-1">
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-500 font-bold">{t("bookmark")}s</div>
                  {[...bookmarkedPages].sort((a, b) => a - b).map((p) => (
                    <button key={p} onClick={() => { goToPage(p); setShowBookmarkMenu(false); }} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800 flex items-center gap-2 ${p === currentPage ? "text-amber-400 font-semibold" : "text-zinc-300"}`}>
                      <BookmarkCheck className="w-3 h-3 text-amber-400" />
                      {t("pageOf", { current: String(p), total: String(numPages) })}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <button
              onClick={() => {
                setShowNavMapPanel(!showNavMapPanel);
                if (!showNavMapPanel) setFollowModeActive(true); // Re-enable follow mode if opening map
              }}
              className={`p-1.5 rounded-md transition-colors ${showNavMapPanel || (navMap?.sequence.length ? true : false) ? "text-indigo-400 bg-indigo-500/10" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
              title="Navigation Map"
            >
              <MapIcon className="w-4 h-4" />
            </button>

            {/* Screen mode (desktop only) */}
            <div className="hidden sm:block">
              <Popover open={showScreenMenu} onOpenChange={setShowScreenMenu}>
                <PopoverTrigger asChild>
                  <button className={`p-1.5 rounded-md transition-colors ${isFullscreen || performanceMode ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
                    {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="end" collisionPadding={8} className="w-auto min-w-[180px] p-0 bg-zinc-900 border-zinc-700">
                  <div className="py-1">
                    <button onClick={() => { toggleFullscreen(); setShowScreenMenu(false); }} className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-zinc-800 transition-colors ${isFullscreen ? 'text-indigo-400 font-semibold' : 'text-zinc-300'}`}>
                      {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                      {isFullscreen ? t("exitFullscreen") : t("fullscreen")}
                    </button>
                    <button onClick={() => { togglePerformanceMode(); setShowScreenMenu(false); }} className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-zinc-800 transition-colors ${performanceMode ? 'text-indigo-400 font-semibold' : 'text-zinc-300'}`}>
                      <Maximize className="w-3.5 h-3.5" />
                      {t("performanceMode")}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Auto-scroll (desktop only, in three-dot on mobile) */}
            <div className="hidden sm:flex items-center gap-1">
              <button
                onClick={() => setAutoScrolling((v) => !v)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${autoScrolling ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                title={t("autoScroll")}
              >
                {autoScrolling ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                Auto
              </button>
              {autoScrolling && (
                <div className="flex items-center gap-0.5">
                  <button onClick={() => setScrollSpeed((s) => Math.max(5, s - 5))} className="px-1 py-0.5 rounded text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">−</button>
                  <span className="text-xs text-zinc-400 font-mono w-6 text-center">{scrollSpeed}</span>
                  <button onClick={() => setScrollSpeed((s) => Math.min(150, s + 5))} className="px-1 py-0.5 rounded text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">+</button>
                </div>
              )}
            </div>

            {/* Dark mode toggle (desktop) */}
            <button
              onClick={() => setDarkMode((v) => !v)}
              className={`hidden sm:flex p-1.5 rounded-md transition-colors ${darkMode ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
              title={darkMode ? t('lightMode') : t('darkModePdf')}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* === Mobile-only: three-dot menu === */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="sm:hidden p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="end" collisionPadding={8} className="w-auto min-w-[200px] p-0 bg-zinc-900 border-zinc-700">
                <div className="py-1">
                  {/* Auto-scroll */}
                  <div className="px-3 py-1.5">
                    <button
                      onClick={() => setAutoScrolling((v) => !v)}
                      className={`w-full text-left text-xs flex items-center gap-2 mb-1.5 ${autoScrolling ? 'text-indigo-400 font-semibold' : 'text-zinc-300'}`}
                    >
                      {autoScrolling ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      {t("autoScroll")} {autoScrolling && "✓"}
                    </button>
                    {autoScrolling && (
                      <>
                        <div className="flex items-center gap-2 mt-1">
                          <button onClick={() => setScrollSpeed((s) => Math.max(5, s - 5))} className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs transition-colors">−</button>
                          <span className="text-xs text-zinc-400 font-mono flex-1 text-center">{scrollSpeed}</span>
                          <button onClick={() => setScrollSpeed((s) => Math.min(150, s + 5))} className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs transition-colors">+</button>
                        </div>
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {[['Largo', 20], ['Andante', 40], ['Mod.', 60], ['Allegro', 90], ['Presto', 120]].map(([label, speed]) => (
                            <button key={label as string} onClick={() => setScrollSpeed(speed as number)} className={`px-1.5 py-0.5 rounded text-[9px] transition-colors ${scrollSpeed === speed ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}>{label}</button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="my-1 border-t border-zinc-800" />
                  {/* Dark mode */}
                  <button
                    onClick={() => setDarkMode((v) => !v)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-zinc-800 transition-colors ${darkMode ? 'text-amber-400 font-semibold' : 'text-zinc-300'}`}
                  >
                    {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                    {darkMode ? t('lightMode') : t('darkModePdf')} {darkMode && "✓"}
                  </button>
                  <div className="my-1 border-t border-zinc-800" />
                  {/* Half-page turn */}
                  <button
                    onClick={() => setHalfPageTurn((v) => !v)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-zinc-800 transition-colors ${halfPageTurn ? 'text-amber-400 font-semibold' : 'text-zinc-300'}`}
                  >
                    <ChevronsUp className="w-3.5 h-3.5" />
                    {t("halfPageTurn")} {halfPageTurn && "✓"}
                  </button>
                  <div className="my-1 border-t border-zinc-800" />
                  {/* Zoom */}
                  <button onClick={zoomOut} disabled={viewMode !== 'fitWidth'} className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-zinc-800 transition-colors text-zinc-300 disabled:opacity-30">
                    <ZoomOut className="w-3.5 h-3.5" />{t("zoomOut")}
                  </button>
                  <button onClick={zoomIn} disabled={viewMode !== 'fitWidth'} className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-zinc-800 transition-colors text-zinc-300 disabled:opacity-30">
                    <ZoomIn className="w-3.5 h-3.5" />{t("zoomIn")}
                  </button>
                  <div className="my-1 border-t border-zinc-800" />
                  {/* Fullscreen */}
                  <button onClick={() => toggleFullscreen()} className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-zinc-800 transition-colors ${isFullscreen ? 'text-indigo-400 font-semibold' : 'text-zinc-300'}`}>
                    {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                    {isFullscreen ? t("exitFullscreen") : t("fullscreen")}
                  </button>
                  {/* Performance mode */}
                  <button onClick={() => togglePerformanceMode()} className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-zinc-800 transition-colors ${performanceMode ? 'text-indigo-400 font-semibold' : 'text-zinc-300'}`}>
                    <Maximize className="w-3.5 h-3.5" />
                    {t("performanceMode")}
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      {/* Nav Map Panel & Sequence Follow UI */}
      <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden">
        {showNavMapPanel && (
          <Draggable nodeRef={navMapDragRef} handle=".navmap-drag-handle" cancel="button" bounds="parent" defaultPosition={{ x: typeof window !== 'undefined' && window.innerWidth < 640 ? window.innerWidth - 276 : typeof window !== 'undefined' ? window.innerWidth - 336 : 0, y: 64 }}>
             <div ref={navMapDragRef} className="pointer-events-auto h-[600px] max-h-[70vh] absolute">
               <PdfNavMapPanel
                 sheetMusicId={sheetMusicId}
                 initialNavMap={navMap}
                 currentPage={currentPage}
                 currentYPercent={currentYPercent}
                 onSave={handleSaveNavMap}
                 onJumpToBookmark={jumpToBookmark}
                 onClose={() => setShowNavMapPanel(false)}
                 isSaving={savingNavMap}
                 readOnly={readOnlyMap}
               />
             </div>
          </Draggable>
        )}
      </div>

      {navMap && navMap.sequence.length > 0 && followModeActive && !showNavMapPanel && !performanceMode && !isFullscreen && (
         <div className="fixed bottom-[60px] sm:bottom-[64px] right-1/2 translate-x-1/2 sm:translate-x-0 sm:right-6 z-50 bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl p-1.5 sm:p-2 flex items-center gap-1.5 sm:gap-3 w-[calc(100%-32px)] sm:w-[340px] max-w-[340px] backdrop-blur-md bg-opacity-95">
            <button
               onClick={() => setFollowModeActive(false)}
               className="absolute -top-2.5 -right-2.5 sm:-top-3.5 sm:-right-3.5 p-1 bg-zinc-800 border border-zinc-700 rounded-full text-zinc-400 hover:text-white hover:bg-red-500 hover:border-red-500 shadow-xl transition-all"
               title="Dismiss"
            >
               <X className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>
            <button onClick={jumpToPrevSequenceIndex} className="p-1.5 sm:p-2 ml-0.5 sm:ml-1 rounded-md sm:rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors stretch-0 shrink-0">
               <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="flex-1 min-w-0 text-center px-1">
               <div className="text-[9px] sm:text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-0.5">Reading Sequence</div>
               <div className="text-xs sm:text-sm font-medium text-white truncate px-1">
                  {navSeqIndex >= 0 ? navMap.bookmarks.find(b => b.id === navMap.sequence[navSeqIndex])?.name || `Step ${navSeqIndex + 1}` : "Follow Mode"}
               </div>
            </div>
            <button onClick={jumpToNextSequenceIndex} className="p-1.5 sm:p-2 mr-1 sm:mr-1.5 rounded-md sm:rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow shadow-indigo-500/20 transition-all active:scale-95">
               <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
         </div>
      )}
    </div>
  );
}
