import { defineCapabilityHook } from "./mark-capability";

const hook = defineCapabilityHook({
  id: "reviews",
  status: "planned",
  notes: "Review-request follow-up after positive outcomes (stub)",
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
