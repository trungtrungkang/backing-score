"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { CourseDoc } from "@/app/actions/v5/courses";
import { LessonDoc, getStudentProgress, ProgressDoc } from "@/app/actions/v5/lessons";
import { checkEnrollment, createEnrollment } from "@/app/actions/v5/courses";
import { Link } from "@/i18n/routing";
import { CheckCircle2, Lock, PlayCircle, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CourseGatewayClient({ course, lessons }: { course: CourseDoc; lessons: LessonDoc[] }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [isEnrolled, setIsEnrolled] = useState(false);
  const [progressMap, setProgressMap] = useState<Map<string, ProgressDoc>>(new Map());
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
       setIsLoadingState(false);
       return;
    }

    let cancelled = false;

    // Concurrently fetch Auth-dependent metadata (Enrollment Status & Gamification States)
    Promise.all([
      checkEnrollment(user.$id, course.$id),
      getStudentProgress(user.$id, course.$id)
    ]).then(([enrolled, progressArray]) => {
      if (!cancelled) {
         setIsEnrolled(enrolled);
         const map = new Map();
         progressArray.forEach(p => map.set(p.lessonId, p));
         setProgressMap(map);
      }
    }).catch(() => {
      if (!cancelled) toast.error("Failed to fetch student profile for this curriculum.");
    }).finally(() => {
      if (!cancelled) setIsLoadingState(false);
    });

    return () => {
       cancelled = true;
    };
  }, [user, authLoading, course.$id]);

  const handleJoinFreeCourse = async () => {
     if (!user) {
        toast.error("Please Log In or Sign Up to enroll in this course.");
        router.push("/login?redirect=/c/" + course.$id);
        return;
     }

     setIsJoining(true);
     try {
        await createEnrollment(user.$id, course.$id);
        setIsEnrolled(true);
        toast.success(`You have successfully joined ${course.title}!`);
     } catch (err) {
        toast.error("Failed to complete enrollment. Please try again.");
     } finally {
        setIsJoining(false);
     }
  };

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex font-sans">
      
      {/* Sidebar - Syllabus Tracker */}
      <aside className="w-80 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121214] flex flex-col h-screen sticky top-0">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
           <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-500">
             {course.title}
           </h1>
           <p className="text-sm text-zinc-500 mt-2">{lessons.length} Modules Available</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoadingState ? (
             <div className="flex flex-col items-center justify-center p-8 opacity-50">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-400 mb-2" />
                <span className="text-xs uppercase tracking-widest font-bold text-zinc-400">Syncing Progress</span>
             </div>
          ) : lessons.map((lesson, idx) => {
            const isFirst = idx === 0;
            const previousProgress = idx > 0 ? progressMap.get(lessons[idx - 1].$id) : null;
            
            // To unlock a node: Student MUST be enrolled AND (It's the 1st lesson OR previous was passed)
            const isMechanicallyUnlocked = isFirst || (previousProgress && previousProgress.unlocked);
            const isUnlocked = isEnrolled && isMechanicallyUnlocked;
            
            const isCompleted = progressMap.has(lesson.$id) && progressMap.get(lesson.$id)!.completedAt;
            
            return (
              <div 
                key={lesson.$id}
                className={`relative group flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isUnlocked 
                  ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-blue-500/50 hover:shadow-md cursor-pointer" 
                  : "bg-zinc-50 dark:bg-black/20 border-transparent opacity-60 grayscale cursor-not-allowed"
                }`}
              >
                 <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                   {isCompleted ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : (isUnlocked ? <PlayCircle className="w-5 h-5 text-blue-500" /> : <Lock className="w-4 h-4" />)}
                 </div>
                 
                 <div className="flex-1 min-w-0">
                   <p className={`text-sm font-semibold truncate ${isUnlocked ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500"}`}>
                     {idx + 1}. {lesson.title}
                   </p>
                   {isCompleted && (
                     <p className="text-xs text-green-500 font-medium">Wait Mode Passed 🎉</p>
                   )}
                 </div>

                 {/* Invisible Link Overlay if Unlocked */}
                 {isUnlocked && (
                    <Link href={`/c/${course.$id}/${lesson.$id}`} className="absolute inset-0" />
                 )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main Content Area */}
      <section className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-zinc-50/50 dark:bg-zinc-950">
        
        {authLoading || isLoadingState ? (
           <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-6" />
        ) : (
           <div className="w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/20">
              <PlayCircle className="w-12 h-12 text-white" />
           </div>
        )}

        <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 mb-2">
           {isEnrolled ? `Welcome back to ${course.title}` : course.title}
        </h2>
        
        {!authLoading && !isLoadingState && (
           <>
              {isEnrolled ? (
                 <p className="text-zinc-500 max-w-md mt-2">
                    Select an unlocked lesson from the syllabus sidebar to resume your interactive Wait Mode journey.
                 </p>
              ) : (
                 <div className="mt-6 flex flex-col items-center max-w-md bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-xl shadow-black/5 border border-zinc-200 dark:border-zinc-800">
                    <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Free Curriculum Access</h3>
                    <p className="text-zinc-500 text-sm mb-6">
                       This Course is entirely free. However, you must log in and formally enroll so we can securely synchronize your instrument progress and Wait Mode achievements.
                    </p>
                    {user ? (
                       <Button onClick={handleJoinFreeCourse} disabled={isJoining} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 rounded-xl text-lg shadow-lg shadow-blue-500/30">
                          {isJoining ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
                          Enroll For Free Now
                       </Button>
                    ) : (
                       <Link href={`/login?redirect=/c/${course.$id}`} className="w-full">
                          <Button className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-black dark:hover:bg-zinc-100 font-bold h-12 rounded-xl text-lg">
                             Sign Up / Log In
                          </Button>
                       </Link>
                    )}
                 </div>
              )}
           </>
        )}

      </section>

    </main>
  );
}
