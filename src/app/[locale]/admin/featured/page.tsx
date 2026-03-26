"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessAdmin } from "@/lib/auth/roles";
import { listPublished, setFeatured, type ProjectDocument } from "@/lib/appwrite";
import { toast } from "sonner";
import { Star, Loader2, ArrowLeft, Music4, Search } from "lucide-react";
import { Link } from "@/i18n/routing";

export default function AdminFeaturedPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user || !canAccessAdmin(user.labels)) {
      router.push("/dashboard");
      return;
    }
    loadProjects();
  }, [user, authLoading, router]);

  async function loadProjects() {
    try {
      setLoading(true);
      const list = await listPublished();
      setProjects(list);
    } catch (err: any) {
      toast.error("Failed to load projects: " + (err?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleFeatured(project: ProjectDocument) {
    const newState = !project.featured;
    setTogglingId(project.$id);

    // Optimistic update
    setProjects(prev =>
      prev.map(p =>
        p.$id === project.$id
          ? { ...p, featured: newState, featuredAt: newState ? new Date().toISOString() : undefined }
          : p
      )
    );

    try {
      await setFeatured(project.$id, newState);
      toast.success(newState ? `⭐ "${project.name}" is now featured` : `Removed "${project.name}" from featured`);
    } catch (err: any) {
      // Revert
      setProjects(prev =>
        prev.map(p =>
          p.$id === project.$id ? { ...p, featured: project.featured, featuredAt: project.featuredAt } : p
        )
      );
      toast.error("Failed: " + (err?.message || "Unknown error"));
    } finally {
      setTogglingId(null);
    }
  }

  const featuredProjects = projects.filter(p => p.featured);
  const filteredProjects = projects.filter(p =>
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin"
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Featured Content</h1>
          <p className="text-sm text-zinc-500">
            Curate which scores appear in the Featured section on Discover. 
            <span className="font-semibold text-amber-600 dark:text-amber-400 ml-1">
              {featuredProjects.length} featured
            </span>
          </p>
        </div>
      </div>

      {/* Featured Preview */}
      {featuredProjects.length > 0 && (
        <div className="mb-10 p-5 bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-500/5 dark:to-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl">
          <h2 className="text-sm font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Star className="w-4 h-4" /> Currently Featured ({featuredProjects.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {featuredProjects.map(p => (
              <span key={p.$id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-500/30 rounded-full text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search published projects..."
          className="w-full h-10 pl-10 pr-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        />
      </div>

      {/* Projects List */}
      <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50/80 dark:bg-zinc-950/80 border-b border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3 font-semibold uppercase tracking-wider text-xs">Score</th>
                <th className="px-5 py-3 font-semibold uppercase tracking-wider text-xs text-center">Plays</th>
                <th className="px-5 py-3 font-semibold uppercase tracking-wider text-xs text-center">Favorites</th>
                <th className="px-5 py-3 font-semibold uppercase tracking-wider text-xs text-center">Featured</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
              {filteredProjects.map((p) => (
                <tr key={p.$id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                        {p.coverUrl ? (
                          <img src={p.coverUrl} alt="" className="w-full h-full object-cover rounded" />
                        ) : (
                          <Music4 className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-zinc-900 dark:text-white truncate">{p.name}</div>
                        <div className="text-xs text-zinc-400 truncate">{p.creatorEmail?.split("@")[0] || "Unknown"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center text-zinc-500 font-mono text-xs">
                    {(p.playCount ?? 0).toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-center text-zinc-500 font-mono text-xs">
                    {(p.favoriteCount ?? 0).toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button
                      onClick={() => handleToggleFeatured(p)}
                      disabled={togglingId === p.$id}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        p.featured
                          ? "bg-amber-100 dark:bg-amber-500/20 text-amber-500 hover:bg-amber-200 dark:hover:bg-amber-500/30"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                      }`}
                    >
                      <Star className={`w-5 h-5 transition-all ${p.featured ? "fill-amber-500" : ""}`} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredProjects.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-zinc-400">
                    No published projects found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
