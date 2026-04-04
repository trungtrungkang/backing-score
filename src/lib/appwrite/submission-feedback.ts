import * as D1 from "@/app/actions/v5/submission-feedback";

export async function createFeedback(params: any) {
  return D1.createFeedbackV5(params, undefined);
}

export async function listFeedback(submissionId: string) {
  return D1.listFeedbackV5(submissionId, undefined);
}

export async function updateFeedback(feedbackId: string, updates: any) {
  return D1.updateFeedbackV5(feedbackId, updates, undefined);
}

export async function deleteFeedback(feedbackId: string) {
  return D1.deleteFeedbackV5(feedbackId, undefined);
}
