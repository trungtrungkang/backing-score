import { account } from "./client";
import { isAppwriteConfigured } from "./constants";
import * as D1 from "@/app/actions/v5/submission-feedback";

async function getUserIdFallback() {
  if (!isAppwriteConfigured()) return undefined;
  try {
    const user = await account.get();
    return user.$id;
  } catch {
    return undefined;
  }
}

export async function createFeedback(params: any) {
  return D1.createFeedbackV5(params, await getUserIdFallback());
}

export async function listFeedback(submissionId: string) {
  return D1.listFeedbackV5(submissionId, await getUserIdFallback());
}

export async function updateFeedback(feedbackId: string, updates: any) {
  return D1.updateFeedbackV5(feedbackId, updates, await getUserIdFallback());
}

export async function deleteFeedback(feedbackId: string) {
  return D1.deleteFeedbackV5(feedbackId, await getUserIdFallback());
}
