"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import {
  GraduationCap,
  ArrowLeft,
  Users,
  ClipboardList,
  Settings,
  Plus,
  Copy,
  Check,
  Trash2,
  Clock,
  Target,
  Loader2,
  UserMinus,
  Music4,
} from "lucide-react";
import {
  getClassroom,
  listClassroomMembers,
  listAssignments,
  isClassroomMember,
  deleteClassroom,
  removeClassroomMember,
  ClassroomDocument,
  ClassroomMemberDocument,
  AssignmentDocument,
} from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { useDialogs } from "@/components/ui/dialog-provider";
import { toast } from "sonner";

type Tab = "assignments" | "members" | "settings";

export default function ClassroomDetailPage() {
  const params = useParams();
  const classroomId = params.id as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { confirm } = useDialogs();

  const [classroom, setClassroom] = useState<ClassroomDocument | null>(null);
  const [members, setMembers] = useState<ClassroomMemberDocument[]>([]);
  const [assignments, setAssignments] = useState<AssignmentDocument[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("assignments");
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | undefined>();
  const [codeCopied, setCodeCopied] = useState(false);

  const isTeacher = userRole === "teacher";

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!user || !classroomId) return;

    let cancelled = false;
    setLoading(true);

    Promise.all([
      getClassroom(classroomId),
      isClassroomMember(classroomId),
      listClassroomMembers(classroomId),
      listAssignments(classroomId),
    ])
      .then(([cr, membership, mems, assigns]) => {
        if (cancelled) return;
        if (!membership.isMember) {
          toast.error("You are not a member of this classroom");
          router.push("/classroom");
          return;
        }
        setClassroom(cr);
        setUserRole(membership.role);
        setMembers(mems);
        setAssignments(assigns);
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Failed to load classroom");
          router.push("/classroom");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user, authLoading, classroomId, router]);

  const handleCopyCode = async () => {
    if (!classroom) return;
    await navigator.clipboard.writeText(classroom.classCode);
    setCodeCopied(true);
    toast.success("Class code copied!");
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleDeleteClassroom = async () => {
    if (!classroom) return;
    const ok = await confirm({
      title: "Delete Classroom",
      description: `Permanently delete "${classroom.name}"? All assignments and data will be lost.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    });
    if (!ok) return;

    try {
      await deleteClassroom(classroomId);
      toast.success("Classroom deleted");
      router.push("/classroom");
    } catch {
      toast.error("Failed to delete classroom");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    const ok = await confirm({
      title: "Remove Student",
      description: "Remove this student from the classroom?",
      confirmText: "Remove",
      cancelText: "Cancel",
    });
    if (!ok) return;
    try {
      await removeClassroomMember(classroomId, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      toast.success("Student removed");
    } catch {
      toast.error("Failed to remove student");
    }
  };

  if (authLoading || !user || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (!classroom) return null;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "assignments", label: "Assignments", icon: <ClipboardList className="w-4 h-4" /> },
    { key: "members", label: `Members (${members.length})`, icon: <Users className="w-4 h-4" /> },
    ...(isTeacher ? [{ key: "settings" as Tab, label: "Settings", icon: <Settings className="w-4 h-4" /> }] : []),
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black text-foreground dark:text-white">
      <div className="max-w-4xl mx-auto py-8 px-6">
        {/* Back */}
        <Link href="/classroom" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> All Classrooms
        </Link>

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 mb-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-black mb-1">{classroom.name}</h1>
              {classroom.description && (
                <p className="text-white/70 text-sm mb-3">{classroom.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-white/60">
                {classroom.instrumentFocus && (
                  <span className="flex items-center gap-1">
                    <Music4 className="w-3.5 h-3.5" /> {classroom.instrumentFocus}
                  </span>
                )}
                {classroom.level && <span className="capitalize">{classroom.level}</span>}
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> {members.length} members
                </span>
              </div>
            </div>

            {/* Class Code */}
            <button
              onClick={handleCopyCode}
              className="group bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 text-center transition-all"
            >
              <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Class Code</div>
              <div className="text-xl font-mono font-black tracking-[0.2em] flex items-center gap-2">
                {classroom.classCode}
                {codeCopied ? (
                  <Check className="w-4 h-4 text-green-300" />
                ) : (
                  <Copy className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-zinc-200 dark:border-zinc-800">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? "border-indigo-500 text-indigo-500"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "assignments" && (
          <div>
            {isTeacher && (
              <div className="mb-4 flex justify-end">
                <Button
                  onClick={() => router.push(`/classroom/${classroomId}/assign`)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  <Plus className="w-4 h-4 mr-2" /> Create Assignment
                </Button>
              </div>
            )}

            {assignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-800 rounded-xl text-center">
                <ClipboardList className="w-10 h-10 text-zinc-700 mb-4" />
                <p className="text-zinc-500 font-medium">No assignments yet</p>
                {isTeacher && (
                  <p className="text-zinc-600 text-sm mt-1">Click &quot;Create Assignment&quot; to get started</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {assignments.map((a) => (
                  <Link
                    key={a.$id}
                    href={`/classroom/${classroomId}/assignment/${a.$id}`}
                    className="group flex items-center gap-4 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 hover:border-indigo-500/50 transition-all"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      a.type === "assessment"
                        ? "bg-amber-500/10 text-amber-500"
                        : a.type === "performance"
                        ? "bg-red-500/10 text-red-500"
                        : "bg-blue-500/10 text-blue-500"
                    }`}>
                      <Target className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-zinc-900 dark:text-white group-hover:text-indigo-400 transition-colors truncate">
                        {a.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                        <span className={`uppercase font-bold tracking-wider ${
                          a.type === "assessment" ? "text-amber-500" : a.type === "performance" ? "text-red-500" : "text-blue-500"
                        }`}>
                          {a.type}
                        </span>
                        {a.deadline && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Due: {new Date(a.deadline).toLocaleDateString()}
                          </span>
                        )}
                        {a.waitModeRequired && (
                          <span className="text-amber-400 font-medium">Wait Mode</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "members" && (
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.$id}
                className="flex items-center justify-between bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500">
                    {m.userId.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-white">
                      {m.userId}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">
                      {m.role}
                    </div>
                  </div>
                </div>

                {isTeacher && m.role === "student" && (
                  <button
                    onClick={() => handleRemoveMember(m.userId)}
                    className="text-zinc-400 hover:text-red-400 transition-colors"
                    title="Remove student"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === "settings" && isTeacher && (
          <div className="space-y-6">
            {/* Class Code */}
            <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
              <h3 className="font-bold text-zinc-900 dark:text-white mb-2">Invite Students</h3>
              <p className="text-sm text-zinc-400 mb-4">
                Share this code with your students so they can join the classroom.
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-12 bg-zinc-50 dark:bg-zinc-800 rounded-lg flex items-center justify-center font-mono text-2xl font-black tracking-[0.3em] text-indigo-500">
                  {classroom.classCode}
                </div>
                <Button onClick={handleCopyCode} variant="outline" className="h-12 px-5">
                  {codeCopied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                </Button>
              </div>
              <p className="text-xs text-zinc-500 mt-3">
                Or share this link: <span className="text-indigo-400 font-mono">{typeof window !== "undefined" ? `${window.location.origin}/classroom/join/${classroom.classCode}` : ""}</span>
              </p>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
              <h3 className="font-bold text-red-400 mb-2">Danger Zone</h3>
              <p className="text-sm text-zinc-400 mb-4">
                Deleting this classroom will remove all assignments and member data permanently.
              </p>
              <Button
                onClick={handleDeleteClassroom}
                variant="outline"
                className="border-red-500/30 text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete Classroom
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
