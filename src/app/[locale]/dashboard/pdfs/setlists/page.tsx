"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "@/i18n/routing";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useDialogs } from "@/components/ui/dialog-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  listMySetlists,
  createSetlist,
  deleteSetlist,
  type SetlistDocument,
} from "@/lib/appwrite";
import {
  Plus,
  MoreVertical,
  Trash2,
  Pencil,
  Loader2,
  ListMusic,
  Play,
  PanelLeftOpen,
  X,
  ChevronRight,
} from "lucide-react";

export default function SetlistsLibraryPage() {
  const t = useTranslations("Pdfs");
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { confirm } = useDialogs();

  const [setlists, setSetlists] = useState<SetlistDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [newName, setNewName] = useState("");

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const result = await listMySetlists();
      setSetlists(result);
    } catch (err) {
      console.error("Failed to load setlists:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) loadData();
  }, [authLoading, user]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const doc = await createSetlist(newName.trim());
      setNewName("");
      setShowDialog(false);
      // Navigate straight to edit mode to add items
      router.push(`/dashboard/pdfs/setlist/${doc.$id}/edit`);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: "Delete Setlist", // TODO: translations
      description: `Are you sure you want to delete "${name}"?`,
    });
    if (!ok) return;
    try {
      await deleteSetlist(id);
      toast.success("Setlist deleted");
      loadData();
    } catch (err) {
      toast.error(String(err));
    }
  };

  if (!authLoading && !user) {
    router.push("/");
    return null;
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <DashboardSidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      <button
        className="md:hidden fixed bottom-20 left-4 z-40 bg-zinc-800 text-white p-3 rounded-full shadow-lg"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
      </button>

      <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-zinc-50 dark:bg-zinc-950">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
             <button
                onClick={() => router.push("/dashboard/pdfs")}
                className="text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {t("setlists") || "Setlists"}
            </h1>
          </div>
          <Button
            onClick={() => setShowDialog(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Setlist
          </Button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        )}

        {!loading && setlists.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ListMusic className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mb-4" />
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
              No Setlists
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm">
              Create a setlist to organize multiple PDF sheets for a live performance.
            </p>
            <Button onClick={() => setShowDialog(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create Setlist
            </Button>
          </div>
        )}

        {!loading && setlists.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {setlists.map((sl) => {
              const items = JSON.parse(sl.items || "[]");
              return (
                <div
                  key={sl.$id}
                  className="group bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/30 transition-all cursor-pointer overflow-hidden p-4"
                  onClick={() => router.push(`/dashboard/pdfs/setlist/${sl.$id}`)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                      <ListMusic className="w-5 h-5 text-indigo-500" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all flex-shrink-0"
                        >
                          <MoreVertical className="w-4 h-4 text-zinc-400" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/pdfs/setlist/${sl.$id}`);
                          }}
                          className="flex items-center gap-2 cursor-pointer font-bold text-indigo-500 focus:text-indigo-400"
                        >
                          <Play className="w-4 h-4" />
                          Perform
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/pdfs/setlist/${sl.$id}/edit`);
                          }}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                          Edit / Add Songs
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(sl.$id, sl.name);
                          }}
                          className="flex items-center gap-2 cursor-pointer text-red-500 focus:text-red-500 mt-2 border-t border-zinc-100 dark:border-zinc-800 pt-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <h3 className="font-bold text-zinc-900 dark:text-white mb-1 truncate">{sl.name}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{items.length} songs</p>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">New Setlist</h3>
              <input
                type="text"
                autoFocus
                placeholder="Name (e.g. Sunday Worship, Live Gig)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setShowDialog(false)}
                className="flex-1 py-3 text-sm font-medium text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="flex-1 py-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 disabled:opacity-50 border-l border-zinc-200 dark:border-zinc-800 inline-flex items-center justify-center"
              >
                {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
