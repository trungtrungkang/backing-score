"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { checkEnrollment } from "@/lib/appwrite/courses";
import { getStudentProgress } from "@/lib/appwrite/lessons";
import { useRouter } from "@/i18n/routing";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function LessonGuardClient({
  courseId,
  lessons,
  activeLessonId,
  children
}: {
  courseId: string;
  lessons: any[];
  activeLessonId: string;
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
       toast.error("Authentication required to access this curriculum module.");
       router.push(`/c/${courseId}`);
       return;
    }

    let cancelled = false;

    // Validate if the User holds an active Enrollment AND has mechanically unlocked this Node
    Promise.all([
      checkEnrollment(user.$id, courseId),
      getStudentProgress(user.$id, courseId)
    ]).then(([isEnrolled, progressArray]) => {
      if (cancelled) return;

      if (!isEnrolled) {
         toast.error("You must enroll in this Course before accessing its modules.");
         router.push(`/c/${courseId}`);
         return;
      }

      // Reconstruct gamification state
      const progressMap = new Map();
      progressArray.forEach(p => progressMap.set(p.lessonId, p));

      // Retrieve Current Lesson Index
      const activeIdx = lessons.findIndex(l => l.$id === activeLessonId);
      if (activeIdx === -1) {
         router.push(`/c/${courseId}`);
         return;
      }

      const isFirst = activeIdx === 0;
      const previousProgress = activeIdx > 0 ? progressMap.get(lessons[activeIdx - 1].$id) : null;
      
      const isUnlocked = isFirst || (previousProgress && previousProgress.unlocked);

      if (!isUnlocked) {
         toast.error("This module is currently locked. Pass the previous Wait Mode challenges to unlock it.");
         router.push(`/c/${courseId}`);
         return;
      }

      // If we made it here, User is Fully Cleared
      setIsAuthorized(true);

    }).catch(() => {
      if (!cancelled) {
         toast.error("Failed to validate Server Authorization.");
         router.push(`/c/${courseId}`);
      }
    }).finally(() => {
      if (!cancelled) setIsValidating(false);
    });

    return () => {
       cancelled = true;
    };
  }, [user, authLoading, courseId, activeLessonId, lessons, router]);

  if (authLoading || isValidating) {
     return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
           <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
           <p className="text-zinc-500 font-medium tracking-wide uppercase text-sm">Validating Security Clearance...</p>
        </div>
     );
  }

  if (!isAuthorized) return null;

  return <>{children}</>;
}
