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
  FileText,
  ExternalLink,
  X,
  History,
  Eye,
  Music
} from "lucide-react";
import {
  getClassroom,
  listClassroomMembers,
  listAssignments,
  listSubmissions,
  listFeedback,
  isClassroomMember,
  deleteClassroom,
  updateClassroom,
  removeClassroomMember,
  ClassroomDocument,
  ClassroomMemberDocument,
  AssignmentDocument,
  SubmissionDocument,
  SubmissionFeedbackDocument,
  listClassroomMaterials,
  shareToClassroom,
  removeClassroomMaterial,
  ClassroomMaterialDocument,
  listMySheetMusic,
  SheetMusicDocument,
} from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { useDialogs } from "@/components/ui/dialog-provider";
import { toast } from "sonner";
import { getLiveSessions, getLiveSessionAttendances } from "@/app/actions/v5/livekit";

type Tab = "assignments" | "members" | "materials" | "settings" | "progress" | "live_logs";

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
  const [feedbackData, setFeedbackData] = useState<Map<string, SubmissionFeedbackDocument[]>>(new Map());
  const [progressLoaded, setProgressLoaded] = useState(false);
  // Materials
  const [materials, setMaterials] = useState<ClassroomMaterialDocument[]>([]);
  const [materialsSheets, setMaterialsSheets] = useState<Map<string, SheetMusicDocument>>(new Map());
  const [materialsLoaded, setMaterialsLoaded] = useState(false);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [mySheets, setMySheets] = useState<SheetMusicDocument[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [shareNote, setShareNote] = useState("");
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareSearch, setShareSearch] = useState("");
  // Live logs
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionInfo, setSelectedSessionInfo] = useState<{ id: string, startedAt: Date, attendances: any[] } | null>(null);
  const [isLoadingLog, setIsLoadingLog] = useState(false);
  const [logsLoaded, setLogsLoaded] = useState(false);

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

  // Load progress + feedback data when progress tab is activated
  useEffect(() => {
    if (activeTab !== "progress" || progressLoaded || !assignments.length) return;
    Promise.all(assignments.map(a => listSubmissions(a.$id)))
      .then(async (results) => {
        const subMap = new Map<string, SubmissionDocument[]>();
        assignments.forEach((a, i) => subMap.set(a.$id, results[i]));
        setProgressData(subMap);

        // Load feedback for all submissions
        const allSubs = results.flat();
        try {
          const fbResults = await Promise.all(allSubs.map(s => listFeedback(s.$id)));
          const fbMap = new Map<string, SubmissionFeedbackDocument[]>();
          allSubs.forEach((s, i) => fbMap.set(s.$id, fbResults[i]));
          setFeedbackData(fbMap);
        } catch { /* best-effort */ }

        setProgressLoaded(true);
      })
      .catch(() => setProgressLoaded(true));
  }, [activeTab, progressLoaded, assignments]);

  // Load materials when materials tab is activated
  useEffect(() => {
    if (activeTab !== "materials" || materialsLoaded) return;
    setMaterialsLoading(true);
    listClassroomMaterials(classroomId)
      .then(async (mats) => {
        setMaterials(mats);
        // Fetch sheet music details via API proxy (works for all users)
        const sheetIds = [...new Set(mats.map(m => m.sheetMusicId))];
        const sheetsMap = new Map<string, SheetMusicDocument>();
        await Promise.all(sheetIds.map(async (id) => {
          try {
            const res = await fetch(`/api/sheet-music/${id}`);
            if (res.ok) {
              const sheet = await res.json() as SheetMusicDocument;
              sheetsMap.set(id, sheet);
            }
          } catch { /* sheet may have been deleted */ }
        }));
        setMaterialsSheets(sheetsMap);
        setMaterialsLoaded(true);
      })
      .catch(() => setMaterialsLoaded(true))
      .finally(() => setMaterialsLoading(false));
  }, [activeTab, materialsLoaded, classroomId]);

  // Load live sessions when live_logs tab is activated
  useEffect(() => {
    if (activeTab !== "live_logs" || logsLoaded) return;
    setLoading(true);
    getLiveSessions(classroomId)
      .then(data => {
        setSessions(data);
        setLogsLoaded(true);
      })
      .catch(() => toast.error("Failed to load live sessions"))
      .finally(() => setLoading(false));
  }, [activeTab, logsLoaded, classroomId]);

  const handleViewAttendances = async (session: any) => {
    setIsLoadingLog(true);
    try {
      const atts = await getLiveSessionAttendances(session.id);
      setSelectedSessionInfo({
        id: session.id,
        startedAt: session.startedAt,
        attendances: atts
      });
    } catch {
      toast.error("Failed to load attendance logs.");
    } finally {
      setIsLoadingLog(false);
    }
  };

  const handleSharePdf = async () => {
    if (!selectedSheetId || sharing) return;
    setSharing(true);
    try {
      const mat = await shareToClassroom({
        classroomId,
        sheetMusicId: selectedSheetId,
        note: shareNote.trim() || undefined,
      });
      setMaterials(prev => [mat, ...prev]);
      // Add sheet info to map
      const sheet = mySheets.find(s => s.$id === selectedSheetId);
      if (sheet) setMaterialsSheets(prev => new Map(prev).set(selectedSheetId, sheet));
      setShowShareDialog(false);
      setSelectedSheetId(null);
      setShareNote("");
      setShareSearch("");
      toast.success(t("materialShared"));
    } catch {
      toast.error(t("failedShareMaterial"));
    } finally {
      setSharing(false);
    }
  };

  const handleRemoveMaterial = async (materialId: string) => {
    const ok = await confirm({
      title: t("removeMaterial"),
      description: t("removeMaterialDesc"),
      confirmText: t("removeConfirm"),
      cancelText: t("removeCancel"),
    });
    if (!ok) return;
    try {
      await removeClassroomMaterial(materialId);
      setMaterials(prev => prev.filter(m => m.$id !== materialId));
      toast.success(t("materialRemoved"));
    } catch {
      toast.error(t("failedRemoveMaterial"));
    }
  };

  const openShareDialog = async () => {
    setShowShareDialog(true);
    setShareSearch("");
    if (mySheets.length === 0) {
      setLoadingSheets(true);
      try {
        const result = await listMySheetMusic();
        setMySheets(result.documents);
      } catch { /* best-effort */ }
      setLoadingSheets(false);
    }
  };

  // Filter sheets for share dialog: exclude already-shared + apply search
  const filteredShareSheets = mySheets.filter(sheet => {
    const alreadyShared = materials.some(m => m.sheetMusicId === sheet.$id);
    if (alreadyShared) return false;
    if (!shareSearch) return true;
    return sheet.title.toLowerCase().includes(shareSearch.toLowerCase()) ||
      (sheet.composer || "").toLowerCase().includes(shareSearch.toLowerCase());
  });

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
    { key: "materials", label: t("materials"), icon: <FileText className="w-4 h-4" /> },
    ...(isTeacher ? [
      { key: "progress" as Tab, label: t("progress"), icon: <BarChart3 className="w-4 h-4" /> },
      { key: "live_logs" as Tab, label: "Live Logs", icon: <History className="w-4 h-4" /> },
      { key: "settings" as Tab, label: t("settings"), icon: <Settings className="w-4 h-4" /> },
    ] : []),
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black text-foreground dark:text-white">
      <div className="max-w-4xl mx-auto py-8 px-6">
        <Link href="/classroom" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> {t("allClassrooms")}
        </Link>

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-5 sm:p-6 mb-6 text-white">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black mb-1 truncate">{classroom.name}</h1>
              {classroom.description && (
                <p className="text-white/70 text-sm mb-3 line-clamp-2">{classroom.description}</p>
              )}
              <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-white/60 flex-wrap">
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
              className="group bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 text-center transition-all shrink-0 self-start"
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
        <div className="flex gap-1 mb-6 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap shrink-0 ${
                activeTab === tab.key
                  ? "border-indigo-500 text-indigo-500"
                  : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
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
                        {a.sheetMusicId && (
                          <span className="flex items-center gap-1 text-indigo-400">
                            <FileText className="w-3 h-3" /> PDF
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "materials" && (
          <div>
            {isTeacher && (
              <div className="mb-4 flex justify-end">
                <Button onClick={openShareDialog} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold">
                  <Plus className="w-4 h-4 mr-2" /> {t("sharePdf")}
                </Button>
              </div>
            )}

            {materialsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
              </div>
            ) : materials.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-800 rounded-xl text-center">
                <FileText className="w-10 h-10 text-zinc-700 mb-4" />
                <p className="text-zinc-500 font-medium">{t("noMaterials")}</p>
                {isTeacher && (
                  <p className="text-zinc-600 text-sm mt-1">{t("noMaterialsHint")}</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {materials.map((mat) => {
                  const sheet = materialsSheets.get(mat.sheetMusicId);
                  const sharedDate = new Date(mat.$createdAt);
                  const sharedAgo = (() => {
                    const diff = Date.now() - sharedDate.getTime();
                    const days = Math.floor(diff / 86400000);
                    if (days > 30) return sharedDate.toLocaleDateString();
                    if (days > 0) return `${days}d ago`;
                    const hours = Math.floor(diff / 3600000);
                    if (hours > 0) return `${hours}h ago`;
                    return t("justNow");
                  })();
                  return (
                    <div key={mat.$id} className="group flex items-center gap-4 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-indigo-500/10 text-indigo-500">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-zinc-900 dark:text-white truncate">
                          {sheet?.title || mat.sheetMusicId}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 flex-wrap">
                          {sheet?.pageCount && <span>{sheet.pageCount} {t("pagesUnit")}</span>}
                          {sheet?.composer && <span>{sheet.composer}</span>}
                          {mat.note && <span className="italic text-zinc-400">"{mat.note}"</span>}
                          <span className="text-zinc-400">{sharedAgo}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          href={`/dashboard/pdfs/view/${mat.sheetMusicId}?shared=1&back=/classroom/${classroomId}`}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" /> {t("openPdf")}
                        </Link>
                        {isTeacher && (
                          <button
                            onClick={() => handleRemoveMaterial(mat.$id)}
                            className="text-zinc-400 hover:text-red-400 transition-colors p-1"
                            title={t("removeMaterial")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Share PDF Dialog */}
            {showShareDialog && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowShareDialog(false)}>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-white">{t("sharePdf")}</h3>
                    <button onClick={() => setShowShareDialog(false)} className="text-zinc-400 hover:text-zinc-200">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Search input */}
                  <div className="relative mb-3">
                    <input
                      value={shareSearch}
                      onChange={(e) => setShareSearch(e.target.value)}
                      placeholder={t("searchPdfs")}
                      className="w-full h-9 pl-3 pr-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>

                  <div className="max-h-60 overflow-auto space-y-2 mb-4">
                    {loadingSheets ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
                      </div>
                    ) : filteredShareSheets.length === 0 ? (
                      <p className="text-sm text-zinc-500 text-center py-8">
                        {mySheets.length === 0 ? t("noSheetsToShare") : t("noMatchingPdfs")}
                      </p>
                    ) : (
                      filteredShareSheets.map((sheet) => (
                        <button
                          key={sheet.$id}
                          onClick={() => setSelectedSheetId(sheet.$id)}
                          className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                            selectedSheetId === sheet.$id
                              ? 'border-indigo-500 bg-indigo-500/10'
                              : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
                          }`}
                        >
                          <FileText className="w-5 h-5 text-indigo-500 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-zinc-900 dark:text-white truncate">{sheet.title}</div>
                            <div className="text-xs text-zinc-500">{sheet.pageCount} {t("pagesUnit")}{sheet.composer ? ` • ${sheet.composer}` : ''}</div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-1 block">{t("noteOptional")}</label>
                    <input
                      value={shareNote}
                      onChange={(e) => setShareNote(e.target.value)}
                      placeholder={t("notePlaceholder")}
                      className="w-full h-10 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>

                  <Button
                    onClick={handleSharePdf}
                    disabled={!selectedSheetId || sharing}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                  >
                    {sharing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    {t("shareToClassroom")}
                  </Button>
                </div>
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
            {/* Overview Cards */}
            {(() => {
              const students = members.filter(m => m.role === "student");
              const allSubs = Array.from(progressData.values()).flat();
              const studentsWithSubs = new Set(allSubs.map(s => s.studentId));
              const avgAcc = allSubs.length > 0 ? Math.round(allSubs.reduce((a, b) => a + (b.accuracy || 0), 0) / allSubs.length) : 0;
              // Avg grade from feedback
              const allFb = Array.from(feedbackData.values()).flat();
              const graded = allFb.filter(f => f.grade !== undefined && f.grade !== null);
              const avgGrade = graded.length > 0 ? Math.round(graded.reduce((a, b) => a + (b.grade || 0), 0) / graded.length) : null;
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
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
                  <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-center">
                    <div className="text-3xl font-black text-amber-500">{avgGrade !== null ? avgGrade : "—"}</div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{t("avgGrade")}</div>
                  </div>
                </div>
              );
            })()}

            {/* Per-Assignment Breakdown */}
            {assignments.length > 0 && (
              <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl mb-6">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-white">{t("assignmentBreakdown")}</h3>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                      <th className="text-left p-3 text-xs uppercase tracking-widest text-zinc-500 font-bold">{t("assignments")}</th>
                      <th className="text-center p-3 text-xs uppercase tracking-widest text-zinc-500 font-bold">{t("submissionRate")}</th>
                      <th className="text-center p-3 text-xs uppercase tracking-widest text-zinc-500 font-bold">{t("avgAccuracy")}</th>
                      <th className="text-center p-3 text-xs uppercase tracking-widest text-zinc-500 font-bold">{t("avgGrade")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map(assignment => {
                      const subs = progressData.get(assignment.$id) || [];
                      const studentCount = members.filter(m => m.role === "student").length;
                      const avgAcc = subs.length > 0 ? Math.round(subs.reduce((a, b) => a + (b.accuracy || 0), 0) / subs.length) : 0;
                      // Avg grade for this assignment's submissions
                      const assignFb = subs.flatMap(s => feedbackData.get(s.$id) || []);
                      const graded = assignFb.filter(f => f.grade !== undefined && f.grade !== null);
                      const avgGrade = graded.length > 0 ? Math.round(graded.reduce((a, b) => a + (b.grade || 0), 0) / graded.length) : null;
                      return (
                        <tr key={assignment.$id} className="border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
                          <td className="p-3">
                            <Link href={`/classroom/${classroomId}/assignment/${assignment.$id}`} className="font-medium text-zinc-900 dark:text-white hover:text-indigo-500 transition-colors">
                              {assignment.title}
                            </Link>
                          </td>
                          <td className="p-3 text-center font-bold text-zinc-900 dark:text-white">{subs.length}/{studentCount}</td>
                          <td className="p-3 text-center">
                            {subs.length > 0 ? (
                              <span className={`font-bold ${avgAcc >= 80 ? "text-green-500" : avgAcc >= 50 ? "text-amber-500" : "text-red-400"}`}>{avgAcc}%</span>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {avgGrade !== null ? (
                              <span className={`font-bold ${avgGrade >= 80 ? "text-green-500" : avgGrade >= 50 ? "text-amber-500" : "text-red-400"}`}>{avgGrade}</span>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {/* Per-Student Summary */}
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
                <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                  <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white">{t("studentSummary")}</h3>
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800">
                        <th className="text-left p-3 text-xs uppercase tracking-widest text-zinc-500 font-bold">{t("members")}</th>
                        <th className="text-center p-3 text-xs uppercase tracking-widest text-zinc-500 font-bold">{t("totalSubmissions")}</th>
                        <th className="text-center p-3 text-xs uppercase tracking-widest text-zinc-500 font-bold">{t("avgAccuracy")}</th>
                        <th className="text-center p-3 text-xs uppercase tracking-widest text-zinc-500 font-bold">{t("avgGrade")}</th>
                        <th className="text-center p-3 text-xs uppercase tracking-widest text-zinc-500 font-bold">{t("lastActivity")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(student => {
                        const subs = allSubs.filter(s => s.studentId === student.userId);
                        const avg = subs.length > 0 ? Math.round(subs.reduce((a, b) => a + (b.accuracy || 0), 0) / subs.length) : 0;
                        const lastSub = [...subs].sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""))[0];
                        // Student avg grade
                        const studentFb = subs.flatMap(s => feedbackData.get(s.$id) || []);
                        const graded = studentFb.filter(f => f.grade !== undefined && f.grade !== null);
                        const studentAvgGrade = graded.length > 0 ? Math.round(graded.reduce((a, b) => a + (b.grade || 0), 0) / graded.length) : null;
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
                            <td className="p-3 text-center">
                              {studentAvgGrade !== null ? (
                                <span className={`font-bold ${studentAvgGrade >= 80 ? "text-green-500" : studentAvgGrade >= 50 ? "text-amber-500" : "text-red-400"}`}>{studentAvgGrade}</span>
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
                </div>
              );
            })()}
          </div>
        )}

        {/* Live Logs Tab */}
        {activeTab === "live_logs" && isTeacher && (
           <div className="flex flex-col bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
             <div className="p-5 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-black/20">
                <h2 className="text-lg font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
                   <History className="w-5 h-5 text-emerald-500" /> 
                   Live Session History
                </h2>
             </div>
             
             <div className="p-4 sm:p-6 overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
                   <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase text-[10px] tracking-widest">
                         <th className="pb-3 px-2 font-bold">Session Start</th>
                         <th className="pb-3 px-2 font-bold">Duration</th>
                         <th className="pb-3 px-2 font-bold">Host</th>
                         <th className="pb-3 px-2 font-bold">Music Project</th>
                         <th className="pb-3 px-2 text-right font-bold">Logs</th>
                      </tr>
                   </thead>
                   <tbody>
                      {sessions.length === 0 ? (
                         <tr>
                            <td colSpan={5} className="py-12 text-center text-zinc-500">
                               {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-400" /> : "No live sessions have been recorded yet."}
                            </td>
                         </tr>
                      ) : sessions.map(session => (
                         <tr key={session.id} className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                            <td className="py-4 px-2 text-zinc-900 dark:text-white font-medium">
                               {session.startedAt ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(session.startedAt)) : 'Unknown'}
                            </td>
                            <td className="py-4 px-2 text-zinc-500">
                               {session.endedAt && session.startedAt 
                                 ? `${Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)} mins`
                                 : <span className="text-emerald-500 font-medium flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active</span>}
                            </td>
                            <td className="py-4 px-2">{session.hostName || "-"}</td>
                            <td className="py-4 px-2">
                               {session.projectTitle ? (
                                 <div className="flex items-center gap-1.5 overflow-hidden">
                                    <Music className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                    <span className="truncate max-w-[200px] font-medium" title={session.projectTitle}>{session.projectTitle}</span>
                                 </div>
                               ) : <span className="text-zinc-500 italic">None</span>}
                            </td>
                            <td className="py-4 px-2 text-right">
                               <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => handleViewAttendances(session)}
                                  className="h-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                                  disabled={isLoadingLog}
                               >
                                  {isLoadingLog ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Eye className="w-4 h-4 mr-1.5" />}
                                  View Logs
                               </Button>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
           </div>
        )}

      </div>

      {/* Selected Session Modal */}
      {selectedSessionInfo && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col">
               <div className="p-5 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-start bg-zinc-50 dark:bg-zinc-900/40">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Attendance Log</h3>
                    <p className="text-xs text-zinc-500 mt-1">Session started at: <span className="font-medium">{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(selectedSessionInfo.startedAt))}</span></p>
                  </div>
                  <button onClick={() => setSelectedSessionInfo(null)} className="p-2 -mr-2 -mt-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                     <X className="w-5 h-5" />
                  </button>
               </div>
               
               <div className="p-4 sm:p-6 max-h-[60vh] overflow-y-auto">
                 {selectedSessionInfo.attendances.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                      <Users className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                      <p className="text-zinc-500">No students joined this session.</p>
                    </div>
                 ) : (
                    <div className="flex flex-col gap-3">
                       {selectedSessionInfo.attendances.map((att: any) => {
                          const joinTime = att.joinedAt ? new Date(att.joinedAt) : null;
                          const leaveTime = att.leftAt ? new Date(att.leftAt) : null;
                          const durationStr = (joinTime && leaveTime) 
                             ? `${Math.round((leaveTime.getTime() - joinTime.getTime()) / 60000)} mins`
                             : (joinTime ? "Still active" : "-");

                          return (
                            <div key={att.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121214] shadow-sm">
                               <div className="flex items-center gap-3 mb-3 sm:mb-0">
                                 <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500">
                                    {(att.studentName || '?').slice(0, 2).toUpperCase()}
                                 </div>
                                 <div className="font-bold text-sm text-zinc-900 dark:text-white">
                                   {att.studentName || 'Unknown Student'}
                                 </div>
                               </div>
                               <div className="flex items-center gap-3 sm:gap-4 text-xs font-medium bg-zinc-50 dark:bg-zinc-900/50 p-2 sm:p-0 sm:bg-transparent rounded-lg">
                                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                     <ArrowLeft className="w-3.5 h-3.5 rotate-180" /> 
                                     Join: {joinTime ? new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(joinTime) : "?"}
                                  </div>
                                  {leaveTime ? (
                                    <div className="flex items-center gap-1.5 text-zinc-500">
                                       <ArrowLeft className="w-3.5 h-3.5" /> 
                                       Leave: {new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(leaveTime)}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-amber-500">
                                       <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                       Online
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-1 rounded">
                                     <Clock className="w-3.5 h-3.5" /> {durationStr}
                                  </div>
                               </div>
                            </div>
                          );
                       })}
                    </div>
                 )}
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
