import { defineCapabilityHook } from "./mark-capability";

const hook = defineCapabilityHook({
  id: "medical",
  status: "planned",
  notes: "HIPAA-aware medical receptionist variant (stub)",
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
