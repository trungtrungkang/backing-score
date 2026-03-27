"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import {
  GraduationCap,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { joinClassroom, ClassroomDocument } from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Link } from "@/i18n/routing";

export default function JoinClassroomPage() {
  const params = useParams();
  const code = (params.code as string)?.toUpperCase();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classroom, setClassroom] = useState<ClassroomDocument | null>(null);

  const handleJoin = async () => {
    if (!code || joining) return;
    setJoining(true);
    setError(null);
    try {
      const cr = await joinClassroom(code);
      setClassroom(cr);
      setJoined(true);
      toast.success(`Joined "${cr.name}"!`);
    } catch (err: any) {
      setError(err?.message || "Failed to join classroom. Check the code and try again.");
    } finally {
      setJoining(false);
    }
  };

  // Auto-join if user is logged in
  useEffect(() => {
    if (!authLoading && !user) {
      // Redirect to login, then back here
      router.push(`/login`);
    }
  }, [authLoading, user, router, code]);

  if (authLoading || !user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-zinc-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black text-foreground dark:text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center shadow-xl shadow-black/5">
          {/* Success State */}
          {joined && classroom ? (
            <>
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h1 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">
                Welcome to the class!
              </h1>
              <p className="text-zinc-400 mb-6">
                You&apos;ve joined <span className="font-bold text-zinc-200">{classroom.name}</span>
              </p>
              <Link href={`/classroom/${classroom.$id}`}>
                <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 h-11 w-full">
                  Go to Classroom
                </Button>
              </Link>
            </>
          ) : error ? (
            <>
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">
                Couldn&apos;t join
              </h1>
              <p className="text-zinc-400 mb-6">{error}</p>
              <Button
                onClick={handleJoin}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 h-11 w-full mb-3"
              >
                Try Again
              </Button>
              <Link href="/classroom">
                <Button variant="ghost" className="w-full text-zinc-400">
                  Back to Classrooms
                </Button>
              </Link>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-6">
                <GraduationCap className="w-8 h-8 text-indigo-400" />
              </div>
              <h1 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">
                Join Classroom
              </h1>
              <p className="text-zinc-400 mb-6">
                You&apos;re about to join a classroom with code:
              </p>
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl py-4 px-6 mb-6">
                <span className="text-3xl font-mono font-black tracking-[0.3em] text-indigo-500">
                  {code}
                </span>
              </div>
              <Button
                onClick={handleJoin}
                disabled={joining}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 h-11 w-full shadow-lg shadow-indigo-500/20"
              >
                {joining && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Join Classroom
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
