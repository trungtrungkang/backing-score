import { getCourseById } from "@/lib/appwrite/courses";
import { getLessonsByCourse, getLessonById } from "@/lib/appwrite/lessons";
import { redirect } from "next/navigation";
import { LessonActiveClient } from "./LessonActiveClient";

export default async function LessonActivePage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  
  const course = await getCourseById(courseId);
  if (!course) redirect("/404");

  const lessons = await getLessonsByCourse(courseId);
  const activeLesson = await getLessonById(lessonId);
  
  if (!activeLesson) redirect(`/c/${courseId}`);

  return (
    <LessonActiveClient 
      course={JSON.parse(JSON.stringify(course))} 
      lessons={JSON.parse(JSON.stringify(lessons))} 
      activeLesson={JSON.parse(JSON.stringify(activeLesson))} 
    />
  );
}
