"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "@/i18n/routing";
import { getPlaylist, updatePlaylist, PlaylistDocument } from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Loader2, Globe, Lock } from "lucide-react";

export default function CollectionSettingsPage() {
  const params = useParams();
  const playlistId = params.playlistId as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [playlist, setPlaylist] = useState<PlaylistDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchPlaylist() {
      try {
        const pl = await getPlaylist(playlistId);
        if (!cancelled) {
          // Verify ownership
          if (!user || user.$id !== pl.ownerId) {
            setError("You do not have permission to edit this collection.");
            setLoading(false);
            return;
          }
          setPlaylist(pl);
          setName(pl.name);
          setDescription(pl.description || "");
          setIsPublished(pl.isPublished);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Failed to load collection. It may not exist.");
          setLoading(false);
        }
      }
    }

    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else {
        fetchPlaylist();
      }
    }

    return () => {
      cancelled = true;
    };
  }, [playlistId, user, authLoading, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setSaving(true);
    setError(null);
    try {
      await updatePlaylist(playlistId, {
        name: name.trim(),
        description: description.trim(),
        isPublished,
      });
      router.push(`/collection/${playlistId}`);
    } catch (err: any) {
      setError(err?.message || "Failed to save collection settings.");
      setSaving(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#C8A856]" />
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-red-500/20 rounded-2xl p-8 text-center shadow-lg">
           <h1 className="text-xl font-bold text-red-500 mb-2">Access Denied</h1>
           <p className="text-zinc-500 mb-6">{error}</p>
           <Button onClick={() => router.push("/dashboard/collections")} variant="outline" className="rounded-full">
             Back to Collections
           </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-900 dark:text-white py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link href={`/dashboard/collections`} className="inline-flex items-center text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors mb-4">
             <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-black tracking-tight">Collection Settings</h1>
          <p className="text-zinc-500 mt-1">Update metadata, visibility, and privacy controls for your playlist.</p>
        </div>

        <form onSubmit={handleSave} className="bg-white dark:bg-[#151518] border border-zinc-200 dark:border-white/5 rounded-2xl p-6 sm:p-10 shadow-sm space-y-8">
          
          <div className="space-y-4">
             <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Collection Name</label>
                <Input 
                   value={name}
                   onChange={e => setName(e.target.value)}
                   className="h-12 bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-white/10 rounded-xl focus-visible:ring-[#C8A856]/50"
                   placeholder="e.g. My Favorite Jazz Covers"
                   required
                />
             </div>

             <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Description <span className="text-zinc-400 font-normal">(optional)</span></label>
                <Textarea 
                   value={description}
                   onChange={e => setDescription(e.target.value)}
                   className="min-h-[120px] bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-white/10 rounded-xl focus-visible:ring-[#C8A856]/50 resize-none"
                   placeholder="Describe what vibe or audience this collection is tailored for."
                />
             </div>
          </div>

          <div className="pt-6 border-t border-zinc-200 dark:border-white/5">
             <h3 className="text-lg font-bold mb-4">Privacy & Visibility</h3>
             
             <div className="flex flex-col gap-4">
                <label className={`relative flex items-start gap-4 p-4 border rounded-xl cursor-pointer transition-colors ${
                  !isPublished 
                  ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/50" 
                  : "bg-white dark:bg-transparent border-zinc-200 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-white/5"
                }`}>
                   <div className="flex items-center h-6">
                     <input 
                        type="radio" 
                        name="visibility" 
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-600"
                        checked={!isPublished}
                        onChange={() => setIsPublished(false)}
                     />
                   </div>
                   <div className="flex-1">
                      <div className="flex items-center gap-2 font-bold mb-1">
                         <Lock className={`w-4 h-4 ${!isPublished ? "text-blue-500" : "text-zinc-400"}`} /> Private
                      </div>
                      <p className="text-sm text-zinc-500">Only you can see and edit this collection. It won't appear on your profile.</p>
                   </div>
                </label>

                <label className={`relative flex items-start gap-4 p-4 border rounded-xl cursor-pointer transition-colors ${
                  isPublished 
                  ? "bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-900/50" 
                  : "bg-white dark:bg-transparent border-zinc-200 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-white/5"
                }`}>
                   <div className="flex items-center h-6">
                     <input 
                        type="radio" 
                        name="visibility" 
                        className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-600"
                        checked={isPublished}
                        onChange={() => setIsPublished(true)}
                     />
                   </div>
                   <div className="flex-1">
                      <div className="flex items-center gap-2 font-bold mb-1">
                         <Globe className={`w-4 h-4 ${isPublished ? "text-green-500" : "text-zinc-400"}`} /> Public
                      </div>
                      <p className="text-sm text-zinc-500">Anyone can view this collection. It will be showcased on your public profile.</p>
                   </div>
                </label>
             </div>
          </div>

          {error && (
             <div className="p-4 rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium">
                {error}
             </div>
          )}

          <div className="pt-6 border-t border-zinc-200 dark:border-white/5 flex items-center justify-end gap-3">
             <Button type="button" variant="ghost" onClick={() => router.push(`/collection/${playlistId}`)} className="rounded-full font-semibold">
                Cancel
             </Button>
             <Button type="submit" disabled={saving || !name.trim()} className="rounded-full font-bold px-8 bg-[#C8A856] text-black hover:bg-[#d4b566] transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
             </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
