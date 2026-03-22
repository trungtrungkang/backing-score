"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { account } from "@/lib/appwrite";
import { CheckCircle, XCircle, Loader2, Music4 } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

function VerifyContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const secret = searchParams.get("secret");
  
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!userId || !secret) {
      setStatus("error");
      setErrorMsg("Invalid or missing verification link parameters.");
      return;
    }

    account.updateVerification(userId, secret)
      .then(() => {
        setStatus("success");
      })
      .catch((err: any) => {
        console.error("Verification failed:", err);
        setStatus("error");
        setErrorMsg(err?.message || "Verification failed. The link may have expired or already been used.");
      });
  }, [userId, secret]);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0E0E11] text-zinc-900 dark:text-zinc-100 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 dark:bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10 text-center bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200 dark:border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center">
        <Link href="/" className="flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-black shadow-xl mb-6 hover:scale-105 transition-transform">
          <Music4 className="w-7 h-7" />
        </Link>
        
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <h1 className="text-2xl font-bold tracking-tight mb-2">Verifying Email...</h1>
            <p className="text-zinc-500 dark:text-zinc-400">Please wait while we confirm your email address.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Email Verified</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6">Your account is now fully activated. Welcome to Backing & Score!</p>
            <Button className="w-full rounded-xl" asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Verification Failed</h1>
            <p className="text-zinc-600 dark:text-zinc-300 mb-6 text-sm bg-red-50 dark:bg-red-500/10 p-4 border border-red-100 dark:border-red-500/20 rounded-xl leading-relaxed">
              {errorMsg}
            </p>
            <Button className="w-full rounded-xl" asChild>
              <Link href="/dashboard">Return Home</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white dark:bg-[#0E0E11] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-zinc-500" /></div>}>
      <VerifyContent />
    </Suspense>
  );
}
