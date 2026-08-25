import { defineCapabilityHook } from "./mark-capability";

const hook = defineCapabilityHook({
  id: "overflow",
  status: "wizard_wired",
  notes: "Ring-team-first / nobody_answers / line_busy overflow answering",
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
