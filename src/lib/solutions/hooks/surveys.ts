import { defineCapabilityHook } from "./mark-capability";

const hook = defineCapabilityHook({
  id: "surveys",
  status: "planned",
  notes: "Post-call / IVR survey agent (stub)",
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
