import { defineCapabilityHook, applyCapabilityDraftPatch } from "./mark-capability";

const MEDICAL_GUARDRAILS = `## Medical receptionist guardrails
- Do not provide medical diagnosis, treatment recommendations, or interpret clinical results.
- For emergencies (chest pain, difficulty breathing, severe bleeding, stroke symptoms, overdose), tell the caller to hang up and dial emergency services (911 in the US) immediately — then offer to notify on-call staff if configured.
- Protect patient privacy: do not read back sensitive health details to unverified callers; collect only what staff need for a callback.
- Restrict knowledge answers to office logistics (hours, location, insurance accepted list if present, appointment types). Never invent clinical advice.
- Use take_structured_message for symptom/reason intake when booking is not appropriate.`;

const hook = defineCapabilityHook({
  id: "medical",
  status: "wizard_wired",
  notes:
    "HIPAA-aware guardrails + medicalReceptionist advanced flag; structured message intake + compliance",
  onActivate: async (ctx) => {
    await applyCapabilityDraftPatch(ctx, "medical", {
      instructionMarker: "## Medical receptionist guardrails",
      appendInstructions: MEDICAL_GUARDRAILS,
      enableTools: ["take_structured_message", "create_task", "mark_disposition"],
      compliance: {
        hipaaAware: true,
        medicalReceptionist: true,
        noDiagnosis: true,
        emergencyDisclaimer: true,
        privacyRestricted: true,
      },
      advanced: {
        medicalReceptionist: true,
      },
      collectFields: [
        { id: "patient_name", label: "Patient name", enabled: true, required: true },
        { id: "callback_phone", label: "Callback phone", enabled: true, required: true },
        { id: "reason_for_call", label: "Reason for call", enabled: true, required: true },
        { id: "urgency", label: "Urgency", enabled: true, required: false },
        { id: "dob_last4", label: "DOB or last-4 for verification", enabled: true, required: false },
      ],
      postCall: {
        extractionFieldsExtra: [
          "patient_name",
          "reason_for_call",
          "urgency",
          "emergency_redirected",
        ],
      },
    });
  },
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
