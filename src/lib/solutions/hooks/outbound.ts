import { defineCapabilityHook } from "./mark-capability";

const hook = defineCapabilityHook({
  id: "outbound",
  status: "platform_ready",
  notes: "Outbound dialing / AMD — platform campaigns & call-service ready",
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
