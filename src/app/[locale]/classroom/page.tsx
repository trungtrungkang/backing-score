"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
import {
  GraduationCap,
  Plus,
  Music4,
  Clock,
  ChevronRight,
  Loader2,
  BookOpen,
} from "lucide-react";
import { listMyClassrooms, ClassroomDocument } from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { DashboardSidebar } from "@/components/DashboardSidebar";

export default function ClassroomListPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const t = useTranslations("Classroom");
  const [classrooms, setClassrooms] = useState<ClassroomDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!user) return;

    let cancelled = false;
    setLoading(true);
    listMyClassrooms()
      .then((list) => {
        if (!cancelled) setClassrooms(list);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-zinc-800 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black text-foreground dark:text-white flex">
      <DashboardSidebar />

      <main className="flex-1 min-h-0 overflow-y-auto py-12 px-6 lg:px-12 bg-white dark:bg-zinc-950/30">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
                  {t("title")}
                </h1>
              </div>
              <p className="text-zinc-400 ml-[52px]">
                {t("subtitle")}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => router.push("/classroom/create")}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 h-11 shadow-lg shadow-indigo-500/20"
              >
                <Plus className="w-5 h-5 mr-2" />
                {t("createBtn")}
              </Button>
            </div>
          </header>

          {/* Join Classroom Input */}
          <div className="mb-8 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <BookOpen className="w-5 h-5 text-indigo-400 shrink-0 hidden sm:block" />
            <span className="text-sm text-zinc-500 shrink-0">{t("haveCode")}</span>
            <input
              type="text"
              placeholder={t("enterCode")}
              maxLength={6}
              className="flex-1 min-h-[48px] py-3 px-4 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-base sm:text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 uppercase tracking-widest font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const code = (e.target as HTMLInputElement).value.trim();
                  if (code.length >= 4) {
                    router.push(`/classroom/join/${code}`);
                  }
                }
              }}
            />
            <Button
              variant="outline"
              className="min-h-[48px] sm:h-10 px-5 text-sm font-bold"
              onClick={() => {
                const input = document.querySelector(`input[placeholder="${t("enterCode")}"]`) as HTMLInputElement;
                const code = input?.value?.trim();
                if (code && code.length >= 4) {
                  router.push(`/classroom/join/${code}`);
                }
              }}
            >
              {t("joinBtn")}
            </Button>
          </div>

          {/* Classroom List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 className="w-10 h-10 text-zinc-400 animate-spin mb-4" />
              <p className="text-zinc-500 font-medium">{t("loading")}</p>
            </div>
          ) : classrooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950/50 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-6">
                <GraduationCap className="w-8 h-8 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                {t("emptyTitle")}
              </h3>
              <p className="text-zinc-400 max-w-sm mb-6">
                {t("emptyDesc")}
              </p>
              <Button
                onClick={() => router.push("/classroom/create")}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
              >
                <Plus className="w-4 h-4 mr-2" /> {t("createFirst")}
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {classrooms.map((classroom) => (
                <Link
                  key={classroom.$id}
                  href={`/classroom/${classroom.$id}`}
                  className="group bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-indigo-500/50 dark:hover:border-indigo-500/30 transition-all hover:shadow-lg hover:shadow-indigo-500/5"
                >
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                    <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                      <GraduationCap className="w-5 sm:w-6 h-5 sm:h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white truncate group-hover:text-indigo-400 transition-colors">
                        {classroom.name}
                      </h3>
                      <div className="flex items-center gap-2 sm:gap-4 mt-1 flex-wrap">
                        {classroom.instrumentFocus && (
                          <span className="text-xs text-zinc-400 flex items-center gap-1">
                            <Music4 className="w-3 h-3" />
                            {classroom.instrumentFocus}
                          </span>
                        )}
                        {classroom.level && (
                          <span className="text-xs text-zinc-400">
                            {classroom.level}
                          </span>
                        )}
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(classroom.$createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full hidden sm:inline ${
                        classroom.status === "active"
                          ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                      }`}>
                        {classroom.status}
                      </span>
                      <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-zinc-700 group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
