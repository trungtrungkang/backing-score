"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  FolderPlus,
  Folder,
  Plus,
  Trash2,
  Music4,
  Loader2,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import {
  isClassroomMember,
  getClassroom,
  listExerciseFolders,
  listClassroomExercises,
  createExerciseFolder,
  deleteExerciseFolder,
  addClassroomExercise,
  removeClassroomExercise,
  ClassroomDocument,
  ExerciseFolderDocument,
  ClassroomExerciseDocument,
} from "@/lib/appwrite";
import { listMyProjects, ProjectDocument } from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { useDialogs } from "@/components/ui/dialog-provider";
import { toast } from "sonner";

export default function ClassroomLibraryPage() {
  const params = useParams();
  const classroomId = params.id as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { confirm } = useDialogs();
  const t = useTranslations("Classroom");

  const [classroom, setClassroom] = useState<ClassroomDocument | null>(null);
  const [folders, setFolders] = useState<ExerciseFolderDocument[]>([]);
  const [exercises, setExercises] = useState<ClassroomExerciseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTeacher, setIsTeacher] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Add Folder modal
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Add Exercise modal
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [userProjects, setUserProjects] = useState<ProjectDocument[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const loadData = useCallback(async () => {
    if (!user || !classroomId) return;
    setLoading(true);
    try {
      const [cr, membership, flds, exs] = await Promise.all([
        getClassroom(classroomId),
        isClassroomMember(classroomId),
        listExerciseFolders(classroomId),
        listClassroomExercises(classroomId),
      ]);
      if (!membership.isMember) {
        router.push("/classroom");
        return;
      }
      setClassroom(cr);
      setIsTeacher(membership.role === "teacher");
      setFolders(flds);
      setExercises(exs);
    } catch {
      toast.error(t("failedLoad"));
      router.push("/classroom");
    } finally {
      setLoading(false);
    }
  }, [user, classroomId, router, t]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    loadData();
  }, [authLoading, user, loadData]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || creatingFolder) return;
    setCreatingFolder(true);
    try {
      const folder = await createExerciseFolder({
        classroomId,
        name: newFolderName.trim(),
      });
      setFolders((prev) => [...prev, folder]);
      setNewFolderName("");
      setShowNewFolder(false);
      toast.success(t("folderCreated"));
    } catch {
      toast.error(t("failedCreateFolder"));
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    const ok = await confirm({
      title: t("deleteFolder"),
      description: t("deleteFolderDesc"),
      confirmText: t("deleteConfirm"),
      cancelText: t("deleteCancel"),
    });
    if (!ok) return;
    try {
      await deleteExerciseFolder(folderId);
      setFolders((prev) => prev.filter((f) => f.$id !== folderId));
      setExercises((prev) => prev.filter((e) => e.folderId !== folderId));
      if (selectedFolder === folderId) setSelectedFolder(null);
      toast.success(t("folderDeleted"));
    } catch {
      toast.error(t("failedDeleteFolder"));
    }
  };

  const handleOpenAddExercise = async () => {
    setShowAddExercise(true);
    setLoadingProjects(true);
    try {
      const projects = await listMyProjects();
      setUserProjects(projects);
    } catch {
      toast.error(t("failedLoad"));
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleAddExercise = async (project: ProjectDocument) => {
    try {
      const exercise = await addClassroomExercise({
        classroomId,
        folderId: selectedFolder,
        projectId: project.$id,
        title: project.name,
        description: project.description || "",
      });
      setExercises((prev) => [exercise, ...prev]);
      setShowAddExercise(false);
      toast.success(t("exerciseAdded"));
    } catch {
      toast.error(t("failedAddExercise"));
    }
  };

  const handleRemoveExercise = async (exerciseId: string) => {
    try {
      await removeClassroomExercise(exerciseId);
      setExercises((prev) => prev.filter((e) => e.$id !== exerciseId));
      toast.success(t("exerciseRemoved"));
    } catch {
      toast.error(t("failedRemoveExercise"));
    }
  };

  const filteredExercises = selectedFolder
    ? exercises.filter((e) => e.folderId === selectedFolder)
    : exercises;

  if (authLoading || !user || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (!classroom) return null;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black text-foreground dark:text-white">
      <div className="max-w-5xl mx-auto py-8 px-6">
        {/* Header */}
        <Link href={`/classroom/${classroomId}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> {classroom.name}
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-indigo-500" />
            <h1 className="text-2xl font-black text-zinc-900 dark:text-white">{t("library")}</h1>
          </div>
          {isTeacher && (
            <div className="flex gap-2">
              <Button onClick={() => setShowNewFolder(true)} variant="outline" className="text-sm font-bold">
                <FolderPlus className="w-4 h-4 mr-2" /> {t("newFolder")}
              </Button>
              <Button onClick={handleOpenAddExercise} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold">
                <Plus className="w-4 h-4 mr-2" /> {t("addExercise")}
              </Button>
            </div>
          )}
        </div>

        {/* New Folder Inline Form */}
        {showNewFolder && (
          <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 mb-6 flex items-center gap-3">
            <Folder className="w-5 h-5 text-amber-500 shrink-0" />
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              placeholder={t("folderName")}
              className="flex-1 h-10 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <Button onClick={handleCreateFolder} disabled={creatingFolder || !newFolderName.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm">
              {creatingFolder ? <Loader2 className="w-4 h-4 animate-spin" /> : t("createFolder")}
            </Button>
            <button onClick={() => setShowNewFolder(false)} className="text-zinc-400 hover:text-zinc-200 text-sm">✕</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
          {/* Sidebar — Folders */}
          <div className="space-y-1">
            <button
              onClick={() => setSelectedFolder(null)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedFolder === null ? "bg-indigo-500/10 text-indigo-500" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
            >
              <BookOpen className="w-4 h-4" /> {t("allExercises")}
              <span className="ml-auto text-xs text-zinc-400">{exercises.length}</span>
            </button>

            {folders.map((folder) => {
              const count = exercises.filter((e) => e.folderId === folder.$id).length;
              return (
                <div key={folder.$id} className="group flex items-center">
                  <button
                    onClick={() => setSelectedFolder(folder.$id)}
                    className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedFolder === folder.$id ? "bg-indigo-500/10 text-indigo-500" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                  >
                    <Folder className="w-4 h-4 text-amber-500" /> {folder.name}
                    <span className="ml-auto text-xs text-zinc-400">{count}</span>
                  </button>
                  {isTeacher && (
                    <button
                      onClick={() => handleDeleteFolder(folder.$id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}

            {folders.length === 0 && (
              <p className="text-xs text-zinc-400 px-3 py-4">{t("noFolders")}</p>
            )}
          </div>

          {/* Main — Exercises */}
          <div>
            {filteredExercises.length === 0 ? (
              <div className="py-16 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl text-center">
                <Music4 className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
                <p className="text-zinc-500">{t("noExercises")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredExercises.map((exercise) => (
                  <div key={exercise.$id} className="group flex items-center gap-3 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 hover:border-indigo-500/30 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                      <Music4 className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-zinc-900 dark:text-white truncate">{exercise.title}</div>
                      {exercise.description && (
                        <div className="text-xs text-zinc-400 truncate">{exercise.description}</div>
                      )}
                    </div>
                    <Link
                      href={`/play/${exercise.projectId}`}
                      className="flex items-center gap-1 text-xs font-bold text-indigo-500 hover:text-indigo-400 transition-colors"
                    >
                      {t("practiceHint")} <ChevronRight className="w-3 h-3" />
                    </Link>
                    {isTeacher && (
                      <button
                        onClick={() => handleRemoveExercise(exercise.$id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Add Exercise Modal */}
        {showAddExercise && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAddExercise(false)}>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg max-h-[70vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="font-black text-lg text-zinc-900 dark:text-white">{t("addExercise")}</h2>
                <p className="text-sm text-zinc-400 mt-1">{t("pickProject")}</p>
              </div>
              <div className="p-4 overflow-y-auto max-h-[50vh]">
                {loadingProjects ? (
                  <div className="py-8 flex justify-center">
                    <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {userProjects.map((project) => (
                      <button
                        key={project.$id}
                        onClick={() => handleAddExercise(project)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left"
                      >
                        <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                          <Music4 className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-zinc-900 dark:text-white truncate">{project.name}</div>
                          {project.description && <div className="text-xs text-zinc-400 truncate">{project.description}</div>}
                        </div>
                      </button>
                    ))}
                    {userProjects.length === 0 && (
                      <p className="text-center text-zinc-400 py-8 text-sm">{t("noLibraryExercises")}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
