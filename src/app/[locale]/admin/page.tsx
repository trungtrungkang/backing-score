"use client";

import { useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { listAllUsers, toggleUserLabel } from "@/app/actions/admin";
import { toast } from "sonner";
import { ShieldAlert, Loader2, Users, BookOpen, ChevronRight, ClipboardList, Sparkles, Star, CloudUpload } from "lucide-react";
import { canAccessAdmin } from "@/lib/auth/roles";

interface UserInfo {
  id: string;
  name: string;
  email: string;
  registration: string;
  labels: string[];
}

export default function AdminDashboardPage() {
  const { user, loading: authLoading, getJWT } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user || !canAccessAdmin(user.labels)) {
      router.push("/dashboard");
      return;
    }

    loadUsers();
  }, [user, authLoading, router]);

  async function loadUsers() {
    try {
      setLoading(true);
      setError(null);
      const jwt = await getJWT();
      const userList = await listAllUsers(jwt);
      setUsers(userList);
    } catch (err: any) {
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(userId: string, label: string, currentStatus: boolean) {
    try {
      const jwt = await getJWT();
      
      // Optimistic update
      setUsers((prev) => prev.map((u) => {
        if (u.id === userId) {
          const newLabels = currentStatus 
            ? u.labels.filter(l => l !== label)
            : [...u.labels, label];
          return { ...u, labels: newLabels };
        }
        return u;
      }));

      await toggleUserLabel(jwt, userId, label, !currentStatus);
    } catch (err: any) {
      toast.error("Failed to toggle label: " + err.message);
      loadUsers(); // Revert
    }
  }

  async function handleMigrateToR2() {
    if (!window.confirm("Bắt đầu di chuyển toàn bộ File từ Appwrite sang Cloudflare R2? Quá trình này có thể mất vài phút.")) return;
    try {
      setIsMigrating(true);
      const jwt = await getJWT();
      
      const res = await fetch("/api/r2/migrate", { 
        method: "POST",
        headers: {
          "Authorization": `Bearer ${jwt}`
        }
      });
      const data = ((await res.json()) as any) as any;
      if (!res.ok) throw new Error(data.error || "Migration failed");
      toast.success(`Đã migrate thành công ${data.successCount}/${data.total} files sang R2!`);
    } catch (err: any) {
      toast.error("Migration Error: " + err.message);
    } finally {
      setIsMigrating(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* Page Header */}
      <div className="flex items-center gap-4 mb-10">
        <div className="p-3 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-2xl shadow-inner">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-1">Admin Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Manage platform users, roles, and content.</p>
        </div>
      </div>

      {/* Quick-access cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-zinc-900 dark:text-white text-sm">User Management</h2>
            <p className="text-xs text-zinc-400">{users.length} registered users</p>
          </div>
        </div>

        <Link href="/admin/wiki" className="group bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 rounded-2xl p-5 flex items-center gap-4 hover:border-[#C8A856]/50 hover:shadow-lg hover:shadow-[#C8A856]/5 transition-all">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-zinc-900 dark:text-white text-sm group-hover:text-[#C8A856] transition-colors">Wiki CMS</h2>
            <p className="text-xs text-zinc-400">Manage encyclopedia content</p>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-zinc-600 group-hover:text-[#C8A856] transition-colors" />
        </Link>

        <Link href="/admin/review" className="group bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 rounded-2xl p-5 flex items-center gap-4 hover:border-emerald-400/50 hover:shadow-lg hover:shadow-emerald-400/5 transition-all">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
            <ClipboardList className="w-6 h-6 text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-zinc-900 dark:text-white text-sm group-hover:text-emerald-500 transition-colors">Review Queue</h2>
            <p className="text-xs text-zinc-400">Publish or reject imported drafts</p>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-zinc-600 group-hover:text-emerald-500 transition-colors" />
        </Link>

        <Link href="/admin/review" className="group bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 rounded-2xl p-5 flex items-center gap-4 hover:border-violet-400/50 hover:shadow-lg hover:shadow-violet-400/5 transition-all">
          <div className="w-12 h-12 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6 text-violet-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-zinc-900 dark:text-white text-sm group-hover:text-violet-500 transition-colors">AI Content</h2>
            <p className="text-xs text-zinc-400">Enrich projects with AI descriptions & tags</p>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-zinc-600 group-hover:text-violet-500 transition-colors" />
        </Link>

        <Link href="/admin/featured" className="group bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 rounded-2xl p-5 flex items-center gap-4 hover:border-amber-400/50 hover:shadow-lg hover:shadow-amber-400/5 transition-all">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
            <Star className="w-6 h-6 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-zinc-900 dark:text-white text-sm group-hover:text-amber-500 transition-colors">Featured Content</h2>
            <p className="text-xs text-zinc-400">Curate Discover page featured section</p>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-zinc-600 group-hover:text-amber-500 transition-colors" />
        </Link>

        {/* Cụm công cụ Migration hệ thống */}
        <button 
          onClick={handleMigrateToR2}
          disabled={isMigrating}
          className="group text-left bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-500/10 dark:to-zinc-900/60 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl p-5 flex items-center gap-4 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
            {isMigrating ? (
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            ) : (
              <CloudUpload className="w-6 h-6 text-indigo-500 group-hover:scale-110 transition-transform" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-indigo-900 dark:text-indigo-300 text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {isMigrating ? "Đang đồng bộ..." : "Migrate Media to R2"}
            </h2>
            <p className="text-xs text-indigo-500/70 dark:text-indigo-400/60 mt-0.5 leading-tight">Sync Appwrite Storage to Cloudflare R2 bucket</p>
          </div>
          <ChevronRight className="w-5 h-5 text-indigo-300 dark:text-indigo-600/50 group-hover:text-indigo-500 transition-colors" />
        </button>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* Users Table */}
      <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-blue-500" /> User Management
      </h2>
      <div className="bg-white dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-xl dark:shadow-black/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-50/80 dark:bg-zinc-950/80 border-b border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Name</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Email</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Joined</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-center">Creator Role</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-center">Content Mgr</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-center">Wiki Editor</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-center">Admin Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
              {users.map((u) => {
                const isCreator = u.labels.includes("creator");
                const isContentManager = u.labels.includes("contentmanager");
                const isWikiEditor = u.labels.includes("wikieditor");
                const isAdmin = u.labels.includes("admin");
                
                return (
                  <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-5 font-medium text-zinc-900 dark:text-zinc-200">{u.name || <span className="text-zinc-400 italic">Unnamed</span>}</td>
                    <td className="px-6 py-5 text-zinc-600 dark:text-zinc-400">{u.email}</td>
                    <td className="px-6 py-5 text-zinc-500 dark:text-zinc-500">
                      {new Date(u.registration).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <button
                        onClick={() => handleToggle(u.id, "creator", isCreator)}
                        className={`relative inline-flex items-center w-12 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-zinc-900 ${
                          isCreator ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-700"
                        }`}
                      >
                        <span className={`inline-block w-4 h-4 bg-white rounded-full transition-transform shadow ${
                          isCreator ? "translate-x-7" : "translate-x-1"
                        }`} />
                      </button>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <button
                        onClick={() => handleToggle(u.id, "contentmanager", isContentManager)}
                        className={`relative inline-flex items-center w-12 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 dark:focus:ring-offset-zinc-900 ${
                          isContentManager ? "bg-purple-500" : "bg-zinc-300 dark:bg-zinc-700"
                        }`}
                      >
                        <span className={`inline-block w-4 h-4 bg-white rounded-full transition-transform shadow ${
                          isContentManager ? "translate-x-7" : "translate-x-1"
                        }`} />
                      </button>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <button
                        onClick={() => handleToggle(u.id, "wikieditor", isWikiEditor)}
                        className={`relative inline-flex items-center w-12 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 dark:focus:ring-offset-zinc-900 ${
                          isWikiEditor ? "bg-amber-500" : "bg-zinc-300 dark:bg-zinc-700"
                        }`}
                      >
                        <span className={`inline-block w-4 h-4 bg-white rounded-full transition-transform shadow ${
                          isWikiEditor ? "translate-x-7" : "translate-x-1"
                        }`} />
                      </button>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <button
                        disabled={!user || user.$id === u.id} // Cannot toggle yourself
                        onClick={() => handleToggle(u.id, "admin", isAdmin)}
                        className={`relative inline-flex items-center w-12 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed ${
                          isAdmin ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"
                        }`}
                        title={user?.$id === u.id ? "Cannot revoke your own admin rights" : ""}
                      >
                        <span className={`inline-block w-4 h-4 bg-white rounded-full transition-transform shadow ${
                          isAdmin ? "translate-x-7" : "translate-x-1"
                        }`} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 dark:text-zinc-400">
                    No users found in the system.
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
