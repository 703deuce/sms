import { defineCapabilityHook, applyCapabilityDraftPatch } from "./mark-capability";

const LEGAL_GUARDRAILS = `## Legal intake receptionist guardrails
- Do not give legal advice, interpret statutes, or predict case outcomes.
- Collect conflict-check intake only: matter type, opposing parties if known, jurisdiction, urgency, and callback details.
- Treat all caller information as confidential. Do not disclose whether someone is or is not a client.
- If the caller asks for advice, explain you can only take intake and schedule a consultation with an attorney.
- Use take_structured_message / create_task so staff can run conflicts before any substantive conversation.`;

const hook = defineCapabilityHook({
  id: "legal",
  status: "wizard_wired",
  notes:
    "No-advice guardrails + legalReceptionist; conflict-check collectFields (matter/jurisdiction/urgency)",
  onActivate: async (ctx) => {
    await applyCapabilityDraftPatch(ctx, "legal", {
      instructionMarker: "## Legal intake receptionist guardrails",
      appendInstructions: LEGAL_GUARDRAILS,
      enableTools: ["take_structured_message", "create_task", "mark_disposition", "save_caller_info"],
      compliance: {
        legalIntakeOnly: true,
        noLegalAdvice: true,
        confidentiality: true,
      },
      advanced: {
        legalReceptionist: true,
      },
      collectFields: [
        { id: "caller_name", label: "Caller name", enabled: true, required: true },
        { id: "callback_phone", label: "Callback phone", enabled: true, required: true },
        { id: "matter_type", label: "Matter type", enabled: true, required: true },
        { id: "jurisdiction", label: "Jurisdiction", enabled: true, required: true },
        { id: "urgency", label: "Urgency", enabled: true, required: true },
        { id: "opposing_parties", label: "Opposing parties (conflict check)", enabled: true, required: false },
        { id: "brief_summary", label: "Brief non-privileged summary", enabled: true, required: false },
      ],
      postCall: {
        extractionFieldsExtra: [
          "matter_type",
          "jurisdiction",
          "urgency",
          "opposing_parties",
          "conflict_check_needed",
        ],
      },
    });
  },
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
