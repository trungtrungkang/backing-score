"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { useTierGuard } from "@/hooks/useTierGuard";
import { Plus, Users, GraduationCap, ArrowRight, KeyRound, Loader2, X, Bell } from "lucide-react";
import { listMyClassrooms, createClassroom, listPendingMembers } from "@/lib/appwrite";
import type { ClassroomDocument } from "@/lib/appwrite/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { canCreate } from "@/lib/auth/roles";

export default function CohortManagerPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isAuthorized, loading: tierLoading } = useTierGuard("studio");
  
  const [classrooms, setClassrooms] = useState<ClassroomDocument[]>([]);
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!user || tierLoading || !isAuthorized) return;

    let cancelled = false;
    listMyClassrooms()
      .then((list) => {
        if (!cancelled) {
           setClassrooms(list);
           // Fetch pending request counts for each classroom 
           Promise.all(list.map(async cr => {
              try {
                const pendings = await listPendingMembers(cr.$id);
                return { id: cr.$id, count: pendings.length };
              } catch {
                return { id: cr.$id, count: 0 };
              }
           })).then(results => {
              if(!cancelled) {
                const map: Record<string, number> = {};
                results.forEach(r => map[r.id] = r.count);
                setPendingCounts(map);
              }
           });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
      
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, tierLoading, isAuthorized, router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !user) return;
    setIsCreating(true);
    try {
      const cls = await createClassroom({
        name: newName.trim(),
        description: newDesc.trim()
      });
      toast.success("Classroom Cohort Created!");
      setClassrooms(prev => [cls, ...prev]);
      setIsModalOpen(false);
      setNewName("");
      setNewDesc("");
    } catch {
      toast.error("Failed to create cohort.");
    } finally {
      setIsCreating(false);
    }
  };

  if (authLoading || loading || tierLoading || !isAuthorized) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-8">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-zinc-50 dark:bg-zinc-950/30 flex-1 py-12 px-6 lg:px-12 relative overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">Cohort Manager</h1>
            <p className="text-zinc-500">Manage your classroom cohorts, students, and generate invite tickets.</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)} className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-6 h-11 shadow-lg shadow-amber-500/20">
            <Plus className="w-5 h-5 mr-2" />
            New Cohort
          </Button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classrooms.length === 0 ? (
            <div className="col-span-full py-16 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
               <GraduationCap className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
               <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">No Active Cohorts</h3>
               <p className="text-zinc-500 max-w-sm mx-auto mb-6">You haven't initialized any classrooms or cohorts yet.</p>
               <Button onClick={() => setIsModalOpen(true)} variant="outline" className="font-semibold text-zinc-900 dark:text-white rounded-full bg-white dark:bg-zinc-900">
                  <Plus className="w-4 h-4 mr-2" /> Initialize Classroom
               </Button>
            </div>
          ) : (
            classrooms.map((cls) => (
              <div key={cls.$id} className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm hover:border-amber-500/50 hover:shadow-md transition-all flex flex-col group">
                 <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                       <Users className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    {cls.status === "active" 
                       ? <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full">Active</span>
                       : <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full">{cls.status}</span>
                    }
                 </div>
                 
                 <h3 className="font-bold text-xl text-zinc-900 dark:text-white mb-2">{cls.name}</h3>
                 <p className="text-sm text-zinc-500 line-clamp-2 mb-6 flex-1">{cls.description || "No description provided."}</p>
                 
                 <div className="flex items-center gap-2 mb-4">
                    <div className="bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 rounded-lg flex items-center gap-2 w-full text-sm border border-zinc-200 dark:border-zinc-800">
                       <KeyRound className="w-4 h-4 text-zinc-400" />
                       <span className="font-mono text-zinc-600 dark:text-zinc-300 font-bold uppercase tracking-widest">{cls.classCode}</span>
                    </div>
                 </div>

                 <Link href={`/dashboard/classrooms/${cls.$id}/manage`}>
                    <Button variant="secondary" className="w-full justify-between bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 mt-auto relative">
                       Manage Students & Tickets
                       
                       {pendingCounts[cls.$id] > 0 && (
                          <div className="absolute -top-3 -right-2 bg-amber-500 text-white text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full border border-amber-600 shadow-xl shadow-amber-500/20 animate-bounce flex items-center gap-1">
                             <Bell className="w-3 h-3 fill-white" />
                             {pendingCounts[cls.$id]} Requests
                          </div>
                       )}

                       <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                 </Link>
              </div>
            ))
          )}
        </div>

      </div>

      {/* Modal Overlay */}
      {isModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden shadow-black/50">
               <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Initialize Cohort</h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
               </div>
               <form onSubmit={handleCreate} className="p-6 flex flex-col gap-4">
                  <div>
                     <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Cohort Name</label>
                     <input 
                        required
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="E.g., Fall 2026 Masterclass"
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 font-medium text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                     />
                  </div>
                  <div>
                     <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Description (Optional)</label>
                     <textarea 
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        placeholder="Basic cohort details..."
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 font-medium text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all resize-none"
                     />
                  </div>
                  <div className="flex justify-end gap-3 mt-4">
                     <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                     <Button type="submit" disabled={isCreating || !newName.trim()} className="bg-amber-600 hover:bg-amber-500 text-white font-bold">
                        {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Build Roster
                     </Button>
                  </div>
               </form>
            </div>
         </div>
      )}
    </main>
  );
}
