import { getCourseById, getPublishedCourses } from "@/lib/appwrite/courses";
import { getLessonsByCourse } from "@/lib/appwrite/lessons";
import { redirect } from "next/navigation";
import { CourseGatewayClient } from "./CourseGatewayClient";

export default async function CourseGatewayPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  
  const course = await getCourseById(courseId);
  if (!course) redirect("/404");

  const lessons = await getLessonsByCourse(courseId);

  return (
     <CourseGatewayClient 
        course={JSON.parse(JSON.stringify(course))} 
        lessons={JSON.parse(JSON.stringify(lessons))} 
     />
  );
}

// Ensure statically rendering parameters via ISR compilation
export async function generateStaticParams() {
   const courses = await getPublishedCourses();
   return courses.map((course) => ({
      courseId: course.$id,
   }));
}
