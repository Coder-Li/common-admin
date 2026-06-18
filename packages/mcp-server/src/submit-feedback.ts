import {
  createFeedbackIssueDraft,
  type FeedbackDraftInput,
  type FeedbackIssueDraft
} from "@common-admin/feedback-draft";

export type SubmitFeedbackInput = FeedbackDraftInput;

export type SubmitFeedbackResult = {
  content: Array<{
    type: "text";
    text: string;
  }>;
  structuredContent: FeedbackIssueDraft;
};

export function submitFeedback(input: SubmitFeedbackInput): SubmitFeedbackResult {
  const draft = createFeedbackIssueDraft(input);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(draft, null, 2)
      }
    ],
    structuredContent: draft
  };
}
