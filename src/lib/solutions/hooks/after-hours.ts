import { defineCapabilityHook } from "./mark-capability";

const hook = defineCapabilityHook({
  id: "after_hours",
  status: "wizard_wired",
  notes: "Answer-when after_hours / custom_schedule; ring behavior after hours",
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
