"use client";

import { useTranslations } from "next-intl";
import { Crown, Sparkles, X } from "lucide-react";
import Link from "next/link";

interface UpgradePromptProps {
  feature: "playLimit" | "waitMode";
  onClose: () => void;
}

export default function UpgradePrompt({ feature, onClose }: UpgradePromptProps) {
  const t = useTranslations("UpgradePrompt");

  const titles: Record<string, string> = {
    playLimit: t("playLimitTitle"),
    waitMode: t("waitModeTitle"),
  };
  const descriptions: Record<string, string> = {
    playLimit: t("playLimitDesc"),
    waitMode: t("waitModeDesc"),
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center gap-4">
          {/* Icon */}
          <div className="w-14 h-14 rounded-full bg-[#C8A856]/15 flex items-center justify-center">
            <Crown className="w-7 h-7 text-[#C8A856]" />
          </div>

          {/* Content */}
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">
              {titles[feature]}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {descriptions[feature]}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 w-full mt-2">
            <Link
              href="/pricing"
              className="w-full py-3 rounded-xl bg-[#C8A856] text-zinc-900 text-sm font-bold hover:bg-[#d4b85f] transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#C8A856]/20"
            >
              <Sparkles className="w-4 h-4" />
              {t("upgradeNow")}
            </Link>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              {t("maybeLater")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
