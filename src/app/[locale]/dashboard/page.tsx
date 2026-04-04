"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
import { ShieldAlert, Plus, Trash2, LayoutDashboard, Clock, Globe, PlaySquare, CloudUpload, ListMusic, Music4, FolderOpen, GraduationCap, MoreVertical, Settings2, Crown, Eye, EyeOff, Play, Pencil, Search, Menu, X, FolderPlus, Folder, Loader2, ChevronRight, PanelLeftOpen } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useDialogs } from "@/components/ui/dialog-provider";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DriveManager } from "@/components/DriveManager";
import { DailyChallengeCard } from "@/components/gamification/DailyChallengeCard";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      dateStyle: "medium",
    });
  } catch {
    return iso;
  }
}

const TAG_GROUPS = {
  Instruments: ["Piano", "Acoustic Guitar", "Electric Guitar", "Bass", "Violin", "Cello", "Trumpet", "Saxophone", "Drums", "Vocals", "Flute", "Clarinet"],
  Genres: ["Pop", "Rock", "Jazz", "Classical", "Blues", "R&B", "Country", "Folk", "Latin", "Electronic", "Hip Hop"],
  Difficulty: ["Beginner", "Intermediate", "Advanced"],
};

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations("Dashboard");
  const { user, loading: authLoading, sendVerification, getJWT, refreshSubscription } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const searchParams = useSearchParams();

  // After checkout success: sync subscription from LS and refresh premium status
  useEffect(() => {
    if (searchParams.get("checkout") === "success" && user) {
      toast.success("🎉 Welcome to Premium! Your subscription is now active.");
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);

      // Sync subscription from LemonSqueezy (in case webhook hasn't fired yet)
      (async () => {
        try {
          const jwt = await getJWT();
          await fetch("/api/subscription/sync", {
            method: "POST",
            headers: { Authorization: `Bearer ${jwt}` },
          });
          // Refresh premium status in AuthContext
          await refreshSubscription();
        } catch (err) {
          console.error("[Dashboard] Subscription sync failed:", err);
        }
      })();
    }
  }, [searchParams, user, getJWT, refreshSubscription]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black text-foreground dark:text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-zinc-800 border-t-white rounded-full animate-spin"></div>
          <p className="text-zinc-500 tracking-widest uppercase font-medium">{t("verifyingAccess")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black text-foreground dark:text-white flex">
      {/* Sidebar */}
      <DashboardSidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 overflow-y-auto py-12 px-6 lg:px-10 xl:px-12 relative bg-white dark:bg-zinc-950/30">
        <div className="max-w-6xl mx-auto">
          {/* Mobile sidebar toggle */}
          <button onClick={() => setMobileMenuOpen(true)} className="md:hidden mb-6 flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
            <PanelLeftOpen className="w-5 h-5" /> <span className="text-sm font-medium">{t("yourLibrary")}</span>
          </button>

          {/* Gamification Full Width Hero */}
          <DailyChallengeCard />

          {!user.emailVerified && (
            <div className="mb-6 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  {t("verifyEmailPrompt", { email: user.email })}
                </p>
              </div>
              <Button
                onClick={async () => {
                  try {
                    setIsSendingEmail(true);
                    await sendVerification();
                    toast.success("Verification email sent!");
                  } finally {
                    setIsSendingEmail(false);
                  }
                }}
                disabled={isSendingEmail}
                variant="outline"
                size="sm"
                className="shrink-0 bg-white dark:bg-zinc-900"
              >
                {isSendingEmail ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {t("resendEmail")}
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-8 min-w-0">

{/* Removed Stats Summary */}

              {/* Drive Manager Workspace */}
              <div className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-950/50 shadow-sm">
                <DriveManager />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


