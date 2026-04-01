"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { joinClassroom } from "@/lib/appwrite";
import { PanelLeftOpen, X, Loader2, KeyRound, CheckCircle2 } from "lucide-react";

export default function JoinClassroomPage() {
  const router = useRouter();
  const t = useTranslations("JoinClassroom");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<"pending" | "active" | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setSuccess(null);
    try {
      const classroom = await joinClassroom(code.trim());
      
      // Because we don't know the returned status (pending/active) directly from the return value of joinClassroom
      // (it just returns the classroom doc), we could deduce it from the code pattern, but relying on Appwrite logic
      // The API handles the branching internally. We check if they entered an INV- ticket
      if (code.toUpperCase().startsWith("INV-")) {
        setSuccess("active");
        toast.success(t("toastSuccessActive"));
        setTimeout(() => {
          router.push(`/dashboard/classrooms/${classroom.$id}`);
        }, 2000);
      } else {
        setSuccess("pending");
        toast.success(t("toastSuccessPending"));
      }

    } catch (err: any) {
      toast.error(err.message || t("toastError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <DashboardSidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Mobile menu toggle */}
      <button
        className="md:hidden fixed bottom-20 left-4 z-40 bg-zinc-800 text-white p-3 rounded-full shadow-lg"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <PanelLeftOpen className="w-5 h-5" />
        )}
      </button>

      <main className="flex-1 flex flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
          
          {success === "pending" ? (
            <div className="space-y-6">
              <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">{t("successPendingTitle")}</h2>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {t("successPendingDesc")}
                </p>
              </div>
              <Button onClick={() => router.push("/dashboard")} className="w-full mt-4" variant="outline">
                {t("returnHome")}
              </Button>
            </div>
          ) : success === "active" ? (
            <div className="space-y-6">
              <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">{t("successBypassTitle")}</h2>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {t("successBypassDesc")}
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleJoin} className="space-y-6">
              <div className="mx-auto w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mb-6">
                <KeyRound className="w-8 h-8" />
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                  {t("title")}
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                  {t("description")}
                </p>
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder={t("placeholder")}
                  className="w-full text-center text-2xl tracking-widest px-4 py-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase transition-all"
                  autoFocus
                  required
                />
                <Button
                  type="submit"
                  disabled={loading || !code.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 text-lg font-medium rounded-xl"
                >
                  {loading ? (
                    <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                  ) : null}
                  {loading ? t("processing") : t("submit")}
                </Button>
              </div>
            </form>
          )}

        </div>
      </main>
    </div>
  );
}
