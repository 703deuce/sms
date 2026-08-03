import { defineCapabilityHook, applyCapabilityDraftPatch } from "./mark-capability";

const SURVEY_INSTRUCTIONS = `## Post-call survey offer
- Near the end of a successful call, optionally offer a short satisfaction survey (one or two questions).
- Keep it brief and skip immediately if the caller declines or is in a hurry.
- Record ratings and free-text comments via mark_disposition / create_task tags when surveyMode is enabled.
- Do not delay urgent transfers or emergency handling for a survey.`;

const hook = defineCapabilityHook({
  id: "surveys",
  status: "platform_ready",
  notes: "advanced.surveyMode with post-call survey flag + optional end-of-call survey offer",
  onActivate: async (ctx) => {
    await applyCapabilityDraftPatch(ctx, "surveys", {
      instructionMarker: "## Post-call survey offer",
      appendInstructions: SURVEY_INSTRUCTIONS,
      enableTools: ["mark_disposition", "create_task", "update_contact_tags", "end_call"],
      advanced: {
        surveyMode: {
          enabled: true,
          postCallSurvey: true,
          offerAtEndOfCall: true,
          maxQuestions: 2,
        },
      },
      postCall: {
        surveyEnabled: true,
        extractionFieldsExtra: ["survey_offered", "survey_completed", "survey_score", "survey_comment"],
      },
    });
  },
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
