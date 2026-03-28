"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
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
} from "lucide-react";

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface PdfViewerProps {
  pdfUrl: string;
  pageCount: number;
  title: string;
}

// Tempo presets in pixels/second for auto-scroll
const TEMPO_PRESETS = [
  { name: "Largo", speed: 15 },
  { name: "Andante", speed: 30 },
  { name: "Moderato", speed: 50 },
  { name: "Allegro", speed: 75 },
  { name: "Presto", speed: 110 },
];

export default function PdfViewer({ pdfUrl, pageCount, title }: PdfViewerProps) {
  const t = useTranslations("Pdfs");
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRAF = useRef<number>(0);

  // State
  const [numPages, setNumPages] = useState(pageCount);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [containerWidth, setContainerWidth] = useState(800);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [halfPageTurn, setHalfPageTurn] = useState(false);
  const [performanceMode, setPerformanceMode] = useState(false);

  // Auto-scroll state
  const [autoScrolling, setAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(30); // pixels per second
  const lastTimeRef = useRef(0);

  // Measure container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Document loaded
  const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
  };

  // Page navigation
  const goToPage = useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(page, numPages));
      setCurrentPage(clamped);

      // Scroll to page in continuous mode
      const pageEl = document.getElementById(`pdf-page-${clamped}`);
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
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
      if (scrollRef.current) {
        scrollRef.current.scrollTop += scrollSpeed * delta;
      }
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
        case " ": // Space — toggle auto-scroll
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
          if (performanceMode) {
            setPerformanceMode(false);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevPage, nextPage, performanceMode]);

  // Performance mode: tap to advance
  const handlePerformanceTap = () => {
    if (!performanceMode) return;
    nextPage();
  };

  const pageWidth = containerWidth * scale;

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full bg-zinc-950 ${performanceMode ? "cursor-none" : ""}`}
    >
      {/* Scroll container with all pages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto"
        onClick={handlePerformanceTap}
      >
        <div className="flex flex-col items-center py-4 gap-4">
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex items-center justify-center h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
              </div>
            }
            error={
              <div className="text-red-400 text-center py-20">
                Failed to load PDF
              </div>
            }
          >
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <div
                key={pageNum}
                id={`pdf-page-${pageNum}`}
                className="shadow-lg mb-2"
              >
                <Page
                  pageNumber={pageNum}
                  width={pageWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </div>
            ))}
          </Document>
        </div>
      </div>

      {/* Bottom toolbar — hidden in performance mode */}
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
            {/* Auto-scroll toggle + speed */}
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
              <ChevronsUp className="w-3.5 h-3.5" />
              ½
            </button>

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
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
