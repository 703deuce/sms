import { defineCapabilityHook } from "./mark-capability";

const hook = defineCapabilityHook({
  id: "lead_qualification",
  status: "wizard_wired",
  notes: "Qualify callers before booking/transfer; scoring via postCall rules",
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
