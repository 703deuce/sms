import { defineCapabilityHook } from "./mark-capability";

const hook = defineCapabilityHook({
  id: "reminders",
  status: "planned",
  notes: "Appointment reminder outbound / SMS (stub)",
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
