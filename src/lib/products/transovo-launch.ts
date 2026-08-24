/**
 * Launch UX flags — preserve advanced/phone-system features in code but keep them
 * out of the default customer-facing product until explicitly enabled.
 */

function envTrue(name: string): boolean {
  return process.env[name] === "1" || process.env[name] === "true";
}

/** Default launch posture: simplified inbound routing product, not full phone system. */
export function isTransovoLaunchMode(): boolean {
  return process.env.TRANSOVO_LAUNCH_MODE !== "0";
}

/** Live AI receptionist call-handling node in flow builder (not the routing config assistant). */
export function showAiReceptionistNode(): boolean {
  return envTrue("TRANSOVO_SHOW_AI_RECEPTIONIST") || envTrue("NEXT_PUBLIC_TRANSOVO_SHOW_AI_RECEPTIONIST");
}

/** AI Routing Assistant nav entry (`/smart-routing/ai`) — config helper, not live call handling. */
export function showAiRoutingAssistantInNav(): boolean {
  if (!isTransovoLaunchMode()) return true;
  if (process.env.TRANSOVO_HIDE_AI_ROUTING_ASSISTANT_NAV === "1") return false;
  return true;
}

/**
 * Business call-back (authorized callers + outbound bridge) is core Smart Routing —
 * employees return calls with verified business caller ID, not personal cells.
 */
export function showSrBusinessCallBack(): boolean {
  return true;
}

/** Standalone audio library nav — prefer contextual links inside flows. */
export function showSrAudioInNav(): boolean {
  if (!isTransovoLaunchMode()) return true;
  return envTrue("TRANSOVO_SHOW_SR_AUDIO_NAV");
}

/** Grandfather existing workspaces to active entitlements during commercial migration. */
export function transovoEntitlementGrandfatherEnv(): boolean {
  return envTrue("TRANSOVO_ENTITLEMENT_GRANDFATHER");
}
