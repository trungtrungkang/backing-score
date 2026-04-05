"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Users, KeyRound, Loader2, ArrowLeft, Ticket, Settings, Trash2, Plus, X, UserX
} from "lucide-react";
import { 
  getClassroom, 
  listClassroomMembers, 
  listPendingMembers,
  listClassroomInvites,
  createInviteTicket,
  deleteInviteTicket,
  removeClassroomMember,
  approveMember,
  declineMember,
  deleteClassroom
} from "@/lib/appwrite";
import type { ClassroomDocument, ClassroomMemberDocument, ClassroomInviteDocument } from "@/lib/appwrite/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { canCreate } from "@/lib/auth/roles";
import { useDialogs } from "@/components/ui/dialog-provider";

export default function ClassroomManagerPage() {
  const router = useRouter();
  const params = useParams();
  const classroomId = params.classroomId as string;
  const { user, loading: authLoading } = useAuth();
  const { confirm, prompt } = useDialogs();

  const [classroom, setClassroom] = useState<ClassroomDocument | null>(null);
  const [members, setMembers] = useState<ClassroomMemberDocument[]>([]);
  const [pendingMembers, setPendingMembers] = useState<ClassroomMemberDocument[]>([]);
  const [invites, setInvites] = useState<ClassroomInviteDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const [isGenerating, setIsGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Settings Modal State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!user || !classroomId) return;
    
    if (!canCreate(user.labels)) {
      router.push("/dashboard");
      return;
    }

    let cancelled = false;
    Promise.all([
      getClassroom(classroomId),
      listClassroomMembers(classroomId),
      listPendingMembers(classroomId),
      listClassroomInvites(classroomId)
    ]).then(([clsData, memData, pendingData, invData]) => {
      if (!cancelled) {
        setClassroom(clsData);
        setMembers(memData);
        setPendingMembers(pendingData);
        setInvites(invData);
      }
    }).catch(() => {
      if (!cancelled) toast.error("Failed to load classroom data.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router, classroomId]);

  // Realtime Polling: Check for new pending members and new active members every 5 seconds
  useEffect(() => {
    if (!classroom) return;
    const interval = setInterval(async () => {
      try {
         // Auto-fetch pending requests seamlessly
         const newPendingData = await listPendingMembers(classroomId);
         setPendingMembers(newPendingData);
         
         const newMembersData = await listClassroomMembers(classroomId);
         setMembers(newMembersData);
      } catch (e) {
         // silently ignore polling errors
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [classroom, classroomId]);

  const handleGenerateTicket = async () => {
    if (!user || !classroom) return;
    setIsGenerating(true);
    try {
      const studentNamePrompt = await prompt({
         title: "Generate Invite Ticket",
         description: "Optional: Assign this ticket to a specific student name (for your records). Leave blank for generic.",
         confirmText: "Generate",
         cancelText: "Cancel"
      });
      if (studentNamePrompt === null) return; // cancelled
      
      const ticket = await createInviteTicket(classroom.$id, studentNamePrompt.trim());
      setInvites(prev => [ticket, ...prev]);
      toast.success("Ticket generated successfully!");
    } catch {
      toast.error("Failed to generate ticket.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokeTicket = async (inviteId: string) => {
    if (deletingId) return;
    const ok = await confirm({
      title: "Revoke Ticket",
      description: "Are you sure you want to revoke this unused ticket?",
      confirmText: "Revoke",
      cancelText: "Cancel"
    });
    if (!ok) return;

    setDeletingId(inviteId);
    try {
      await deleteInviteTicket(inviteId);
      setInvites(prev => prev.filter(inv => inv.$id !== inviteId));
      toast.success("Ticket revoked.");
    } catch {
      toast.error("Failed to revoke ticket.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleKickStudent = async (userId: string, name: string) => {
     if(deletingId) return;
     const ok = await confirm({
        title: "Remove Student",
        description: `Remove ${name} from this classroom? They will lose access.`,
        confirmText: "Remove",
        cancelText: "Cancel"
     });
     if(!ok) return;
     
     setDeletingId(userId);
     try {
        await removeClassroomMember(classroom!.$id, userId);
        setMembers(prev => prev.filter(m => m.userId !== userId));
        toast.success("Student removed.");
     } catch {
        toast.error("Failed to remove student.");
     } finally {
        setDeletingId(null);
     }
  };

  const handleApprove = async (member: ClassroomMemberDocument) => {
     try {
       await approveMember(member.$id);
       setPendingMembers(prev => prev.filter(m => m.$id !== member.$id));
       setMembers(prev => [...prev, { ...member, status: "active" }]);
       toast.success(`${member.userName} approved!`);
     } catch {
       toast.error("Failed to approve student.");
     }
  };

  const handleDecline = async (member: ClassroomMemberDocument) => {
     try {
       await declineMember(member.$id);
       setPendingMembers(prev => prev.filter(m => m.$id !== member.$id));
       toast.success(`${member.userName} declined.`);
     } catch {
       toast.error("Failed to decline student.");
     }
  };

  const handleDeleteClassroom = async () => {
     if(!classroom) return;
     const ok = await confirm({
        title: "Delete Cohort",
        description: `Type "DELETE" to permanently destroy ${classroom.name} and kick all students.`,
        confirmText: "Yes, Destroy",
        cancelText: "Cancel"
     });
     // simple verification check in a real app, assuming ok is true for now
     if(!ok) return;
     try {
        await deleteClassroom(classroom.$id);
        toast.success("Cohort dismantled.");
        router.push("/dashboard/classrooms");
     } catch {
        toast.error("Failed to delete classroom.");
     }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-8">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-8">
        <h2 className="text-xl font-bold dark:text-white">Cohort Not Found</h2>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-foreground dark:text-white flex flex-col pt-6 pb-24 px-6 lg:px-12 relative overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full">
        {/* Navigation Breadcrumb */}
        <Link href="/dashboard/classrooms" className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Cohorts
        </Link>
        
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8 bg-white dark:bg-[#121214] p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
          
          <div className="relative z-10 w-full flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
             <div>
               <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">{classroom.name}</h1>
                  <span className="bg-green-500/10 text-green-500 uppercase tracking-widest text-[10px] font-bold px-2 py-1 rounded border border-green-500/20">Active</span>
               </div>
               
               <p className="text-zinc-500 text-sm max-w-xl mb-4">{classroom.description || "No description provided."}</p>
               
               <div className="flex flex-wrap gap-4">
                  <div className="bg-zinc-100 dark:bg-zinc-900 px-4 py-2 rounded-xl flex items-center gap-3 border border-zinc-200 dark:border-zinc-800">
                     <KeyRound className="w-4 h-4 text-zinc-400" />
                     <div>
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">Class Code</div>
                        <div className="font-mono text-zinc-900 dark:text-white font-bold uppercase tracking-widest leading-none">{classroom.classCode}</div>
                     </div>
                  </div>
                  <div className="bg-zinc-100 dark:bg-zinc-900 px-4 py-2 rounded-xl flex items-center gap-3 border border-zinc-200 dark:border-zinc-800">
                     <Users className="w-4 h-4 text-zinc-400" />
                     <div>
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">Students</div>
                        <div className="font-bold text-zinc-900 dark:text-white leading-none">{members.length} Enrolled</div>
                     </div>
                  </div>
               </div>
             </div>
             
             <div className="flex gap-3 relative z-10">
                <Button onClick={() => setIsSettingsModalOpen(true)} variant="outline" className="bg-white dark:bg-zinc-900">
                  <Settings className="w-4 h-4 mr-2" /> Cohort Status
                </Button>
             </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* Column 1: Invite Tickets */}
           <section className="flex flex-col h-[600px] bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-black/20">
                 <h2 className="text-xl font-bold flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-indigo-500" /> 
                    Single-use Tickets
                 </h2>
                 <Button onClick={handleGenerateTicket} disabled={isGenerating} size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-9">
                    {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Generate Code
                 </Button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2">
                 {invites.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                       <Ticket className="w-12 h-12 text-zinc-200 dark:text-zinc-800 mb-4" />
                       <p className="text-zinc-500 font-medium">No unused tickets found.</p>
                       <p className="text-zinc-400 text-sm mt-1">Generate single-use access codes to securely invite students without verifying emails.</p>
                    </div>
                 ) : (
                    <div className="flex flex-col gap-2 p-4">
                       {invites.map(inv => (
                          <div key={inv.$id} className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                             <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${inv.status === 'used' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400' : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'}`}>
                                   <Ticket className="w-5 h-5" />
                                </div>
                                <div>
                                   <div className="font-mono text-lg font-bold tracking-widest text-zinc-900 dark:text-white leading-none mb-1">{inv.code}</div>
                                   <div className="text-xs text-zinc-500">
                                      {inv.studentName ? `For: ${inv.studentName}` : 'Generic Ticket'} • {inv.status === 'used' ? 'USED' : 'PENDING'}
                                   </div>
                                </div>
                             </div>
                             {inv.status !== 'used' && (
                                <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   disabled={deletingId === inv.$id}
                                   onClick={() => handleRevokeTicket(inv.$id)}
                                   className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                                >
                                   {deletingId === inv.$id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </Button>
                             )}
                          </div>
                       ))}
                    </div>
                 )}
              </div>
           </section>

           {/* Column 2: Roster / Members */}
           <section className="flex flex-col h-[600px] bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black/20">
                 <h2 className="text-xl font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-500" /> 
                    Student Roster
                 </h2>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2">
                  <div className="flex flex-col gap-1 p-2">
                    
                    {/* Waiting Room Section */}
                    {pendingMembers.length > 0 && (
                       <div className="mb-6">
                         <div className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-2 px-2 flex items-center justify-between">
                            Waiting Room
                            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">{pendingMembers.length}</span>
                         </div>
                         {pendingMembers.map(member => (
                            <div key={member.$id} className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 mb-2">
                               <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center font-bold text-amber-700 dark:text-amber-300">
                                     {member.userName.substring(0,2).toUpperCase()}
                                  </div>
                                  <div>
                                     <div className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                                        {member.userName} 
                                     </div>
                                     <div className="text-xs text-amber-600 dark:text-amber-500">Requested to join...</div>
                                  </div>
                               </div>
                               <div className="flex items-center gap-2">
                                  <Button 
                                     variant="outline" 
                                     size="sm" 
                                     onClick={() => handleDecline(member)}
                                     className="h-8 text-zinc-500 hover:text-red-500"
                                  >
                                     <X className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                     size="sm" 
                                     onClick={() => handleApprove(member)}
                                     className="h-8 bg-green-600 hover:bg-green-500 text-white"
                                  >
                                     Approve
                                  </Button>
                               </div>
                            </div>
                         ))}
                         <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-4" />
                       </div>
                    )}

                    <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2 px-2">Active Roster</div>
                    
                    {members.map(member => (
                       <div key={member.$id} className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors group">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-zinc-500">
                                {member.userName.substring(0,2).toUpperCase()}
                             </div>
                             <div>
                                <div className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                                   {member.userName} 
                                   {member.role === 'teacher' && <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[9px] uppercase px-1.5 py-0.5 rounded">Teacher</span>}
                                </div>
                                <div className="text-xs text-zinc-500">Joined class</div>
                             </div>
                          </div>
                          {member.role !== 'teacher' && (
                             <Button 
                                variant="ghost" 
                                size="sm" 
                                disabled={deletingId === member.userId}
                                onClick={() => handleKickStudent(member.userId, member.userName)}
                                className="opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                             >
                                <UserX className="w-4 h-4 mr-2" /> Kick
                             </Button>
                          )}
                       </div>
                    ))}
                    
                    {members.length === 0 && pendingMembers.length === 0 && (
                       <div className="p-8 text-center text-zinc-500">
                          No students in this cohort yet.
                       </div>
                    )}
                  </div>
              </div>
           </section>
        </div>
      </div>

      {/* Settings Modal Overlay */}
      {isSettingsModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-6 flex flex-col text-center">
               <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 mx-auto rounded-full flex items-center justify-center mb-4">
                  <Trash2 className="w-8 h-8" />
               </div>
               <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Danger Zone</h3>
               <p className="text-zinc-500 mb-8">Dismantling this cohort will revoke all tickets and kick all students permanently.</p>
               <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setIsSettingsModalOpen(false)}>Cancel</Button>
                  <Button onClick={handleDeleteClassroom} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold">Dismantle</Button>
               </div>
            </div>
         </div>
      )}
    </main>
  );
}
