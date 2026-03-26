"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { listMyProjects, ProjectDocument } from "@/lib/appwrite";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { BarChart3, TrendingUp, Music4, Trophy, Menu, X } from "lucide-react";

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
    if (!user) return;
    listMyProjects([])
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  const stats = useMemo(() => {
    if (!projects.length) return null;
    const totalPlays = projects.reduce((s, p) => s + ((p as any).playCount || 0), 0);
    const published = projects.filter(p => p.published).length;
    const sorted = [...projects].sort((a, b) => ((b as any).playCount || 0) - ((a as any).playCount || 0));
    const topTracks = sorted.slice(0, 5);
    // Simulate plays distribution for chart (using playCount per project)
    const maxPlays = Math.max(...projects.map(p => (p as any).playCount || 0), 1);
    return { totalPlays, published, topTracks, maxPlays, total: projects.length };
  }, [projects]);

  if (authLoading || !user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-zinc-800 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black text-foreground dark:text-white flex">
      <DashboardSidebar />

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-900 shadow-2xl">
            <div className="p-4 flex justify-end">
              <button onClick={() => setMobileMenuOpen(false)}><X className="w-5 h-5 text-zinc-500" /></button>
            </div>
            <DashboardSidebar />
          </div>
        </div>
      )}

      <main className="flex-1 min-h-0 overflow-y-auto py-12 px-6 lg:px-12 bg-white dark:bg-zinc-950/30">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => setMobileMenuOpen(true)} className="md:hidden mb-4 flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
            <Menu className="w-5 h-5" /> <span className="text-sm font-medium">Menu</span>
          </button>

          <header className="mb-12">
            <h1 className="text-4xl font-black tracking-tight mb-2">Creator Analytics</h1>
            <p className="text-zinc-400">Track your performance and audience engagement.</p>
          </header>

          {loading ? (
            <div className="flex items-center justify-center py-32">
              <div className="w-10 h-10 border-4 border-zinc-200 dark:border-zinc-800 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : !stats ? (
            <div className="text-center py-32 text-zinc-500">
              <BarChart3 className="w-16 h-16 mx-auto mb-4 text-zinc-300 dark:text-zinc-700" />
              <p className="font-bold text-lg">No data yet</p>
              <p>Upload your first piece to start tracking analytics.</p>
            </div>
          ) : (
            <>
              {/* Overview Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                {[
                  { label: "Total Pieces", value: stats.total, icon: Music4, color: "blue" },
                  { label: "Published", value: stats.published, icon: TrendingUp, color: "green" },
                  { label: "Total Plays", value: stats.totalPlays, icon: BarChart3, color: "purple" },
                  { label: "Avg Plays", value: stats.total ? Math.round(stats.totalPlays / stats.total) : 0, icon: Trophy, color: "amber" },
                ].map((card) => (
                  <div key={card.label} className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex flex-col gap-2">
                    <div className={`w-9 h-9 rounded-lg bg-${card.color}-50 dark:bg-${card.color}-500/10 flex items-center justify-center`}>
                      <card.icon className={`w-4 h-4 text-${card.color}-500`} />
                    </div>
                    <div className="text-2xl font-black">{card.value}</div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{card.label}</div>
                  </div>
                ))}
              </div>

              {/* Plays Distribution Bar Chart */}
              <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-10">
                <h2 className="text-lg font-bold mb-6">Plays by Piece</h2>
                <div className="flex flex-col gap-3">
                  {projects
                    .filter(p => (p as any).playCount > 0)
                    .sort((a, b) => ((b as any).playCount || 0) - ((a as any).playCount || 0))
                    .slice(0, 10)
                    .map(p => (
                    <div key={p.$id} className="flex items-center gap-3">
                      <div className="w-32 text-sm font-medium truncate text-zinc-700 dark:text-zinc-300 shrink-0">
                        {p.name}
                      </div>
                      <div className="flex-1 h-8 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg transition-all duration-700"
                          style={{ width: `${Math.max(((p as any).playCount || 0) / stats.maxPlays * 100, 2)}%` }}
                        />
                      </div>
                      <div className="w-12 text-right text-sm font-bold text-zinc-900 dark:text-white shrink-0">
                        {(p as any).playCount || 0}
                      </div>
                    </div>
                  ))}
                  {projects.every(p => !((p as any).playCount > 0)) && (
                    <p className="text-zinc-500 text-center py-8">No plays recorded yet.</p>
                  )}
                </div>
              </div>

              {/* Top 5 Tracks */}
              <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" /> Top Tracks
                </h2>
                <div className="flex flex-col">
                  {stats.topTracks.map((p, i) => (
                    <div key={p.$id} className="flex items-center gap-4 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
                        i === 0 ? "bg-amber-100 dark:bg-amber-500/20 text-amber-600" :
                        i === 1 ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300" :
                        i === 2 ? "bg-orange-100 dark:bg-orange-500/20 text-orange-600" :
                        "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{p.name}</div>
                        <div className="text-xs text-zinc-500">{p.published ? "Published" : "Draft"}</div>
                      </div>
                      <div className="text-lg font-black text-zinc-900 dark:text-white">
                        {(p as any).playCount || 0}
                        <span className="text-xs text-zinc-500 ml-1">plays</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
