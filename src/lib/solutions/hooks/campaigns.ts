import { defineCapabilityHook } from "./mark-capability";

const hook = defineCapabilityHook({
  id: "campaigns",
  status: "platform_ready",
  notes: "Bulk campaign lists and outbound voice campaigns",
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
