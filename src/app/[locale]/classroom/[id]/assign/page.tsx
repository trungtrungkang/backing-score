"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Search,
  Loader2,
  Music4,
  CheckCircle,
} from "lucide-react";
import {
  createAssignment,
  listMyProjects,
  listPublished,
  getClassroom,
  isClassroomMember,
  ProjectDocument,
} from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function CreateAssignmentPage() {
  const params = useParams();
  const classroomId = params.id as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const t = useTranslations("Classroom");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("practice");
  const [deadline, setDeadline] = useState("");
  const [waitModeRequired, setWaitModeRequired] = useState(false);
  const [creating, setCreating] = useState(false);

  const [sourceTab, setSourceTab] = useState<"uploads" | "discover">("uploads");
  const [searchQuery, setSearchQuery] = useState("");
  const [myProjects, setMyProjects] = useState<ProjectDocument[]>([]);
  const [discoverProjects, setDiscoverProjects] = useState<ProjectDocument[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectDocument | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
    if (!user) return;

    isClassroomMember(classroomId).then((m) => {
      if (!m.isMember || m.role !== "teacher") {
        toast.error(t("onlyTeachers"));
        router.push(`/classroom/${classroomId}`);
      }
    });

    setLoadingProjects(true);
    Promise.all([listMyProjects(), listPublished()])
      .then(([mine, pub]) => {
        setMyProjects(mine);
        setDiscoverProjects(pub);
      })
      .finally(() => setLoadingProjects(false));
  }, [user, authLoading, classroomId, router, t]);

  const filteredProjects = (sourceTab === "uploads" ? myProjects : discoverProjects).filter(
    (p) => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedProject || creating) return;

    setCreating(true);
    try {
      await createAssignment({
        classroomId,
        title: title.trim(),
        description: description.trim(),
        sourceType: sourceTab === "uploads" ? "upload" : "discover",
        sourceId: selectedProject.$id,
        type,
        deadline: deadline || undefined,
        waitModeRequired,
      });
      toast.success(t("assignCreated"));
      router.push(`/classroom/${classroomId}`);
    } catch {
      toast.error(t("failedAssign"));
    } finally {
      setCreating(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-zinc-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black text-foreground dark:text-white">
      <div className="max-w-3xl mx-auto py-8 px-6">
        <Link href={`/classroom/${classroomId}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> {t("backToClassroom")}
        </Link>

        <h1 className="text-2xl font-black text-zinc-900 dark:text-white mb-8">{t("assignTitle")}</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{t("titleRequired")}</label>
              <input required value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder={t("titlePlaceholder")}
                className="w-full h-11 px-4 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{t("assignDescLabel")}</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder={t("assignDescPlaceholder")} rows={2}
                className="w-full px-4 py-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{t("typeLabel")}</label>
                <select value={type} onChange={(e) => setType(e.target.value)}
                  className="w-full h-11 px-4 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="practice">{t("typePractice")}</option>
                  <option value="assessment">{t("typeAssessment")}</option>
                  <option value="performance">{t("typePerformance")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{t("deadlineLabel")}</label>
                <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                  className="w-full h-11 px-4 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-3 cursor-pointer h-11 px-4 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 w-full">
                  <input type="checkbox" checked={waitModeRequired} onChange={(e) => setWaitModeRequired(e.target.checked)}
                    className="w-4 h-4 rounded accent-indigo-500"
                  />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">{t("waitMode")}</span>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
            <h3 className="font-bold text-zinc-900 dark:text-white mb-4">{t("selectScore")}</h3>

            <div className="flex gap-1 mb-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
              {(["uploads", "discover"] as const).map((tab) => (
                <button key={tab} type="button" onClick={() => setSourceTab(tab)}
                  className={`flex-1 py-2 rounded-md text-sm font-bold transition-colors ${
                    sourceTab === tab
                      ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  {tab === "uploads" ? t("myUploads") : t("discover")}
                </button>
              ))}
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("searchScores")}
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1">
              {loadingProjects ? (
                <div className="py-8 text-center"><Loader2 className="w-6 h-6 text-zinc-400 animate-spin mx-auto" /></div>
              ) : filteredProjects.length === 0 ? (
                <p className="py-8 text-center text-zinc-500 text-sm">{t("noScores")}</p>
              ) : (
                filteredProjects.map((p) => (
                  <button key={p.$id} type="button" onClick={() => setSelectedProject(p)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                      selectedProject?.$id === p.$id
                        ? "bg-indigo-500/10 border border-indigo-500/30"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent"
                    }`}
                  >
                    <div className="w-8 h-8 rounded bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0">
                      <Music4 className="w-4 h-4 text-zinc-400" />
                    </div>
                    <span className="text-sm font-medium text-zinc-900 dark:text-white truncate flex-1">{p.name}</span>
                    {selectedProject?.$id === p.$id && <CheckCircle className="w-5 h-5 text-indigo-500 shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => router.push(`/classroom/${classroomId}`)} className="text-zinc-400">
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={creating || !title.trim() || !selectedProject}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 h-11 shadow-lg shadow-indigo-500/20"
            >
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("assignToClass")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
