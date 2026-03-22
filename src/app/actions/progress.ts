"use server";

import { revalidatePath } from "next/cache";

/**
 * Server Action purely to purge the Next.js cache 
 * so the Learner's side-bar lock icons immediately re-render correctly.
 */
export async function revalidateProgressCache() {
  try {
    revalidatePath(`/c/[courseId]`, 'page');
    revalidatePath(`/dashboard`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to revalidate cache:", error);
    return { success: false, error: error.message };
  }
}
