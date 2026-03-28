"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import {
  getSheetMusic,
  getSheetPdfUrl,
  touchSheetLastOpened,
  type SheetMusicDocument,
} from "@/lib/appwrite";
import { Loader2, ChevronLeft, Maximize, Minimize, Play, Pause, ChevronUp, ChevronDown, ZoomIn, ZoomOut, Bookmark } from "lucide-react";
import dynamic from "next/dynamic";

const PdfViewerCore = dynamic(() => import("@/components/pdf/PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[80vh]">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  ),
});

export default function PdfViewPage() {
  const params = useParams();
  const t = useTranslations("Pdfs");
  const id = params.id as string;
  const [sheet, setSheet] = useState<SheetMusicDocument | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function load() {
      try {
        const doc = await getSheetMusic(id);
        setSheet(doc);
        setPdfUrl(getSheetPdfUrl(doc.fileId));
        // Update lastOpenedAt
        touchSheetLastOpened(id).catch(() => {});
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !sheet) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-white gap-4">
        <p className="text-red-400">{error || "PDF not found"}</p>
        <Link href="/dashboard/pdfs" className="text-indigo-400 hover:underline">
          {t("backToLibrary")}
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex-shrink-0">
        <Link
          href="/dashboard/pdfs"
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          {t("backToLibrary")}
        </Link>
        <h1 className="text-sm font-medium text-white truncate max-w-md">
          {sheet.title}
        </h1>
        <div className="w-32" /> {/* Spacer for centering */}
      </header>

      {/* Viewer */}
      <div className="flex-1 overflow-hidden">
        <PdfViewerCore pdfUrl={pdfUrl} pageCount={sheet.pageCount} title={sheet.title} />
      </div>
    </div>
  );
}
