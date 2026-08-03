import { defineCapabilityHook } from "./mark-capability";

const hook = defineCapabilityHook({
  id: "payments",
  status: "planned",
  notes: "Payment collection during/after calls (stub)",
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
