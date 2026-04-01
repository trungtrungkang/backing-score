"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getCourseById, updateCourse, CourseDoc } from "@/lib/appwrite/courses";
import { getLessonsByCourse, createLesson, deleteLesson, updateLesson, LessonDoc } from "@/lib/appwrite/lessons";
import { Button } from "@/components/ui/button";
import { BookOpen, Plus, Loader2, Settings, ArrowLeft, Trash2, GripVertical, X, Edit3, ArrowUp, ArrowDown } from "lucide-react";
import { Link } from "@/i18n/routing";
import { toast } from "sonner";
import { useDialogs } from "@/components/ui/dialog-provider";

export default function CurriculumManagerPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { confirm } = useDialogs();

  const [course, setCourse] = useState<CourseDoc | null>(null);
  const [lessons, setLessons] = useState<LessonDoc[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Settings Modal State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPrice, setEditPrice] = useState("0");
  const [editPublished, setEditPublished] = useState(false);
  const [editCategory, setEditCategory] = useState("");
  const [editDifficulty, setEditDifficulty] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Re-ordering State
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!user || !courseId) return;

    let cancelled = false;
    Promise.all([
      getCourseById(courseId),
      getLessonsByCourse(courseId)
    ]).then(([courseData, lessonsData]) => {
      if (!cancelled) {
        setCourse(courseData);
        setLessons(lessonsData);
        if (courseData) {
           setEditTitle(courseData.title);
           setEditDesc(courseData.description || "");
           setEditPrice(( (courseData.priceCents ?? 0) / 100).toString());
           setEditPublished(courseData.published || false);
           setEditCategory(courseData.category || "");
           setEditDifficulty(courseData.difficulty || "");
        }
      }
    }).catch(() => {
      if (!cancelled) toast.error("Failed to load curriculum data.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router, courseId]);

  const handleAddNewLesson = async () => {
    if (!user || !course) return;
    setIsAddingLesson(true);
    try {
      const nextIndex = lessons.length > 0 ? Math.max(...lessons.map(l => l.orderIndex)) + 1 : 0;
      // create a blank lesson
      const newLesson = await createLesson(course.$id, "Untitled Draft Lesson", "", nextIndex);
      toast.success("Lesson shell generated!");
      // Redirect to Tiptap Studio targeting this specific lesson
      router.push(`/dashboard/courses/creator?lessonId=${newLesson.$id}`);
    } catch (e) {
      toast.error("Failed to append lesson to curriculum.");
      setIsAddingLesson(false);
    }
  };

  const handleDeleteLesson = async (lessonId: string, title: string) => {
    if (deletingId) return;
    const isConfirmed = await confirm({
       title: "Delete Lesson",
       description: `Are you sure you want to permanently delete "${title}"? This cannot be undone.`,
       confirmText: "Delete",
       cancelText: "Cancel"
    });
    if (!isConfirmed) return;

    setDeletingId(lessonId);
    try {
      const success = await deleteLesson(lessonId);
      if (success) {
        setLessons(prev => prev.filter(l => l.$id !== lessonId));
        toast.success("Lesson removed successfully.");
      } else {
        toast.error("Failed to delete lesson.");
      }
    } catch {
      toast.error("An error occurred during deletion.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim() || !course) return;
    setIsUpdating(true);
    try {
      const priceCents = Math.round(parseFloat(editPrice) * 100);
      const updatedCourse = await updateCourse(course.$id, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        priceCents: isNaN(priceCents) ? 0 : priceCents,
        published: editPublished,
        category: editCategory.trim() || undefined,
        difficulty: editDifficulty.trim() || undefined,
      });
      setCourse(updatedCourse);
      setIsSettingsModalOpen(false);
      toast.success("Course metadata updated successfully.");
    } catch (err) {
      toast.error("Failed to update course.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
     setDraggedItemIndex(index);
     e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
     e.preventDefault();
     e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
     e.preventDefault();
     if (draggedItemIndex === null || draggedItemIndex === dropIndex) return;

     const newLessons = [...lessons];
     const draggedItem = newLessons[draggedItemIndex];
     
     newLessons.splice(draggedItemIndex, 1);
     newLessons.splice(dropIndex, 0, draggedItem);
     
     const updatedOrder = newLessons.map((l, i) => ({ ...l, orderIndex: i }));
     setLessons(updatedOrder);
     setDraggedItemIndex(null);

     setIsReordering(true);
     try {
         await Promise.all(updatedOrder.map(l => updateLesson(l.$id, undefined, undefined, l.orderIndex)));
         toast.success("Curriculum sequence saved.");
     } catch (err) {
         toast.error("Failed to commit sequence order.");
     } finally {
         setIsReordering(false);
     }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-zinc-500 font-bold tracking-widest uppercase text-sm">Loading Curriculum...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Curriculum Not Found</h2>
        <Link href="/dashboard/courses">
           <Button variant="ghost" className="mt-4"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-foreground dark:text-white flex flex-col pt-6 pb-24 px-6 lg:px-12 relative">
      <div className="max-w-5xl mx-auto w-full">
        {/* Navigation Breadcrumb */}
        <Link href="/dashboard/courses" className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4 mr-1" /> My Courses
        </Link>
        
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
               <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">{course.title}</h1>
               {course.published 
                  ? <span className="bg-green-500/10 text-green-500 uppercase tracking-widest text-[10px] font-bold px-2 py-1 rounded-sm border border-green-500/20">Published</span>
                  : <span className="bg-zinc-500/10 text-zinc-500 uppercase tracking-widest text-[10px] font-bold px-2 py-1 rounded-sm border border-zinc-500/20">Draft</span>
               }
            </div>
            
            {course.description && (
               <p className="text-zinc-500 text-sm mb-2 max-w-xl">{course.description}</p>
            )}
            <p className="text-zinc-500 mt-2">
               <span className="font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-200/50 dark:bg-zinc-800/50 px-2 py-0.5 rounded mr-2">
                  {(course.priceCents ?? 0) > 0 ? `$${((course.priceCents ?? 0) / 100).toFixed(2)}` : "Free"}
               </span>
               Curriculum Manager
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
             <Button onClick={() => setIsSettingsModalOpen(true)} variant="outline" className="bg-white dark:bg-zinc-900">
               <Edit3 className="w-4 h-4 mr-2" />
               Course Settings
             </Button>
             <Button onClick={handleAddNewLesson} disabled={isAddingLesson} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 h-11 shadow-lg shadow-indigo-500/20">
               {isAddingLesson ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Plus className="w-5 h-5 mr-2" />}
               Add New Lesson
             </Button>
          </div>
        </header>

        <section className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm rounded-2xl">
           <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center">
                 <BookOpen className="w-5 h-5 mr-3 text-indigo-500" /> Syllabus Sequence
              </h2>
           </div>

           <div className={`flex flex-col relative ${isReordering ? 'opacity-50 pointer-events-none' : ''}`}>
              {isReordering && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-50/50 dark:bg-[#121214]/50 backdrop-blur-[1px]">
                      <div className="flex bg-white dark:bg-zinc-900 shadow-lg px-4 py-2 rounded-full items-center">
                          <Loader2 className="w-4 h-4 text-indigo-500 animate-spin mr-2" />
                          <span className="text-sm font-bold tracking-widest uppercase">Saving Sequence...</span>
                      </div>
                  </div>
              )}
              {lessons.length === 0 ? (
                 <div className="py-20 text-center flex flex-col items-center px-4">
                    <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4">
                       <Plus className="w-8 h-8 text-indigo-500 opacity-50" />
                    </div>
                    <h3 className="text-zinc-900 dark:text-white font-bold text-lg mb-2">Curriculum is Empty</h3>
                    <p className="text-zinc-500 max-w-sm mb-6">Begin architecting this course by injecting interactive Tiptap lessons into the syllabus sequence.</p>
                    <Button onClick={handleAddNewLesson} disabled={isAddingLesson} variant="outline" className="border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10">
                       Create Module 1
                    </Button>
                 </div>
              ) : (
                 lessons.map((lesson, idx) => (
                    <div 
                       key={lesson.$id} 
                       draggable={!isReordering}
                       onDragStart={(e) => handleDragStart(e, idx)}
                       onDragOver={handleDragOver}
                       onDrop={(e) => handleDrop(e, idx)}
                       className={`group flex items-center gap-4 p-4 border-b last:border-0 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors ${draggedItemIndex === idx ? 'opacity-30 bg-zinc-100 dark:bg-zinc-900' : ''}`}
                    >
                       <div className="cursor-grab active:cursor-grabbing p-2 text-zinc-400 opacity-50 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded touch-none hidden sm:block">
                          <GripVertical className="w-4 h-4" />
                       </div>
                       
                       <div className="w-8 h-8 flex-shrink-0 bg-zinc-100 dark:bg-zinc-900 rounded flex items-center justify-center text-xs font-bold text-zinc-500 border border-zinc-200 dark:border-zinc-800 shadow-inner">
                          {idx + 1}
                       </div>
                       
                       <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-zinc-900 dark:text-white truncate">{lesson.title}</h4>
                          <p className="text-xs text-zinc-500 font-mono">ID: {lesson.$id.slice(0, 8)}</p>
                       </div>

                       <div className="flex items-center gap-2">
                          {/* Fallback Mobile Re-order arrows */}
                          <div className="flex sm:hidden flex-col mr-2">
                             <button disabled={idx === 0 || isReordering} onClick={() => handleDrop({preventDefault: ()=>{}} as any, idx - 1)} className="p-1 text-zinc-400 hover:text-indigo-500 disabled:opacity-20"><ArrowUp className="w-3 h-3"/></button>
                             <button disabled={idx === lessons.length - 1 || isReordering} onClick={() => handleDrop({preventDefault: ()=>{}} as any, idx + 1)} className="p-1 text-zinc-400 hover:text-indigo-500 disabled:opacity-20"><ArrowDown className="w-3 h-3"/></button>
                          </div>
                       
                          <Link href={`/dashboard/courses/creator?lessonId=${lesson.$id}`}>
                             <Button variant="secondary" size="sm" className="font-semibold px-4 hidden sm:flex">
                                <Settings className="w-4 h-4 mr-2" /> Edit Blueprint
                             </Button>
                             <Button variant="secondary" size="icon" className="h-8 w-8 sm:hidden">
                                <Settings className="w-4 h-4" />
                             </Button>
                          </Link>
                          
                          <Button 
                             variant="ghost" 
                             size="icon"
                             onClick={() => handleDeleteLesson(lesson.$id, lesson.title)}
                             disabled={deletingId === lesson.$id || isReordering}
                             className="text-zinc-400 hover:text-red-500 hover:bg-red-500/10 h-8 w-8 sm:h-9 sm:w-9"
                          >
                             {deletingId === lesson.$id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </Button>
                       </div>
                    </div>
                 ))
              )}
           </div>
        </section>

      </div>

      {/* Course Settings Modal Overlay */}
      {isSettingsModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden shadow-black/50">
               <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Curriculum Settings</h3>
                  <button onClick={() => setIsSettingsModalOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
                     <X className="w-5 h-5" />
                  </button>
               </div>
               <form onSubmit={handleUpdateCourse} className="p-6 flex flex-col gap-5">
                  <div>
                     <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Course Title</label>
                     <input 
                        required
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 font-medium text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                     />
                  </div>
                  
                  <div>
                     <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
                     <textarea 
                        rows={3}
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Provide a short summery of the topics covered..."
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 font-medium text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                     />
                  </div>
                  
                  <div className="flex justify-between gap-6">
                     <div className="flex-1">
                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Pricing (USD)</label>
                        <div className="relative">
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">$</span>
                           <input 
                              type="number"
                              step="0.01"
                              min="0"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-8 pr-4 py-3 font-medium text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                           />
                        </div>
                     </div>
                     <div className="flex-1 flex flex-col justify-center gap-2">
                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Visibility Status</label>
                        <div className="flex items-center gap-3">
                           <button 
                              type="button" 
                              onClick={() => setEditPublished(!editPublished)}
                              className={`relative w-12 h-6 rounded-full transition-colors flex items-center ${editPublished ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                           >
                              <div className={`absolute left-1 w-4 h-4 rounded-full bg-white transition-transform ${editPublished ? 'translate-x-6' : 'translate-x-0'}`} />
                           </button>
                           <span className="text-sm font-bold text-zinc-500">{editPublished ? 'Published' : 'Draft'}</span>
                        </div>
                     </div>
                  </div>

                  <div className="flex gap-4">
                     <div className="flex-1">
                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Category</label>
                        <input
                           value={editCategory}
                           onChange={(e) => setEditCategory(e.target.value)}
                           placeholder="e.g. Piano, Guitar, Music Theory"
                           className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 font-medium text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                     </div>
                     <div className="flex-1">
                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Difficulty</label>
                        <select
                           value={editDifficulty}
                           onChange={(e) => setEditDifficulty(e.target.value)}
                           className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 font-medium text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        >
                           <option value="">— Select —</option>
                           <option value="Beginner">Beginner</option>
                           <option value="Intermediate">Intermediate</option>
                           <option value="Advanced">Advanced</option>
                        </select>
                     </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                     <Button type="button" variant="ghost" onClick={() => setIsSettingsModalOpen(false)}>Cancel</Button>
                     <Button type="submit" disabled={isUpdating || !editTitle.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6">
                        {isUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save Changes
                     </Button>
                  </div>
               </form>
            </div>
         </div>
      )}
    </main>
  );
}
