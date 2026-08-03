import { defineCapabilityHook } from "./mark-capability";

const hook = defineCapabilityHook({
  id: "missed_call",
  status: "wizard_wired",
  notes: "Missed-call text-back receptionist stub — SMS follow-up on miss",
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
