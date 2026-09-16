/**
 * Shared helpers for Voice V2 wizard UI certification (production, API-only).
 */

export const STRATEGY_LABELS = {
  MICROSOFT_365: "Book an appointment for them",
  CALENDLY: "Book appointments with Calendly",
  REQUEST_ONLY: "Take their preferred time and have us confirm it",
  SEND_LINK: "Send our booking link",
  NONE: "Take a message / have us follow up",
};

export function wizardFromAgent(agent) {
  return agent?.draftConfig?.advanced?.appointmentReceptionistWizard || {};
}

export function resolveBookingStrategy(agent, setupState) {
  const adv = agent?.draftConfig?.advanced || {};
  const pinned = String(adv.bookingStrategy || "").trim();
  const strategies = ["NONE", "REQUEST_ONLY", "SEND_LINK", "MICROSOFT_365", "CALENDLY"];
  if (strategies.includes(pinned)) return pinned;
  const w = wizardFromAgent(agent);
  if (w.bookingStrategy && strategies.includes(w.bookingStrategy)) return w.bookingStrategy;
  if (setupState?.bookingStrategy && strategies.includes(setupState.bookingStrategy)) {
    return setupState.bookingStrategy;
  }
  if (adv.voiceV2PstnLiveBooking === true) return "MICROSOFT_365";
  return "NONE";
}

/** Mirrors buildVoiceV2CallCapabilitySnapshot tool flags (config-only). */
export function capabilityFromStrategy(strategy) {
  const live = strategy === "MICROSOFT_365" || strategy === "CALENDLY";
  const oneAmy =
    strategy === "MICROSOFT_365" ||
    strategy === "CALENDLY" ||
    strategy === "REQUEST_ONLY" ||
    strategy === "SEND_LINK" ||
    strategy === "NONE";
  return {
    bookingStrategy: strategy,
    findToolAvailable: live,
    bookToolAvailable: live,
    intakeToolAvailable: oneAmy,
    finalizeToolAvailable: oneAmy && strategy !== "SEND_LINK",
    sendBookingLinkToolAvailable: strategy === "SEND_LINK",
  };
}

export function toolsFromDraftConfig(agent) {
  const cfg = agent?.draftConfig || {};
  const names = [];
  const tools = cfg.tools;
  if (Array.isArray(tools)) {
    for (const t of tools) names.push(String(t?.name || t?.id || ""));
  }
  const builtins = cfg.enabledBuiltinTools;
  if (Array.isArray(builtins)) {
    for (const t of builtins) names.push(String(t));
  }
  return names.filter(Boolean);
}

export function toolEligibilityPass(strategy, toolNames) {
  const cap = capabilityFromStrategy(strategy);
  const hasFind = toolNames.some((n) =>
    /voice_v2_find_availability|calendar_availability/i.test(n),
  );
  const hasBook = toolNames.some((n) =>
    /voice_v2_book_offered_slot|book_appointment/i.test(n),
  );
  const hasSendLink = toolNames.some((n) => /voice_v2_send_booking_link/i.test(n));

  if (strategy === "NONE" || strategy === "REQUEST_ONLY") {
    return !hasFind && !hasBook ? "PASS" : "FAIL";
  }
  if (strategy === "SEND_LINK") {
    return hasSendLink && !hasFind && !hasBook ? "PASS" : "FAIL";
  }
  if (strategy === "MICROSOFT_365" || strategy === "CALENDLY") {
    return hasFind && hasBook ? "PASS" : "FAIL";
  }
  return cap.findToolAvailable === hasFind && cap.bookToolAvailable === hasBook ? "PASS" : "FAIL";
}

export function layerBContains(agent, needle) {
  const cfg = agent?.draftConfig || {};
  const dyn = cfg.dynamicVariables || {};
  const sys = String(cfg.systemPrompt || "");
  const adv = cfg.advanced || {};
  const w = adv.appointmentReceptionistWizard || {};
  const blob = JSON.stringify({ dyn, w, sys }).toLowerCase();
  return blob.includes(String(needle).toLowerCase());
}

export function intakeFieldIds(agent) {
  const v2 = agent?.draftConfig?.advanced?.voiceV2Intake;
  if (v2?.fields && typeof v2.fields === "object") return Object.keys(v2.fields);
  const collect = wizardFromAgent(agent).collectFields || [];
  return collect.map((f) => f.id).filter(Boolean);
}
