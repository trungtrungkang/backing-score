"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import {
  getSetlist,
  updateSetlist,
  listMySheetMusic,
  type SetlistDocument,
  type SetlistItem,
  type SheetMusicDocument,
} from "@/lib/appwrite";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  Loader2,
  FileText,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

export default function EditSetlistPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const t = useTranslations("Pdfs");
  const resolvedParams = use(params);
  const setId = resolvedParams.id;

  const [setlist, setSetlist] = useState<SetlistDocument | null>(null);
  const [items, setItems] = useState<SetlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  // Sheet picker state
  const [sheets, setSheets] = useState<SheetMusicDocument[]>([]);
  const [sheetsLoaded, setSheetsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!user) return;

    // Load initial setlist
    getSetlist(setId)
      .then((doc) => {
        setSetlist(doc);
        setName(doc.name);
        try {
          if (doc.items) {
            setItems(JSON.parse(doc.items));
          }
        } catch { /* skip */ }
        setLoading(false);
      })
      .catch((err) => {
        toast.error("Failed to load setlist");
        router.push("/dashboard/pdfs/setlists");
      });

  }, [authLoading, user, setId, router]);

  const loadSheets = async () => {
    if (sheetsLoaded) return;
    try {
      const res = await listMySheetMusic();
      setSheets(res.documents);
      setSheetsLoaded(true);
    } catch {
      toast.error("Failed to load PDF library");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSetlist(setId, { name, items });
      toast.success("Setlist saved");
      router.push("/dashboard/pdfs/setlists");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddItem = (sheet: SheetMusicDocument) => {
    setItems((prev) => [
      ...prev,
      {
        sheetMusicId: sheet.$id,
        title: sheet.title,
        pageCount: sheet.pageCount,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => {
      const copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setItems((prev) => {
      const arr = [...prev];
      const temp = arr[index - 1];
      arr[index - 1] = arr[index];
      arr[index] = temp;
      return arr;
    });
  };

  const moveDown = (index: number) => {
    if (index === items.length - 1) return;
    setItems((prev) => {
      const arr = [...prev];
      const temp = arr[index + 1];
      arr[index + 1] = arr[index];
      arr[index] = temp;
      return arr;
    });
  };

  const filteredSheets = sheets.filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-zinc-50 dark:bg-zinc-950">
      {/* Sticky Header */}
      <div className="sticky top-[60px] z-30 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1 min-w-0">
            <Link 
              href="/dashboard/pdfs/setlists" 
              className="shrink-0 p-2 -ml-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-all"
              title={t("back") || "Back"}
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Setlist Name"
              className="text-2xl font-extrabold bg-transparent border border-transparent hover:border-zinc-200 focus:border-indigo-500 dark:hover:border-zinc-800 dark:focus:border-indigo-500 rounded-lg px-3 py-1 outline-none text-zinc-900 dark:text-white w-full max-w-md transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-700 focus:bg-white dark:focus:bg-zinc-900 focus:shadow-sm"
            />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link href={`/dashboard/pdfs/setlist/${setId}`}>
              <Button variant="outline" className="hidden sm:flex rounded-full px-6 h-10 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                Play Setlist
              </Button>
            </Link>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white min-w-[120px] shadow-md shadow-indigo-500/20 rounded-full h-10 px-6 transition-all">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {t("save") || "Save Setlist"}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Playlist Queue */}
          <div className="lg:col-span-7">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-2xl overflow-hidden flex flex-col min-h-[400px]">
              {/* Container Header */}
              <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-3">
                  Queue
                  <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs font-bold px-2 py-0.5 rounded-full">
                    {items.length} {items.length === 1 ? 'track' : 'tracks'}
                  </span>
                </h2>
              </div>
              
              {items.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <div className="w-16 h-16 bg-white dark:bg-zinc-800 shadow-sm rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-zinc-300 dark:text-zinc-500" />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Queue is empty</h3>
                  <p className="text-sm text-zinc-500 max-w-[250px] mx-auto">Search and add your sheet music from the library panel.</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50 flex-1">
                    {items.map((item, index) => (
                      <div key={`${item.sheetMusicId}-${index}`} className="group flex items-center p-3 sm:px-4 sm:py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        {/* Drag Handle / Index */}
                        <div className="flex items-center justify-center w-8 mr-3 shrink-0 text-zinc-400 group-hover:text-zinc-500 transition-colors">
                          <span className="text-sm font-semibold sm:group-hover:hidden">{index + 1}</span>
                          <GripVertical className="w-4 h-4 hidden sm:group-hover:block" />
                        </div>
                        
                        {/* Song Info */}
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{item.title}</div>
                          <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                             <span>{item.pageCount} pages</span>
                          </div>
                        </div>
                        
                        {/* Row Actions */}
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                          <div className="flex flex-row bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden mr-3 shadow-sm">
                             <button onClick={() => moveUp(index)} disabled={index === 0} className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-zinc-800 transition-colors"><ChevronUp className="w-4 h-4 text-zinc-600 dark:text-zinc-300" /></button>
                             <div className="w-px bg-zinc-200 dark:bg-zinc-700" />
                             <button onClick={() => moveDown(index)} disabled={index === items.length - 1} className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-zinc-800 transition-colors"><ChevronDown className="w-4 h-4 text-zinc-600 dark:text-zinc-300" /></button>
                          </div>
                          <button onClick={() => handleRemoveItem(index)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Remove track">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Total Footer */}
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800 p-4 flex justify-between items-center px-5 shrink-0">
                     <div className="text-xs text-zinc-500 font-medium">
                       Total Pages: <span className="text-zinc-900 dark:text-white font-bold ml-1">{items.reduce((acc, it) => acc + it.pageCount, 0)}</span>
                     </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Library Picker */}
          <div className="lg:col-span-5 bg-white lg:sticky lg:top-[172px] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-204px)]">
             <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
               <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-4">Add from Library</h3>
               
               {!sheetsLoaded ? (
                 <Button onClick={loadSheets} variant="outline" className="w-full h-11 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors">
                   <Search className="w-4 h-4 mr-2" /> Load PDF Library
                 </Button>
               ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      type="text" 
                      placeholder="Search your sheets..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 h-10 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-shadow" 
                    />
                  </div>
               )}
             </div>

             {sheetsLoaded && (
                <div className="flex-1 overflow-y-auto p-2 min-h-0">
                  {filteredSheets.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full text-center p-8">
                       <p className="text-sm text-zinc-500">No matching pieces found.</p>
                     </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredSheets.map(sheet => (
                        <div key={sheet.$id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                           <div className="min-w-0 flex-1 pl-1">
                             <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{sheet.title}</div>
                             <div className="text-xs text-zinc-500">{sheet.pageCount} pages</div>
                           </div>
                           <Button onClick={() => handleAddItem(sheet)} size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shrink-0 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all">
                             <Plus className="w-4 h-4" />
                           </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
             )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
