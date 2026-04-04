"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { checkEnrollment } from "@/app/actions/v5/courses";
import { getStudentProgress, saveWaitModeScore, ProgressDoc, LessonDoc } from "@/app/actions/v5/lessons";
import { CourseDoc } from "@/app/actions/v5/courses";
import { useRouter } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { CheckCircle2, Lock, PlayCircle, Loader2, ChevronRight, Music, Unlock, Menu, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TiptapViewer } from "@/components/editor/TiptapViewer";
import { GamificationProvider } from "@/components/editor/GamificationProvider";

export function LessonActiveClient({
  course,
  lessons,
  activeLesson
}: {
  course: CourseDoc;
  lessons: LessonDoc[];
  activeLesson: LessonDoc;
}) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState(true);
  const [progressMap, setProgressMap] = useState<Map<string, ProgressDoc>>(new Map());
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
       toast.error("Authentication required to access this curriculum module.");
       router.push(`/c/${course.$id}`);
       return;
    }

    let cancelled = false;

    // Concurrently fetch Auth-dependent metadata (Enrollment Status & Gamification States)
    Promise.all([
      checkEnrollment(user.$id, course.$id),
      getStudentProgress(user.$id, course.$id)
    ]).then(([isEnrolled, progressArray]) => {
      if (cancelled) return;

      if (!isEnrolled) {
         toast.error("You must enroll in this Course before accessing its modules.");
         router.push(`/c/${course.$id}`);
         return;
      }

      // Reconstruct gamification state
      const map = new Map();
      progressArray.forEach(p => map.set(p.lessonId, p));
      setProgressMap(map);

      // Retrieve Current Lesson Index
      const activeIdx = lessons.findIndex(l => l.$id === activeLesson.$id);
      if (activeIdx === -1) {
         router.push(`/c/${course.$id}`);
         return;
      }

      const isFirst = activeIdx === 0;
      const previousProgress = activeIdx > 0 ? map.get(lessons[activeIdx - 1].$id) : null;
      
      const isUnlocked = isFirst || (previousProgress && previousProgress.unlocked);

      if (!isUnlocked) {
         toast.error("This module is currently locked. Pass the previous Wait Mode challenges to unlock it.");
         router.push(`/c/${course.$id}`);
         return;
      }

      setIsAuthorized(true);

    }).catch(() => {
      if (!cancelled) {
         toast.error("Failed to validate Server Authorization.");
         router.push(`/c/${course.$id}`);
      }
    }).finally(() => {
      if (!cancelled) setIsValidating(false);
    });

    return () => {
       cancelled = true;
    };
  }, [user, authLoading, course.$id, activeLesson.$id, lessons, router]);

  if (authLoading || isValidating) {
     return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
           <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
           <p className="text-zinc-500 font-medium tracking-wide uppercase text-sm">Validating Clearance & Building Gamification Matrix...</p>
        </div>
     );
  }

  const handleCompleteLesson = async () => {
    if (!user) return;
    setIsUnlocking(true);
    try {
      // Pass totalSnippets = 0 to bypass the strict Gamification constraint math (0 >= 0 -> true)
      await saveWaitModeScore(user.$id, course.$id, activeLesson.$id, 100, undefined, 0);
      
      const activeIdx = lessons.findIndex(l => l.$id === activeLesson.$id);
      const isLastLesson = activeIdx === lessons.length - 1;

      if (isLastLesson) {
         toast.success("Course Completed! 🎉 You have finished all lessons in this curriculum.");
      } else {
         toast.success("Module Completed! Next lesson is now permanently unlocked.");
      }
      
      // Resynchronize Progress DB Matrix
      const newProgress = await getStudentProgress(user.$id, course.$id);
      const map = new Map();
      newProgress.forEach(p => map.set(p.lessonId, p));
      setProgressMap(map);
    } catch (err) {
      toast.error("Failed to commit progress to network.");
    } finally {
      setIsUnlocking(false);
    }
  };

  // If unauthorized block falls through without unmounting, hard-return null
  if (!isAuthorized || !user) return null;

  const currentProgress = progressMap.get(activeLesson.$id);
  const activeIsCompleted = currentProgress?.completedAt;

  // Dynamically count how many snippets exist in the Tiptap document
  const actualPracticeCount = (() => {
    try {
      const parsed = JSON.parse(activeLesson.contentRaw);
      let count = 0;
      const traverse = (node: any) => {
        if (node.type === "musicSnippet" && node.attrs?.practiceRequired !== false) count++;
        if (node.content && Array.isArray(node.content)) {
           node.content.forEach(traverse);
        }
      };
      traverse(parsed);
      return count;
    } catch(e) {
      return 0;
    }
  })();
  
  const totalSnippetsInLesson = Math.max(1, actualPracticeCount); // Ensure at least 1 so database logic works properly

  const activeIdx = lessons.findIndex(l => l.$id === activeLesson.$id);
  const isLastLesson = activeIdx === lessons.length - 1;

  return (
    <main className="h-screen bg-zinc-50 dark:bg-zinc-950 flex font-sans overflow-hidden">
      
      {/* Mobile Nav Overlay */}
      {isMobileNavOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[100] md:hidden backdrop-blur-sm" 
          onClick={() => setIsMobileNavOpen(false)} 
        />
      )}

      {/* 1. Left Learner Navigation Array */}
      <aside className={`fixed inset-y-0 left-0 z-[110] w-[85vw] max-w-sm border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121214] flex flex-col transition-transform duration-300 ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'} md:static md:translate-x-0 md:w-80`}>
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
           <div>
             <Link href="/discover" className="text-xs font-bold text-blue-500 uppercase tracking-widest hover:underline mb-2 block">
               &larr; Back to Platform
             </Link>
             <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 line-clamp-2">
               {course.title}
             </h1>
           </div>
           
           <button 
             onClick={() => setIsMobileNavOpen(false)}
             className="md:hidden p-2 -mr-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
           >
             <X className="w-5 h-5" />
           </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {lessons.map((lesson, idx) => {
            const isFirst = idx === 0;
            const previousProgress = idx > 0 ? progressMap.get(lessons[idx - 1].$id) : null;
            const isCompleted = progressMap.has(lesson.$id) && progressMap.get(lesson.$id)!.completedAt;
            // Always unlock if it's the first, if it was manually/already completed, or if the previous lesson was fully unlocked
            const isUnlocked = isFirst || isCompleted || (previousProgress && previousProgress.unlocked);
            const isActive = lesson.$id === activeLesson.$id;
            
            return (
              <div 
                key={lesson.$id}
                className={`relative group flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isActive ? "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900 shadow-sm" :
                  isUnlocked ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm" : 
                  "bg-zinc-50/50 dark:bg-[#121214] border-transparent opacity-60 grayscale"
                }`}
              >
                 <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    isActive ? "bg-blue-500 text-white shadow-md shadow-blue-500/20" :
                    isCompleted ? "bg-green-100 dark:bg-green-900/30 text-green-500" :
                    isUnlocked ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400" : 
                    "bg-zinc-200 dark:bg-zinc-800 text-zinc-400"
                 }`}>
                   {isActive ? <PlayCircle className="w-5 h-5" /> : 
                    isCompleted ? <CheckCircle2 className="w-5 h-5" /> : 
                    (isUnlocked ? <Music className="w-4 h-4 ml-0.5" /> : <Lock className="w-4 h-4" />)}
                 </div>
                 
                 <div className="flex-1 min-w-0 pr-2">
                   <p className={`text-sm font-semibold truncate ${
                     isActive ? "text-blue-900 dark:text-blue-100" : 
                     isUnlocked ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500"
                   }`}>
                     {idx + 1}. {lesson.title}
                   </p>
                 </div>

                 {isUnlocked && !isActive && (
                    <Link href={`/c/${course.$id}/${lesson.$id}`} className="absolute inset-0" onClick={() => setIsMobileNavOpen(false)} />
                 )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* 2. Interactive Page Content (Tiptap Viewer Frame) */}
      <section className="flex-1 overflow-y-auto relative w-full">
         
         {/* Mobile Header Bar */}
         <div className="md:hidden flex items-center p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121214] sticky top-0 z-[40]">
           <button onClick={() => setIsMobileNavOpen(true)} className="p-2 -ml-2 rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
             <Menu className="w-6 h-6" />
           </button>
           <h2 className="ml-3 font-bold text-sm text-zinc-900 dark:text-white truncate">
             {activeLesson.title}
           </h2>
         </div>

         <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
          
          <div className="mb-6 flex flex-col">
            <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
               {activeLesson.title}
            </h2>
            <div className="flex items-center gap-2 text-zinc-500 text-sm mt-2 font-medium">
               <span>{actualPracticeCount > 0 ? "Interactive Lesson" : "Theoretical Lesson"}</span>
               {actualPracticeCount > 0 && (
                 <>
                   <ChevronRight className="w-4 h-4" />
                   <span className="text-blue-500 dark:text-blue-400">Practice Required (Wait Mode)</span>
                 </>
               )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#151518] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl shadow-zinc-200/50 dark:shadow-none overflow-hidden min-h-[600px] px-8 py-4 flex flex-col">
             {/* Core Engine Hookup! Strict Identity Bound Gamification */}
             <div className="flex-1">
                 <GamificationProvider 
                   userId={user.$id} 
                   courseId={course.$id} 
                   lessonId={activeLesson.$id} 
                   totalSnippets={totalSnippetsInLesson}
                   isLastLesson={isLastLesson}
                   readOnly={false}
                 >
                    <TiptapViewer contentRaw={activeLesson.contentRaw} />
                 </GamificationProvider>
             </div>
             
             {/* Manual Unlocking Override */}
             {!activeIsCompleted && actualPracticeCount === 0 && (
                 <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800 flex flex-col items-center pb-8">
                    <div className="bg-blue-50 dark:bg-blue-900/10 rounded-full p-4 mb-4">
                       <Unlock className="w-8 h-8 text-blue-500" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Ready to progress?</h3>
                    <p className="text-zinc-500 text-sm max-w-sm text-center mb-6">
                       If this lesson does not require instrument practice, or if you have finished reading/listening, click the button below to mark it as complete and unlock the next module.
                    </p>
                    <Button 
                       onClick={handleCompleteLesson} 
                       disabled={isUnlocking}
                       size="lg"
                       className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 shadow-lg shadow-blue-500/20"
                    >
                       {isUnlocking ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                       Mark Complete & Unlock Next Module
                    </Button>
                 </div>
             )}
          </div>
          
        </div>
      </section>

    </main>
  );
}
