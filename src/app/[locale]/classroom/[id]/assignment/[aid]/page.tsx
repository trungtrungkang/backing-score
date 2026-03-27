"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Play,
  Send,
  Clock,
  Target,
  Users,
  CheckCircle2,
  Loader2,
  BarChart3,
  Download,
  Upload,
  MessageCircle,
  Pencil,
  Trash2,
  X,
  Save,
  AlertTriangle,
} from "lucide-react";
import {
  getAssignment,
  getClassroom,
  getProject,
  isClassroomMember,
  submitAssignment,
  updateAssignment,
  deleteAssignment,
  listSubmissions,
  getMySubmission,
  getRecordingUrl,
  getRecordingDownloadUrl,
  createFeedback,
  listFeedback,
  AssignmentDocument,
  ClassroomDocument,
  ProjectDocument,
  SubmissionDocument,
  SubmissionFeedbackDocument,
} from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/** Inline feedback form for a single submission (teacher view) */
function FeedbackSection({
  submissionId,
  t,
}: {
  submissionId: string;
  t: ReturnType<typeof useTranslations<"Classroom">>;
}) {
  const [feedbacks, setFeedbacks] = useState<SubmissionFeedbackDocument[]>([]);
  const [content, setContent] = useState("");
  const [grade, setGrade] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    listFeedback(submissionId)
      .then((list) => { setFeedbacks(list); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [submissionId]);

  const handleSend = async () => {
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      const fb = await createFeedback({
        submissionId,
        content: content.trim(),
        ...(grade ? { grade: parseFloat(grade) } : {}),
      });
      setFeedbacks((prev) => [...prev, fb]);
      setContent("");
      setGrade("");
      toast.success(t("feedbackSent"));
    } catch {
      toast.error(t("failedFeedback"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
      {/* Existing feedback list */}
      {feedbacks.length > 0 && (
        <div className="space-y-2 mb-3">
          {feedbacks.map((fb) => (
            <div key={fb.$id} className="bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/10 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                  {fb.teacherName || t("feedback")}
                </span>
                <div className="flex items-center gap-2">
                  {fb.grade !== undefined && fb.grade !== null && (
                    <span className="text-xs font-bold text-indigo-500">{fb.grade}{t("gradeOutOf")}</span>
                  )}
                  <span className="text-[10px] text-zinc-400">
                    {new Date(fb.$createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{fb.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* New feedback input */}
      <div className="flex gap-2">
        <div className="flex-1 flex gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("feedbackPlaceholder")}
            rows={1}
            className="flex-1 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
          />
          <input
            type="number"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder={t("grade")}
            min={0}
            max={100}
            className="w-20 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
        <Button
          onClick={handleSend}
          disabled={!content.trim() || sending}
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 shrink-0"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

/** Read-only feedback display for student view */
function StudentFeedbackSection({
  submissionId,
  t,
}: {
  submissionId: string;
  t: ReturnType<typeof useTranslations<"Classroom">>;
}) {
  const [feedbacks, setFeedbacks] = useState<SubmissionFeedbackDocument[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    listFeedback(submissionId)
      .then((list) => { setFeedbacks(list); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [submissionId]);

  if (!loaded || feedbacks.length === 0) {
    return feedbacks.length === 0 && loaded ? (
      <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
        <p className="text-xs text-zinc-400 flex items-center gap-1">
          <MessageCircle className="w-3 h-3" /> {t("noFeedbackYet")}
        </p>
      </div>
    ) : null;
  }

  return (
    <div className="mt-4 space-y-2">
      <h4 className="text-sm font-bold text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-indigo-400" /> {t("teacherFeedback")}
      </h4>
      {feedbacks.map((fb) => (
        <div key={fb.$id} className="bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/10 rounded-lg px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-indigo-500">{fb.teacherName}</span>
            <div className="flex items-center gap-2">
              {fb.grade !== undefined && fb.grade !== null && (
                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{fb.grade}{t("gradeOutOf")}</span>
              )}
              <span className="text-[10px] text-zinc-400">
                {new Date(fb.$createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{fb.content}</p>
        </div>
      ))}
    </div>
  );
}

export default function AssignmentDetailPage() {
  const params = useParams();
  const classroomId = params.id as string;
  const assignmentId = params.aid as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const t = useTranslations("Classroom");

  const [assignment, setAssignment] = useState<AssignmentDocument | null>(null);
  const [classroom, setClassroom] = useState<ClassroomDocument | null>(null);
  const [project, setProject] = useState<ProjectDocument | null>(null);
  const [mySubmission, setMySubmission] = useState<SubmissionDocument | null>(null);
  const [allSubmissions, setAllSubmissions] = useState<SubmissionDocument[]>([]);
  const [userRole, setUserRole] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editType, setEditType] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editWaitMode, setEditWaitMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const isTeacher = userRole === "teacher";

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
    if (!user) return;

    let cancelled = false;
    setLoading(true);

    Promise.all([
      getAssignment(assignmentId),
      getClassroom(classroomId),
      isClassroomMember(classroomId),
    ])
      .then(async ([assign, cr, membership]) => {
        if (cancelled) return;
        if (!membership.isMember) {
          toast.error(t("notMember"));
          router.push("/classroom");
          return;
        }

        setAssignment(assign);
        setClassroom(cr);
        setUserRole(membership.role);

        try {
          const proj = await getProject(assign.sourceId);
          if (!cancelled) setProject(proj);
        } catch {}

        if (membership.role === "teacher") {
          const subs = await listSubmissions(assignmentId);
          if (!cancelled) setAllSubmissions(subs);
        } else {
          const sub = await getMySubmission(assignmentId);
          if (!cancelled) setMySubmission(sub);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t("assignmentNotFound"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user, authLoading, classroomId, assignmentId, router, t]);

  const handleSubmit = async () => {
    if (!assignment || !classroom || submitting) return;
    setSubmitting(true);
    try {
      const sub = await submitAssignment({
        assignmentId: assignment.$id,
        classroomId,
        accuracy: 0,
        tempo: 0,
        attempts: 1,
      });
      setMySubmission(sub);
      toast.success(t("submissionRecorded"));
    } catch {
      toast.error(t("failedSubmit"));
    } finally {
      setSubmitting(false);
    }
  };

  const startEditing = () => {
    if (!assignment) return;
    setEditTitle(assignment.title);
    setEditDesc(assignment.description || "");
    setEditType(assignment.type);
    setEditDeadline(assignment.deadline ? new Date(assignment.deadline).toISOString().slice(0, 16) : "");
    setEditWaitMode(assignment.waitModeRequired);
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!assignment || saving) return;
    setSaving(true);
    try {
      const updated = await updateAssignment(assignmentId, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        type: editType,
        deadline: editDeadline || null,
        waitModeRequired: editWaitMode,
      });
      setAssignment(updated);
      setEditing(false);
      toast.success(t("changesSaved"));
    } catch {
      toast.error(t("failedSave"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAssignment = async () => {
    if (!assignment) return;
    if (!window.confirm(t("deleteAssignmentConfirm"))) return;
    try {
      await deleteAssignment(assignmentId);
      toast.success(t("assignmentDeleted"));
      router.push(`/classroom/${classroomId}`);
    } catch {
      toast.error(t("failedDeleteAssignment"));
    }
  };

  if (authLoading || !user || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (!assignment || !classroom) {
    if (error) {
      return (
        <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black flex items-center justify-center">
          <div className="max-w-md text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <h1 className="text-xl font-black text-zinc-900 dark:text-white mb-2">{t("assignmentUnavailable")}</h1>
            <p className="text-sm text-zinc-400 mb-6">{error}</p>
            <Link
              href={`/classroom/${classroomId}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t("backToClassroom")}
            </Link>
          </div>
        </div>
      );
    }
    return null;
  }

  const isPastDeadline = assignment.deadline && new Date(assignment.deadline) < new Date();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black text-foreground dark:text-white">
      <div className="max-w-3xl mx-auto py-8 px-6">
        <Link href={`/classroom/${classroomId}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> {classroom.name}
        </Link>

        {/* Assignment Header */}
        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
          {editing ? (
            /* Edit Mode */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-zinc-900 dark:text-white">{t("editAssignment")}</h2>
                <button onClick={() => setEditing(false)} className="text-zinc-400 hover:text-zinc-200">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                className="w-full h-11 px-4 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2}
                placeholder={t("assignDescPlaceholder")}
                className="w-full px-4 py-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select value={editType} onChange={(e) => setEditType(e.target.value)}
                  className="h-10 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="practice">{t("typePractice")}</option>
                  <option value="assessment">{t("typeAssessment")}</option>
                  <option value="performance">{t("typePerformance")}</option>
                </select>
                <input type="datetime-local" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)}
                  className="h-10 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <label className="flex items-center gap-2 h-10 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                  <input type="checkbox" checked={editWaitMode} onChange={(e) => setEditWaitMode(e.target.checked)} className="w-4 h-4 accent-indigo-500" />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{t("waitMode")}</span>
                </label>
              </div>
              <div className="flex justify-between">
                <Button onClick={handleDeleteAssignment} variant="outline" className="border-red-500/30 text-red-500 hover:bg-red-500/10">
                  <Trash2 className="w-4 h-4 mr-2" /> {t("deleteAssignmentBtn")}
                </Button>
                <Button onClick={handleSaveEdit} disabled={saving || !editTitle.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {t("saveChanges")}
                </Button>
              </div>
            </div>
          ) : (
            /* View Mode */
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                assignment.type === "assessment"
                  ? "bg-amber-500/10 text-amber-500"
                  : assignment.type === "performance"
                  ? "bg-red-500/10 text-red-500"
                  : "bg-blue-500/10 text-blue-500"
              }`}>
                <Target className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <h1 className="text-2xl font-black text-zinc-900 dark:text-white mb-1">{assignment.title}</h1>
                  {isTeacher && (
                    <button onClick={startEditing} className="text-zinc-400 hover:text-indigo-400 transition-colors p-1">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {assignment.description && (
                  <p className="text-zinc-400 text-sm mb-3">{assignment.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className={`uppercase font-bold tracking-wider text-xs px-2 py-1 rounded-full ${
                    assignment.type === "assessment"
                      ? "bg-amber-500/10 text-amber-500"
                      : assignment.type === "performance"
                      ? "bg-red-500/10 text-red-500"
                      : "bg-blue-500/10 text-blue-500"
                  }`}>
                    {assignment.type}
                  </span>
                  {assignment.deadline && (
                    <span className={`flex items-center gap-1 text-xs ${isPastDeadline ? "text-red-400" : "text-zinc-400"}`}>
                      <Clock className="w-3.5 h-3.5" />
                      {t("due")} {new Date(assignment.deadline).toLocaleDateString()} {new Date(assignment.deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {isPastDeadline && <span className="text-red-400 font-bold ml-1">{t("overdue")}</span>}
                    </span>
                  )}
                  {assignment.waitModeRequired && (
                    <span className="text-xs text-amber-400 font-bold">⏳ {t("waitModeRequired")}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Student View */}
        {!isTeacher && (
          <div className="space-y-4">
            {project && (
              <Link
                href={`/play/${project.$id}?assignmentId=${assignment.$id}&classroomId=${classroomId}${assignment.waitModeRequired ? "&waitModeRequired=true" : ""}`}
                className="flex items-center gap-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-5 text-white hover:opacity-90 transition-opacity"
              >
                <Play className="w-8 h-8" />
                <div>
                  <div className="font-bold text-lg">{t("practiceLabel", { name: project.name })}</div>
                  <div className="text-white/60 text-sm">{t("practiceHint")}</div>
                </div>
              </Link>
            )}

            {mySubmission ? (
              <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                  <h3 className="font-bold text-green-400 text-lg">{t("submitted")}</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-zinc-900/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-black text-zinc-900 dark:text-white">{mySubmission.accuracy ?? 0}%</div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{t("accuracy")}</div>
                  </div>
                  <div className="bg-white dark:bg-zinc-900/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-black text-zinc-900 dark:text-white">{mySubmission.tempo ?? 0}</div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{t("tempo")}</div>
                  </div>
                  <div className="bg-white dark:bg-zinc-900/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-black text-zinc-900 dark:text-white">{mySubmission.attempts}</div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{t("attempts")}</div>
                  </div>
                </div>
                {mySubmission.submittedAt && (
                  <p className="text-xs text-zinc-500 mt-3">
                    {t("submittedAt")} {new Date(mySubmission.submittedAt).toLocaleString()}
                  </p>
                )}
                {mySubmission.recordingFileId && (
                  <div className="mt-3 pt-3 border-t border-green-500/20">
                    <div className="text-xs text-zinc-500 mb-1">{t("yourRecording")}</div>
                    <audio src={getRecordingUrl(mySubmission.recordingFileId)} controls className="w-full h-8" />
                  </div>
                )}

                {/* Student sees teacher feedback here */}
                <StudentFeedbackSection submissionId={mySubmission.$id} t={t} />
              </div>
            ) : (
              <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 text-center">
                <Send className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
                <p className="text-zinc-400 mb-2">{t("practiceHintLong")}</p>
                <p className="text-xs text-zinc-500 mb-4">{t("recordHint")}</p>
                <div className="flex items-center gap-3 justify-center">
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !!isPastDeadline}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8"
                  >
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {t("submitAssignment")}
                  </Button>
                  <label className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-sm font-medium text-zinc-600 dark:text-zinc-300">
                    <Upload className="w-4 h-4" />
                    {t("uploadAudio")}
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !assignment || !classroom) return;
                        if (file.size > 10 * 1024 * 1024) {
                          toast.error(t("fileTooLarge"));
                          return;
                        }
                        setSubmitting(true);
                        try {
                          const sub = await submitAssignment({
                            assignmentId: assignment.$id,
                            classroomId,
                            accuracy: 0,
                            tempo: 0,
                            attempts: 1,
                            recordingBlob: file,
                          });
                          setMySubmission(sub);
                          toast.success(t("uploadSuccess"));
                        } catch {
                          toast.error(t("failedUpload"));
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Teacher View — Submissions */}
        {isTeacher && (
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              {t("submissions")} ({allSubmissions.length})
            </h2>

            {allSubmissions.length === 0 ? (
              <div className="py-16 border border-dashed border-zinc-800 rounded-xl text-center">
                <Users className="w-10 h-10 text-zinc-700 mx-auto mb-4" />
                <p className="text-zinc-500">{t("noSubmissions")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allSubmissions.map((sub) => (
                  <div key={sub.$id}
                    className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500">
                          {(sub.studentName || sub.studentId).slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-zinc-900 dark:text-white">
                            {sub.studentName || sub.studentId}
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            {sub.submittedAt && new Date(sub.submittedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-lg font-black text-zinc-900 dark:text-white">{sub.accuracy ?? 0}%</div>
                          <div className="text-[10px] text-zinc-500">{t("accuracy").toLowerCase()}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-zinc-400">{sub.attempts}x</div>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                          sub.status === "submitted"
                            ? "bg-green-50 dark:bg-green-500/10 text-green-500"
                            : sub.status === "reviewed"
                            ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                        }`}>
                          {sub.status}
                        </span>
                      </div>
                    </div>

                    {/* Audio player */}
                    {sub.recordingFileId && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <audio src={getRecordingUrl(sub.recordingFileId)} controls className="flex-1 h-8" />
                        <a
                          href={getRecordingDownloadUrl(sub.recordingFileId)}
                          download
                          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                          title={t("downloadRecording")}
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    )}

                    {/* Teacher feedback section */}
                    <FeedbackSection submissionId={sub.$id} t={t} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
