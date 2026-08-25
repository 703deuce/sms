import { defineCapabilityHook, applyCapabilityDraftPatch } from "./mark-capability";
import { resolveReviewLink } from "@/lib/messaging/review-link";

const REVIEW_INSTRUCTIONS = `## Review requests
- After a clearly positive outcome (appointment booked, issue resolved, compliment), you may mention that a review link can be sent after the call.
- Do not pressure the caller. Skip review asks when the caller is upset, hurried, or the outcome was negative.
- Prefer post-call SMS/automation using the configured review link — do not invent a review URL on the call.`;

const hook = defineCapabilityHook({
  id: "reviews",
  status: "platform_ready",
  notes:
    "advanced.reviewRequests with reviewLink placeholder + post-call note; uses workspace review link",
  onActivate: async (ctx) => {
    const reviewLink = await resolveReviewLink(ctx.workspaceId);

    await applyCapabilityDraftPatch(ctx, "reviews", {
      instructionMarker: "## Review requests",
      appendInstructions: REVIEW_INSTRUCTIONS,
      enableTools: ["send_sms", "create_task", "mark_disposition"],
      advanced: {
        reviewRequests: {
          enabled: true,
          reviewLink: reviewLink || "https://example.com/review",
          postCallNote: true,
          /** Align with messaging/appointment-completed automations when configured. */
          triggerOnPositiveOutcome: true,
        },
      },
      messaging: {
        reviewRequests: true,
        reviewLinkUrl: reviewLink || null,
      },
      postCall: {
        reviewRequestEnabled: true,
        extractionFieldsExtra: ["review_offered", "sentiment", "outcome"],
      },
    });
  },
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
