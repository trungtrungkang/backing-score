"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
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
  BarChart3,
  Save,
  BookOpen,
} from "lucide-react";
import {
  getClassroom,
  listClassroomMembers,
  listAssignments,
  listSubmissions,
  isClassroomMember,
  deleteClassroom,
  updateClassroom,
  removeClassroomMember,
  ClassroomDocument,
  ClassroomMemberDocument,
  AssignmentDocument,
  SubmissionDocument,
} from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { useDialogs } from "@/components/ui/dialog-provider";
import { toast } from "sonner";

type Tab = "assignments" | "members" | "settings" | "progress";

export default function ClassroomDetailPage() {
  const params = useParams();
  const classroomId = params.id as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { confirm } = useDialogs();
  const t = useTranslations("Classroom");

  const [classroom, setClassroom] = useState<ClassroomDocument | null>(null);
  const [members, setMembers] = useState<ClassroomMemberDocument[]>([]);
  const [assignments, setAssignments] = useState<AssignmentDocument[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("assignments");
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | undefined>();
  const [codeCopied, setCodeCopied] = useState(false);
  // Settings form
  const [settingsName, setSettingsName] = useState("");
  const [settingsDesc, setSettingsDesc] = useState("");
  const [settingsInstrument, setSettingsInstrument] = useState("");
  const [settingsLevel, setSettingsLevel] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  // Progress data
  const [progressData, setProgressData] = useState<Map<string, SubmissionDocument[]>>(new Map());
  const [progressLoaded, setProgressLoaded] = useState(false);

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
          toast.error(t("notMember"));
          router.push("/classroom");
          return;
        }
        setClassroom(cr);
        setUserRole(membership.role);
        setMembers(mems);
        setAssignments(assigns);
        // Init settings form
        setSettingsName(cr.name);
        setSettingsDesc(cr.description || "");
        setSettingsInstrument(cr.instrumentFocus || "");
        setSettingsLevel(cr.level || "");
      })
      .catch(() => {
        if (!cancelled) {
          toast.error(t("failedLoad"));
          router.push("/classroom");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user, authLoading, classroomId, router, t]);

  const handleCopyCode = async () => {
    if (!classroom) return;
    await navigator.clipboard.writeText(classroom.classCode);
    setCodeCopied(true);
    toast.success(t("codeCopied"));
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleDeleteClassroom = async () => {
    if (!classroom) return;
    const ok = await confirm({
      title: t("deleteConfirmTitle"),
      description: t("deleteConfirmDesc", { name: classroom.name }),
      confirmText: t("deleteConfirm"),
      cancelText: t("deleteCancel"),
    });
    if (!ok) return;

    try {
      await deleteClassroom(classroomId);
      toast.success(t("classroomDeleted"));
      router.push("/classroom");
    } catch {
      toast.error(t("failedDelete"));
    }
  };

  // Load progress data when progress tab is activated
  useEffect(() => {
    if (activeTab !== "progress" || progressLoaded || !assignments.length) return;
    Promise.all(assignments.map(a => listSubmissions(a.$id)))
      .then(results => {
        const map = new Map<string, SubmissionDocument[]>();
        assignments.forEach((a, i) => map.set(a.$id, results[i]));
        setProgressData(map);
        setProgressLoaded(true);
      })
      .catch(() => setProgressLoaded(true));
  }, [activeTab, progressLoaded, assignments]);

  const handleSaveSettings = async () => {
    if (!classroom || savingSettings) return;
    setSavingSettings(true);
    try {
      const updated = await updateClassroom(classroomId, {
        name: settingsName.trim(),
        description: settingsDesc.trim(),
        instrumentFocus: settingsInstrument.trim(),
        level: settingsLevel.trim(),
      });
      setClassroom(updated);
      toast.success(t("settingsSaved"));
    } catch {
      toast.error(t("failedSaveSettings"));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    const ok = await confirm({
      title: t("removeStudent"),
      description: t("removeConfirmDesc"),
      confirmText: t("removeConfirm"),
      cancelText: t("removeCancel"),
    });
    if (!ok) return;
    try {
      await removeClassroomMember(classroomId, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      toast.success(t("studentRemoved"));
    } catch {
      toast.error(t("failedRemove"));
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
    { key: "assignments", label: t("assignments"), icon: <ClipboardList className="w-4 h-4" /> },
    { key: "members", label: t("membersCount", { count: members.length }), icon: <Users className="w-4 h-4" /> },
    ...(isTeacher ? [
      { key: "progress" as Tab, label: t("progress"), icon: <BarChart3 className="w-4 h-4" /> },
      { key: "settings" as Tab, label: t("settings"), icon: <Settings className="w-4 h-4" /> },
    ] : []),
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black text-foreground dark:text-white">
      <div className="max-w-4xl mx-auto py-8 px-6">
        <Link href="/classroom" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> {t("allClassrooms")}
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
                  <Users className="w-3.5 h-3.5" /> {members.length} {t("members").toLowerCase()}
                </span>
              </div>
            </div>

            <button
              onClick={handleCopyCode}
              className="group bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 text-center transition-all"
            >
              <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1">{t("classCode")}</div>
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
                  <Plus className="w-4 h-4 mr-2" /> {t("createAssignment")}
                </Button>
              </div>
            )}

            {assignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-800 rounded-xl text-center">
                <ClipboardList className="w-10 h-10 text-zinc-700 mb-4" />
                <p className="text-zinc-500 font-medium">{t("noAssignments")}</p>
                {isTeacher && (
                  <p className="text-zinc-600 text-sm mt-1">{t("noAssignmentsHint")}</p>
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
                            {t("due")} {new Date(a.deadline).toLocaleDateString()}
                          </span>
                        )}
                        {a.waitModeRequired && (
                          <span className="text-amber-400 font-medium">{t("waitMode")}</span>
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
                    {(m.userName || m.userId).slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-white">
                      {m.userName || m.userId}
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
                    title={t("removeStudent")}
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
            {/* Edit Classroom Form */}
            <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
              <h3 className="font-bold text-zinc-900 dark:text-white mb-4">{t("settings")}</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-1 block">{t("classroomName")}</label>
                  <input value={settingsName} onChange={(e) => setSettingsName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-1 block">{t("classroomDescription")}</label>
                  <textarea value={settingsDesc} onChange={(e) => setSettingsDesc(e.target.value)} rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-1 block">{t("classroomInstrument")}</label>
                    <input value={settingsInstrument} onChange={(e) => setSettingsInstrument(e.target.value)}
                      placeholder="Piano, Guitar, ..." 
                      className="w-full h-10 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-1 block">{t("classroomLevel")}</label>
                    <input value={settingsLevel} onChange={(e) => setSettingsLevel(e.target.value)}
                      placeholder="Beginner, Intermediate, ..."
                      className="w-full h-10 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveSettings} disabled={savingSettings || !settingsName.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold">
                  {savingSettings ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {t("saveChanges")}
                </Button>
              </div>
            </div>

            {/* Invite Code */}
            <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
              <h3 className="font-bold text-zinc-900 dark:text-white mb-2">{t("inviteStudents")}</h3>
              <p className="text-sm text-zinc-400 mb-4">{t("inviteDesc")}</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-12 bg-zinc-50 dark:bg-zinc-800 rounded-lg flex items-center justify-center font-mono text-2xl font-black tracking-[0.3em] text-indigo-500">
                  {classroom.classCode}
                </div>
                <Button onClick={handleCopyCode} variant="outline" className="h-12 px-5">
                  {codeCopied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                </Button>
              </div>
              <p className="text-xs text-zinc-500 mt-3">
                {t("shareLink")} <span className="text-indigo-400 font-mono">{typeof window !== "undefined" ? `${window.location.origin}/classroom/join/${classroom.classCode}` : ""}</span>
              </p>
            </div>

            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
              <h3 className="font-bold text-red-400 mb-2">{t("dangerZone")}</h3>
              <p className="text-sm text-zinc-400 mb-4">{t("dangerDesc")}</p>
              <Button
                onClick={handleDeleteClassroom}
                variant="outline"
                className="border-red-500/30 text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4 mr-2" /> {t("deleteClassroom")}
              </Button>
            </div>
          </div>
        )}

        {/* Progress Tab */}
        {activeTab === "progress" && isTeacher && (
          <div>
            {/* Overview */}
            {(() => {
              const students = members.filter(m => m.role === "student");
              const allSubs = Array.from(progressData.values()).flat();
              const studentsWithSubs = new Set(allSubs.map(s => s.studentId));
              const avgAcc = allSubs.length > 0 ? Math.round(allSubs.reduce((a, b) => a + (b.accuracy || 0), 0) / allSubs.length) : 0;
              return (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-center">
                    <div className="text-3xl font-black text-zinc-900 dark:text-white">{studentsWithSubs.size}/{students.length}</div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{t("overallProgress")}</div>
                  </div>
                  <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-center">
                    <div className="text-3xl font-black text-zinc-900 dark:text-white">{allSubs.length}</div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{t("totalSubmissions")}</div>
                  </div>
                  <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-center">
                    <div className="text-3xl font-black text-indigo-500">{avgAcc}%</div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{t("avgAccuracy")}</div>
                  </div>
                </div>
              );
            })()}

            {/* Per-student table */}
            {(() => {
              const students = members.filter(m => m.role === "student");
              if (students.length === 0) {
                return (
                  <div className="py-16 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl text-center">
                    <Users className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
                    <p className="text-zinc-500">{t("noStudents")}</p>
                  </div>
                );
              }
              const allSubs = Array.from(progressData.values()).flat();
              return (
                <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800">
                        <th className="text-left p-3 text-xs uppercase tracking-widest text-zinc-500 font-bold">{t("members")}</th>
                        <th className="text-center p-3 text-xs uppercase tracking-widest text-zinc-500 font-bold">{t("totalSubmissions")}</th>
                        <th className="text-center p-3 text-xs uppercase tracking-widest text-zinc-500 font-bold">{t("avgAccuracy")}</th>
                        <th className="text-center p-3 text-xs uppercase tracking-widest text-zinc-500 font-bold">{t("lastActivity")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(student => {
                        const subs = allSubs.filter(s => s.studentId === student.userId);
                        const avg = subs.length > 0 ? Math.round(subs.reduce((a, b) => a + (b.accuracy || 0), 0) / subs.length) : 0;
                        const lastSub = subs.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""))[0];
                        return (
                          <tr key={student.userId} className="border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                                  {(student.userName || student.userId).slice(0, 2).toUpperCase()}
                                </div>
                                <span className="font-medium text-zinc-900 dark:text-white">{student.userName || student.userId}</span>
                              </div>
                            </td>
                            <td className="p-3 text-center font-bold text-zinc-900 dark:text-white">{subs.length}/{assignments.length}</td>
                            <td className="p-3 text-center">
                              {subs.length > 0 ? (
                                <span className={`font-bold ${avg >= 80 ? "text-green-500" : avg >= 50 ? "text-amber-500" : "text-red-400"}`}>{avg}%</span>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                            </td>
                            <td className="p-3 text-center text-xs text-zinc-400">
                              {lastSub?.submittedAt ? new Date(lastSub.submittedAt).toLocaleDateString() : t("notSubmitted")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
