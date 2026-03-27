"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft,
  Play,
  Send,
  Clock,
  Target,
  Users,
  CheckCircle2,
  Loader2,
  Trophy,
  BarChart3,
} from "lucide-react";
import {
  getAssignment,
  getClassroom,
  getProject,
  isClassroomMember,
  submitAssignment,
  listSubmissions,
  getMySubmission,
  AssignmentDocument,
  ClassroomDocument,
  ProjectDocument,
  SubmissionDocument,
} from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AssignmentDetailPage() {
  const params = useParams();
  const classroomId = params.id as string;
  const assignmentId = params.aid as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [assignment, setAssignment] = useState<AssignmentDocument | null>(null);
  const [classroom, setClassroom] = useState<ClassroomDocument | null>(null);
  const [project, setProject] = useState<ProjectDocument | null>(null);
  const [mySubmission, setMySubmission] = useState<SubmissionDocument | null>(null);
  const [allSubmissions, setAllSubmissions] = useState<SubmissionDocument[]>([]);
  const [userRole, setUserRole] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
          toast.error("You are not a member of this classroom");
          router.push("/classroom");
          return;
        }

        setAssignment(assign);
        setClassroom(cr);
        setUserRole(membership.role);

        // Load the linked project
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
          toast.error("Failed to load assignment");
          router.push(`/classroom/${classroomId}`);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user, authLoading, classroomId, assignmentId, router]);

  const handleSubmit = async () => {
    if (!assignment || !classroom || submitting) return;
    setSubmitting(true);
    try {
      const sub = await submitAssignment(
        {
          assignmentId: assignment.$id,
          classroomId,
          accuracy: 0, // Will be filled when integrated with Play Mode
          tempo: 0,
          attempts: 1,
        }
      );
      setMySubmission(sub);
      toast.success("Submission recorded!");
    } catch {
      toast.error("Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (!assignment || !classroom) return null;

  const isPastDeadline = assignment.deadline && new Date(assignment.deadline) < new Date();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black text-foreground dark:text-white">
      <div className="max-w-3xl mx-auto py-8 px-6">
        <Link href={`/classroom/${classroomId}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> {classroom.name}
        </Link>

        {/* Assignment Header */}
        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
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
              <h1 className="text-2xl font-black text-zinc-900 dark:text-white mb-1">{assignment.title}</h1>
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
                    Due: {new Date(assignment.deadline).toLocaleDateString()} {new Date(assignment.deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {isPastDeadline && <span className="text-red-400 font-bold ml-1">OVERDUE</span>}
                  </span>
                )}
                {assignment.waitModeRequired && (
                  <span className="text-xs text-amber-400 font-bold">⏳ Wait Mode Required</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Student View */}
        {!isTeacher && (
          <div className="space-y-4">
            {/* Practice Button */}
            {project && (
              <Link
                href={`/play/${project.$id}`}
                className="flex items-center gap-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-5 text-white hover:opacity-90 transition-opacity"
              >
                <Play className="w-8 h-8" />
                <div>
                  <div className="font-bold text-lg">Practice: {project.name}</div>
                  <div className="text-white/60 text-sm">Open in Play Mode to practice this assignment</div>
                </div>
              </Link>
            )}

            {/* Submission Status */}
            {mySubmission ? (
              <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                  <h3 className="font-bold text-green-400 text-lg">Submitted</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-zinc-900/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-black text-zinc-900 dark:text-white">{mySubmission.accuracy ?? 0}%</div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Accuracy</div>
                  </div>
                  <div className="bg-white dark:bg-zinc-900/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-black text-zinc-900 dark:text-white">{mySubmission.tempo ?? 0}</div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Tempo</div>
                  </div>
                  <div className="bg-white dark:bg-zinc-900/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-black text-zinc-900 dark:text-white">{mySubmission.attempts}</div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Attempts</div>
                  </div>
                </div>
                {mySubmission.submittedAt && (
                  <p className="text-xs text-zinc-500 mt-3">
                    Submitted: {new Date(mySubmission.submittedAt).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 text-center">
                <Send className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
                <p className="text-zinc-400 mb-4">Practice the score above, then submit your results.</p>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !!isPastDeadline}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8"
                >
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit Assignment
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Teacher View — Submissions */}
        {isTeacher && (
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              Submissions ({allSubmissions.length})
            </h2>

            {allSubmissions.length === 0 ? (
              <div className="py-16 border border-dashed border-zinc-800 rounded-xl text-center">
                <Users className="w-10 h-10 text-zinc-700 mx-auto mb-4" />
                <p className="text-zinc-500">No submissions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {allSubmissions.map((sub) => (
                  <div key={sub.$id}
                    className="flex items-center justify-between bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500">
                        {sub.studentId.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-zinc-900 dark:text-white">
                          {sub.studentId}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {sub.submittedAt && new Date(sub.submittedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-lg font-black text-zinc-900 dark:text-white">{sub.accuracy ?? 0}%</div>
                        <div className="text-[10px] text-zinc-500">accuracy</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-zinc-400">{sub.attempts}x</div>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                        sub.status === "submitted"
                          ? "bg-green-50 dark:bg-green-500/10 text-green-500"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                      }`}>
                        {sub.status}
                      </span>
                    </div>
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
