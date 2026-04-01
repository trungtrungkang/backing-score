"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import {
  getSetlist,
  getSheetMusic,
  getNavMap,
  type SetlistDocument,
  type SetlistItem,
  type SheetMusicDocument,
} from "@/lib/appwrite";
import { useAuth } from "@/contexts/AuthContext";
import PdfViewer from "@/components/pdf/PdfViewer";
import { Loader2, ListMusic, ChevronLeft, ArrowLeft, Menu, X } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/routing";

export default function SetlistViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const t = useTranslations("Pdfs");
  const resolvedParams = use(params);
  const setId = resolvedParams.id;

  const [setlist, setSetlist] = useState<SetlistDocument | null>(null);
  const [items, setItems] = useState<SetlistItem[]>([]);
  const [activeSongIndex, setActiveSongIndex] = useState(0);
  const [activeSheet, setActiveSheet] = useState<SheetMusicDocument | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [songLoading, setSongLoading] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  // Initial load
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!user) return;

    getSetlist(setId)
      .then((doc) => {
        setSetlist(doc);
        if (doc.items) {
          const parsed = JSON.parse(doc.items);
          setItems(parsed);
          if (parsed.length === 0) {
            toast.error("This setlist is empty");
            router.push(`/dashboard/pdfs/setlist/${setId}/edit`);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load setlist");
        router.push("/dashboard/pdfs/setlists");
      });
  }, [authLoading, user, setId, router]);

  // Load active song
  useEffect(() => {
    if (items.length === 0) return;
    
    setSongLoading(true);
    const item = items[activeSongIndex];
    
    async function fetchSong() {
      try {
        const sheet = await getSheetMusic(item.sheetMusicId);
        try {
          const nav = await getNavMap(item.sheetMusicId);
          if (nav) sheet.navMap = nav;
        } catch { /* best-effort */ }
        setActiveSheet(sheet);
      } catch (err) {
        toast.error(`Failed to load song: ${item.title}`);
      } finally {
        setSongLoading(false);
      }
    }
    fetchSong();
  }, [activeSongIndex, items]);

  const handleNextSong = () => {
    if (activeSongIndex < items.length - 1) {
      setActiveSongIndex(activeSongIndex + 1);
    }
  };

  const handlePrevSong = () => {
    if (activeSongIndex > 0) {
      setActiveSongIndex(activeSongIndex - 1);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center text-white z-50">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mb-4" />
        <p className="font-bold">Loading Setlist...</p>
      </div>
    );
  }

  if (!activeSheet) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center z-50">
        {songLoading ? (
           <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        ) : (
           <div className="text-center text-zinc-500">Failed to load piece.</div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-40 overflow-hidden">
       {/* 
         Wrapper Top Bar: Very subtle, appears on hover or just a tiny button 
         that opens the Setlist Drawer
       */}
       <div className="absolute top-4 left-4 z-50">
         <button 
            onClick={() => setShowDrawer(true)} 
            className="flex items-center gap-2 px-3 py-2 bg-black/50 hover:bg-black/80 backdrop-blur-md rounded-lg text-white font-bold transition-all shadow-lg border border-white/10"
         >
           <ListMusic className="w-4 h-4 text-amber-400" />
           <span className="text-sm">
             {activeSongIndex + 1} / {items.length}
           </span>
         </button>
       </div>

       {songLoading && (
         <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
            <div className="text-xl font-bold text-white mb-1">{items[activeSongIndex]?.title}</div>
            <div className="text-sm text-zinc-400">Loading {activeSongIndex + 1} of {items.length}</div>
         </div>
       )}

       <PdfViewer 
          key={`${activeSheet.$id}-${activeSongIndex}`} // Force totally clean re-mount on every song change
          sheetMusicId={activeSheet.$id}
          pdfUrl={`/api/r2/download/${activeSheet.fileId}`}
          pageCount={activeSheet.pageCount}
          title={activeSheet.title}
          initialNavMap={activeSheet.navMap}
          
          onNextSong={handleNextSong}
          onPrevSong={handlePrevSong}
          hasNextSong={activeSongIndex < items.length - 1}
          hasPrevSong={activeSongIndex > 0}
       />
       
       {/* Playlist Drawer Overlay */}
       {showDrawer && (
         <div className="absolute inset-0 z-50 flex">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
              onClick={() => setShowDrawer(false)}
            />
            
            {/* Slide-over */}
            <div className="relative w-80 max-w-full bg-zinc-950 border-r border-zinc-800 h-full flex flex-col animate-in slide-in-from-left duration-200">
               <div className="p-4 border-b border-zinc-900 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black text-white truncate">{setlist?.name}</h2>
                    <p className="text-xs text-zinc-500">{items.length} pieces</p>
                  </div>
                  <button onClick={() => setShowDrawer(false)} className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900">
                     <X className="w-5 h-5" />
                  </button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-2 space-y-1">
                 {items.map((item, index) => {
                   const isActive = index === activeSongIndex;
                   return (
                     <button
                       key={`${item.sheetMusicId}-${index}`}
                       onClick={() => {
                         setActiveSongIndex(index);
                         setShowDrawer(false);
                       }}
                       className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                         isActive 
                           ? "bg-indigo-500/20 text-white border border-indigo-500/30 font-bold" 
                           : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
                       }`}
                     >
                        <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${isActive ? "bg-indigo-500 text-white" : "bg-zinc-800 text-zinc-500"}`}>
                           <span className="text-xs font-bold">{index + 1}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{item.title}</div>
                          <div className={`text-[10px] ${isActive ? "text-indigo-300" : "text-zinc-600"}`}>{item.pageCount} pages</div>
                        </div>
                     </button>
                   );
                 })}
               </div>
               
               <div className="p-4 border-t border-zinc-900">
                 <Link href="/dashboard/pdfs/setlists" className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-white font-medium transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Exit Setlist
                 </Link>
               </div>
            </div>
         </div>
       )}
    </div>
  );
}
