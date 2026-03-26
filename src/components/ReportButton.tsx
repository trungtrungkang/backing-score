"use client";

import { useState } from "react";
import { Flag, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const REPORT_REASONS = [
  "Copyright infringement",
  "Inappropriate content",
  "Spam or misleading",
  "Harassment or hate speech",
  "Other",
];

interface ReportButtonProps {
  targetType: "project" | "playlist" | "post" | "comment";
  targetId: string;
  className?: string;
}

export function ReportButton({ targetType, targetId, className }: ReportButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !reason) return;
    setSubmitting(true);
    try {
      // Store report via API
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          reason,
          details: details.trim(),
          reporterId: user.$id,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit report");
      toast.success("Report submitted. Our team will review it.");
      setOpen(false);
      setReason("");
      setDetails("");
    } catch {
      toast.error("Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 text-xs text-zinc-400 hover:text-red-500 transition-colors ${className || ""}`}
        title="Report"
      >
        <Flag className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Report</span>
      </button>

      {/* Report Modal */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white">Report Content</h3>
                <p className="text-xs text-zinc-500">Help us keep the community safe</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Reason</label>
                <div className="flex flex-col gap-2">
                  {REPORT_REASONS.map((r) => (
                    <label
                      key={r}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        reason === r
                          ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30"
                          : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="reason"
                        value={r}
                        checked={reason === r}
                        onChange={() => setReason(r)}
                        className="w-4 h-4 text-red-500"
                      />
                      <span className="text-sm font-medium">{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  Additional details <span className="text-zinc-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Provide any additional context..."
                  className="w-full h-20 px-3 py-2 text-sm rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 resize-none focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!reason || submitting}
                className="w-full bg-red-500 hover:bg-red-600 text-white rounded-xl h-11 font-bold"
              >
                {submitting ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
