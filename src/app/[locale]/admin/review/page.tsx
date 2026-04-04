"use client";

import { AlertTriangle, ClipboardList } from "lucide-react";

export default function AdminReviewPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="p-4 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl shadow-inner mb-6">
        <ClipboardList className="w-12 h-12" />
      </div>
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-3">Admin Review (Under Maintenance)</h1>
      <p className="text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
        This feature is temporarily disabled during our systematic upgrade from Vision V4 to V5 (Turso Migration).
        <br/><br/>
        <span className="flex items-center justify-center gap-1.5 text-amber-500 font-semibold text-sm">
          <AlertTriangle className="w-4 h-4" /> Please check back later.
        </span>
      </p>
    </div>
  );
}
