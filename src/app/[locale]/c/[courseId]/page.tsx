import { getCourseById } from "@/app/actions/v5/courses";
import { getLessonsByCourse } from "@/app/actions/v5/lessons";
import { redirect } from "next/navigation";
import { CourseGatewayClient } from "./CourseGatewayClient";

// This page requires authentication — always render dynamically on the server
// so that cookies/headers (used by Appwrite auth) are available at request time.
export const dynamic = "force-dynamic";

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
