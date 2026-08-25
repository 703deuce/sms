import { defineCapabilityHook } from "./mark-capability";

const hook = defineCapabilityHook({
  id: "customer_support",
  status: "wizard_wired",
  notes: "Support-oriented instructions + message taking / CRM lookup",
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
