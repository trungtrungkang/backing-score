"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { CloudUpload, Bookmark, FolderOpen, Globe, Plus, GraduationCap, PlaySquare, Settings, Trash2, BookOpen, X, Loader2 } from "lucide-react";
import { getCreatorCourses, deleteCourse, createCourse, CourseDoc } from "@/lib/appwrite/courses";
import { Button } from "@/components/ui/button";
import { useDialogs } from "@/components/ui/dialog-provider";
import { toast } from "sonner";
import { canCreate } from "@/lib/auth/roles";

export default function CreatorCoursesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [courses, setCourses] = useState<CourseDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { confirm } = useDialogs();

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCoursePrice, setNewCoursePrice] = useState("0");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseTitle.trim() || !user) return;
    setIsCreating(true);
    try {
      const priceCents = Math.round(parseFloat(newCoursePrice) * 100);
      const course = await createCourse(user.$id, newCourseTitle.trim(), isNaN(priceCents) ? 0 : priceCents);
      toast.success("Course shell created!");
      router.push(`/dashboard/courses/${course.$id}/edit`);
    } catch (err) {
      toast.error("Failed to create course.");
    } finally {
      setIsCreating(false);
      setIsCreateModalOpen(false);
    }
  };

  const handleDelete = async (courseId: string, title: string) => {
    if (deletingId) return;
    const isConfirmed = await confirm({
       title: "Delete Course",
       description: `Are you sure you want to permanently delete "${title}"? This cannot be undone.`,
       confirmText: "Delete",
       cancelText: "Cancel"
    });
    if (!isConfirmed) return;

    setDeletingId(courseId);
    try {
      const success = await deleteCourse(courseId);
      if (success) {
        setCourses(prev => prev.filter(c => c.$id !== courseId));
        toast.success("Course deleted successfully.");
      } else {
        toast.error("Failed to delete course.");
      }
    } catch {
      toast.error("An error occurred during deletion.");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!user) return;
    
    // Safety check: Only Admins/Creators can access the Creator Dashboard portal
    if (!canCreate(user.labels)) {
      router.push("/dashboard");
      return;
    }

    let cancelled = false;
    getCreatorCourses(user.$id)
      .then((list) => {
        if (!cancelled) setCourses(list);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
      
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-zinc-800 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black text-foreground dark:text-white flex border-t border-zinc-200 dark:border-zinc-900">
      
      {/* Reused Left Navigation Array */}
      <aside className="w-64 border-r border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-6 hidden md:flex flex-col gap-8 sticky top-16 h-[calc(100vh-4rem)]">
        <div>
          <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-4">Your Library</h2>
          <nav className="flex flex-col gap-1">
            <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-colors">
              <CloudUpload className="w-4 h-4" />
              My Uploads
            </Link>
            <Link href="/dashboard/collections" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-colors">
              <FolderOpen className="w-4 h-4" />
              Collections
            </Link>
            <Link href="/dashboard/favorites" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-colors">
              <Bookmark className="w-4 h-4" />
              Favorites
            </Link>
            
            <button className="flex items-center gap-3 px-3 py-2 mt-4 rounded-md bg-zinc-800/80 text-white font-medium transition-colors border-t border-zinc-800/50 pt-3">
              <GraduationCap className="w-4 h-4 text-[#C8A856]" />
              Creator Courses
            </button>
            
            <Link href="/discover" className="flex items-center gap-3 px-3 py-2 mt-4 rounded-md hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-colors">
              <Globe className="w-4 h-4" />
              Global Discover
            </Link>
          </nav>
        </div>
      </aside>

      <main className="flex-1 min-h-0 overflow-y-auto py-12 px-6 lg:px-12 relative bg-white dark:bg-zinc-950/30">
        <div className="max-w-5xl mx-auto">
          <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">My Courses</h1>
              <p className="text-zinc-500">Author and publish interactive music curriculums.</p>
            </div>
            
            <div className="flex items-center gap-4">
               <Button onClick={() => setIsCreateModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 h-11 shadow-lg shadow-indigo-500/20">
                 <Plus className="w-5 h-5 mr-2" />
                 New Course
               </Button>
            </div>
          </header>

          <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800/50 overflow-hidden shadow-sm">
            <div className="overflow-x-auto min-h-[60vh]">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-zinc-50 dark:bg-zinc-900/80 text-zinc-500 text-xs uppercase tracking-wider font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-4">Syllabus Title</th>
                    <th className="px-6 py-4">Price</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/50">
                  {loading ? (
                     <tr>
                        <td colSpan={4} className="py-12 text-center text-zinc-500 font-medium">Loading Author Curriculums...</td>
                     </tr>
                  ) : courses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-16 text-center">
                        <BookOpen className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">No Courses Created</h3>
                        <p className="text-zinc-500 max-w-sm mx-auto mb-6 whitespace-normal">
                          Open the Curriculum Builder to architect your first interactive EdTech module.
                        </p>
                        <Button onClick={() => setIsCreateModalOpen(true)} variant="outline" className="font-semibold text-zinc-900 dark:text-white rounded-full bg-white dark:bg-zinc-900">
                           <Plus className="w-4 h-4 mr-2" /> Draft First Course
                        </Button>
                      </td>
                    </tr>
                  ) : (
                    courses.map((course) => (
                      <tr key={course.$id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-6 py-4">
                           <div className="font-bold text-base text-zinc-900 dark:text-white mb-1">{course.title}</div>
                           <div className="text-xs text-zinc-500 w-48 truncate">{course.description || "Draft Lesson Module"}</div>
                        </td>
                        <td className="px-6 py-4">
                           <span className="font-medium text-zinc-900 dark:text-white">
                             {course.priceCents > 0 ? `$${(course.priceCents / 100).toFixed(2)}` : "Free"}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                           {course.published 
                              ? <span className="text-green-500 text-xs font-bold uppercase">Published</span>
                              : <span className="text-zinc-500 text-xs font-bold uppercase">Draft</span>
                           }
                        </td>
                        <td className="px-6 py-4 text-right">
                           {/* Quick Action Buttons for the Dashboard Admin */}
                           <div className="flex justify-end gap-2">
                              <Link href={`/dashboard/courses/${course.$id}/edit`}>
                                <Button disabled={deletingId === course.$id} variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-white hover:bg-zinc-800"><Settings className="w-4 h-4" /></Button>
                              </Link>
                              <Link href={`/c/${course.$id}`}>
                                <Button disabled={deletingId === course.$id} variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-white hover:bg-zinc-800"><PlaySquare className="w-4 h-4" /></Button>
                              </Link>
                              <Button 
                                onClick={() => handleDelete(course.$id, course.title)}
                                disabled={deletingId === course.$id} 
                                variant="ghost" 
                                size="icon" 
                                className="h-9 w-9 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                              >
                                {deletingId === course.$id ? <div className="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </Button>
                           </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Strict Course Shell Modal Overlay */}
      {isCreateModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden shadow-black/50">
               <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Create New Course Shell</h3>
                  <button onClick={() => setIsCreateModalOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
                     <X className="w-5 h-5" />
                  </button>
               </div>
               <form onSubmit={handleCreateCourse} className="p-6 flex flex-col gap-4">
                  <div>
                     <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Curriculum Title</label>
                     <input 
                        required
                        value={newCourseTitle}
                        onChange={(e) => setNewCourseTitle(e.target.value)}
                        placeholder="E.g., Piano Fundamentals Vol 1."
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 font-medium text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                     />
                  </div>
                  <div>
                     <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Pricing (USD)</label>
                     <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">$</span>
                        <input 
                           type="number"
                           step="0.01"
                           min="0"
                           value={newCoursePrice}
                           onChange={(e) => setNewCoursePrice(e.target.value)}
                           className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-8 pr-4 py-3 font-medium text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                     </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-4">
                     <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                     <Button type="submit" disabled={isCreating || !newCourseTitle.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold">
                        {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Proceed to Builder
                     </Button>
                  </div>
               </form>
            </div>
         </div>
      )}
    </div>
  );
}
