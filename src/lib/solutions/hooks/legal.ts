import { defineCapabilityHook } from "./mark-capability";

const hook = defineCapabilityHook({
  id: "legal",
  status: "planned",
  notes: "Legal intake / conflict-check receptionist variant (stub)",
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
