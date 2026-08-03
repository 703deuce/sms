import { defineCapabilityHook, applyCapabilityDraftPatch } from "./mark-capability";

const PROPERTY_GUARDRAILS = `## Property management receptionist intake
- Always collect unit number and property address (or community name) before creating a maintenance request.
- Classify each request: maintenance (routine) vs emergency (active leak, no heat in freezing weather, gas smell, lockout with safety risk, fire/flood).
- For true emergencies, advise the caller on any posted emergency instructions and create an urgent task for on-call staff.
- Do not authorize repairs or promise vendor ETAs you cannot confirm — capture details and create_task.
- Confirm preferred access instructions and pet alerts when taking maintenance intake.`;

const hook = defineCapabilityHook({
  id: "property_management",
  status: "wizard_wired",
  notes:
    "Property intake (unit/address, maintenance vs emergency) + create_task; propertyReceptionist flag",
  onActivate: async (ctx) => {
    await applyCapabilityDraftPatch(ctx, "property_management", {
      instructionMarker: "## Property management receptionist intake",
      appendInstructions: PROPERTY_GUARDRAILS,
      enableTools: ["create_task", "take_structured_message", "mark_disposition", "save_caller_info"],
      advanced: {
        propertyReceptionist: true,
      },
      collectFields: [
        { id: "resident_name", label: "Resident name", enabled: true, required: true },
        { id: "callback_phone", label: "Callback phone", enabled: true, required: true },
        { id: "unit_number", label: "Unit number", enabled: true, required: true },
        { id: "property_address", label: "Property / community address", enabled: true, required: true },
        {
          id: "request_class",
          label: "Maintenance vs emergency",
          enabled: true,
          required: true,
        },
        { id: "issue_description", label: "Issue description", enabled: true, required: true },
        { id: "access_notes", label: "Access / pet notes", enabled: true, required: false },
      ],
      postCall: {
        extractionFieldsExtra: [
          "unit_number",
          "property_address",
          "request_class",
          "issue_description",
          "emergency",
        ],
      },
    });
  },
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
