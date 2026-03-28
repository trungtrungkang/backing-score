"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import {
  getSheetMusic,
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
  const searchParams = useSearchParams();
  const t = useTranslations("Pdfs");
  const id = params.id as string;
  const isShared = searchParams.get("shared") === "1";
  const backTo = searchParams.get("back") || null;
  const [sheet, setSheet] = useState<SheetMusicDocument | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function load() {
      try {
        let doc: SheetMusicDocument;

        if (isShared) {
          // Shared mode: use server API proxy (no client-side Appwrite permissions needed)
          const res = await fetch(`/api/sheet-music/${id}`);
          if (!res.ok) throw new Error("not_found");
          doc = await res.json() as SheetMusicDocument;
        } else {
          // Owner mode: direct Appwrite client call
          doc = await getSheetMusic(id);
          // Update lastOpenedAt only for owner
          touchSheetLastOpened(id).catch(() => {});
        }

        setSheet(doc);
        // Both modes use the API proxy for the actual PDF file
        setPdfUrl(`/api/files/${doc.fileId}?bucket=sheet_pdfs`);
      } catch (err) {
        console.error("Failed to load PDF:", err);
        setError("not_found");
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id, isShared]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !sheet) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] bg-zinc-950 text-white gap-4">
        <div className="text-6xl mb-2">📄</div>
        <p className="text-zinc-300 text-lg font-medium">{t("pdfNotFound")}</p>
        <p className="text-zinc-500 text-sm max-w-md text-center">{t("pdfNotFoundDescription")}</p>
        <Link href={backTo || "/dashboard/pdfs"} className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
          {t("backToLibrary")}
        </Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] h-[calc(100dvh-4rem)] flex flex-col bg-zinc-950 overflow-hidden">
      {/* Top bar — hidden on mobile to maximize viewer space */}
      <header className="hidden sm:flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800 flex-shrink-0 gap-2 min-h-[44px]">
        <Link
          href={backTo || "/dashboard/pdfs"}
          className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors text-sm shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>{backTo ? t("back") : t("backToLibrary")}</span>
        </Link>
        <h1 className="text-sm font-medium text-white truncate text-center flex-1 min-w-0">
          {sheet.title}
        </h1>
        <div className="w-24 shrink-0" />
      </header>

      {/* Viewer */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <PdfViewerCore pdfUrl={pdfUrl} pageCount={sheet.pageCount} title={sheet.title} />
      </div>
    </div>
  );
}

