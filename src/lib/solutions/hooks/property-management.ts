import { defineCapabilityHook } from "./mark-capability";

const hook = defineCapabilityHook({
  id: "property_management",
  status: "planned",
  notes: "Property management / maintenance request receptionist (stub)",
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
