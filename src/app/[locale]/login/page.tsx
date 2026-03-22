"use client";

import { useState } from "react";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
import { ArrowRight, Mail, Lock, Music4 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithOAuth, error, clearError } = useAuth();
  const t = useTranslations("Login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/dashboard");
      router.refresh();
    } catch {
      // Error is set in context
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0E0E11] text-zinc-900 dark:text-zinc-100 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 dark:bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center justify-center mb-8">
          <Link href="/" className="flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-black shadow-xl mb-6 hover:scale-105 transition-transform">
            <Music4 className="w-7 h-7" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight mb-2">{t("welcomeBack")}</h1>
          <p className="text-zinc-500 dark:text-zinc-400">{t("subtitle")}</p>
        </div>

        <div className="bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200 dark:border-white/10 rounded-3xl p-8 shadow-2xl dark:shadow-black/50">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => loginWithOAuth("google")}
                className="flex items-center justify-center gap-2 h-11 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                Google
              </button>
            </div>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-zinc-200 dark:border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-zinc-400 text-sm">{t("orLoginEmail")}</span>
              <div className="flex-grow border-t border-zinc-200 dark:border-white/10"></div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 ml-1">{t("emailLabel")} <span className="text-red-500">*</span></label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="name@example.com"
                  className="w-full h-12 pl-12 pr-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all outline-none text-zinc-900 dark:text-white placeholder:text-zinc-400" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 ml-1">{t("passwordLabel")} <span className="text-red-500">*</span></label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" placeholder="••••••••"
                  className="w-full h-12 pl-12 pr-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all outline-none text-zinc-900 dark:text-white placeholder:text-zinc-400" />
              </div>
            </div>

            <button type="submit" disabled={submitting}
              className="mt-2 w-full h-12 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-lg">
              {submitting ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>{t("loginBtn")} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {t("noAccount")}{" "}
            <Link href="/signup" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
              {t("signupLink")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
