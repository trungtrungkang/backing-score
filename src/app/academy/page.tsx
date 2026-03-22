import { getPublishedCourses } from "@/lib/appwrite/courses";
import Link from "next/link";
import { GraduationCap, PlayCircle, Star, Users } from "lucide-react";

export default async function AcademyStorefrontPage() {
  const publishedCourses = await getPublishedCourses();

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-[#0A0A0A] text-zinc-900 dark:text-white pb-24 font-sans">
      
      {/* 1. Hero Header Banner */}
      <section className="relative w-full py-20 bg-white dark:bg-[#121214] border-b border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none rounded-full blur-[100px]" />
        
        <div className="relative z-10 max-w-4xl px-6">
          <div className="flex justify-center mb-6">
             <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-xl shadow-blue-500/20">
               <GraduationCap className="w-8 h-8 text-white" />
             </div>
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 mb-6">
            Welcome to the <br className="hidden sm:block" /> Backing Score Academy
          </h1>
          <p className="text-lg sm:text-xl text-zinc-500 max-w-2xl mx-auto">
            Interactive courses combining rigorous music theory with live web-audio validation. Pluck a note. Crush the Wait Mode. Level up your skills.
          </p>
        </div>
      </section>

      {/* 2. Course Library Grid */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-16">
        <div className="flex flex-col gap-3 mb-10 items-start">
           <h2 className="text-2xl font-bold tracking-tight">Featured Courses</h2>
           <span className="text-sm font-semibold text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-3 py-1 rounded-full w-fit">
             {publishedCourses.length} Courses Available
           </span>
        </div>
        
        {publishedCourses.length === 0 ? (
          <div className="w-full py-32 flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
             <GraduationCap className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
             <h3 className="text-lg font-bold text-zinc-500">No courses available yet</h3>
             <p className="text-sm text-zinc-400">Creators are hard at work building new curriculums.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {publishedCourses.map((course) => (
              <div 
                key={course.$id} 
                className="group relative bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl shadow-zinc-200/50 dark:hover:shadow-blue-500/10 flex flex-col h-full"
              >
                {/* Thumbnail Layer */}
                <div className="aspect-video w-full bg-zinc-100 dark:bg-zinc-900 relative overflow-hidden flex items-center justify-center shrink-0">
                  <PlayCircle className="w-12 h-12 text-zinc-300 dark:text-zinc-700 group-hover:scale-110 group-hover:text-blue-500 transition-all duration-500" />
                </div>
                
                {/* Content Layer */}
                <div className="p-5 sm:p-6 flex flex-col flex-1">
                  {/* Tags */}
                  <div className="flex items-center gap-2 mb-3">
                     <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded">Music Theory</span>
                     <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded">Beginner</span>
                  </div>
                  
                  <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-2 group-hover:text-blue-500 transition-colors line-clamp-2">
                    {course.title}
                  </h3>
                  <p className="text-sm text-zinc-500 line-clamp-2 mb-6 h-10">
                    {course.description || "Master the foundations of musical physics entirely in your browser."}
                  </p>
                  <div className="flex-1"></div>
                  
                  {/* Pricing & Call to Action */}
                  <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Tuition</span>
                      <span className="text-lg font-black text-zinc-900 dark:text-white">
                        {course.priceCents > 0 ? `$${(course.priceCents / 100).toFixed(2)}` : "Free"}
                      </span>
                    </div>
                    
                    {/* The magical portal routing directly into Phase 4's Grid Array! */}
                    <Link href={`/c/${course.$id}`}>
                      <button className="bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors shadow-md">
                        Enroll Now
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </main>
  );
}
