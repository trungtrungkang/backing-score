"use client";

import { TiptapEditor } from "@/components/editor/TiptapEditor";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getLessonById, updateLesson } from "@/lib/appwrite/lessons";
import { useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/routing";

function CreatorStudioContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lessonId = searchParams?.get("lessonId");

  const [lessonTitle, setLessonTitle] = useState("Untitled Draft Lesson");
  const [courseId, setCourseId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingLesson, setIsLoadingLesson] = useState(true);
  const [initialContent, setInitialContent] = useState<any>(undefined);

  useEffect(() => {
    if (!lessonId) {
      router.push("/dashboard/courses");
      return;
    }
    
    getLessonById(lessonId).then((lesson) => {
       if (lesson) {
          setLessonTitle(lesson.title);
          setCourseId(lesson.courseId);
          if (lesson.contentRaw) {
             setInitialContent(JSON.parse(lesson.contentRaw));
          } else {
             setInitialContent(undefined);
          }
       } else {
          toast.error("Lesson document missing from database.");
          router.push("/dashboard/courses");
       }
    }).catch(() => {
       toast.error("Failed to fetch lesson properties.");
    }).finally(() => {
       setIsLoadingLesson(false);
    });
  }, [lessonId, router]);

  const handlePublish = async (jsonContent: any) => {
     if (!user || !lessonId || !courseId) return toast.error("Invalid session map.");
     setIsSaving(true);
     try {
         const rawJson = JSON.stringify(jsonContent);
         await updateLesson(lessonId, lessonTitle, rawJson);
         toast.success("Segment Blueprint updated successfully!");
         router.push(`/dashboard/courses/${courseId}/edit`);
     } catch (e) {
         toast.error("Cloud synchronization failed.");
     } finally {
         setIsSaving(false);
     }
  };

  if (isLoadingLesson || !lessonId) {
     return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
           <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
           <p className="text-zinc-500 font-bold tracking-widest uppercase">Fetching Lesson Canvas...</p>
        </div>
     );
  }

  return (
    <>
      {isSaving && (
         <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <p className="text-white font-bold tracking-widest uppercase">Executing Cloud Sync...</p>
         </div>
      )}
      
      <div className="max-w-4xl mx-auto flex flex-col gap-6 relative">
        <Link href={`/dashboard/courses/${courseId}/edit`} className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Return to Curriculum Node
        </Link>
      
        {/* Header & Inspiration */}
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500">
             Lesson Studio
          </h1>
          <p className="text-zinc-500 mt-2 font-medium">
             Construct the text flow and inject interactive `Wait Mode` music snippets into the lesson continuum.
          </p>
        </div>
        
        {/* Simple Course Meta Container */}
        <div className="flex flex-col gap-2 bg-white dark:bg-[#121214] p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
           <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Lesson Segment Title</label>
           <input 
              disabled={isSaving}
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-lg font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="e.g. Chapter 4: Rhythmic Variations"
           />
        </div>

        {/* Tiptap Integration Area */}
        <section className="mt-2 bg-white dark:bg-[#121214] rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-zinc-200/60 dark:border-zinc-800/60 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
           {/* Force re-mount of Editor if initialContent is loaded (since useEditor hook is memoized initially) */}
           <TiptapEditor 
             key={initialContent ? "editor-loaded" : "editor-default"}
             onSave={handlePublish} 
             initialContent={initialContent} 
             saveButtonLabel="Save Lesson Blueprint"
           />
        </section>

      </div>
    </>
  );
}

export default function CreatorStudioPage() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans p-8">
       <Suspense fallback={
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
             <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
             <p className="text-zinc-500 font-bold tracking-widest uppercase">Loading Creator Studio...</p>
          </div>
       }>
          <CreatorStudioContent />
       </Suspense>
    </main>
  );
}
