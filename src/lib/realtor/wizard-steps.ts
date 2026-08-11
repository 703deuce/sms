import type { RealtorAmyMode, RealtorOnboardingStep, RealtorProductConfig } from "./types";
import { DEFAULT_REALTOR_PRODUCT_CONFIG } from "./types";

function hasFrontDesk(mode: RealtorAmyMode): boolean {
  return mode === "front_desk" || mode === "both";
}

function hasSpeedToLead(mode: RealtorAmyMode): boolean {
  return mode === "speed_to_lead" || mode === "both";
}

export function configNeedsBooking(config: RealtorProductConfig): boolean {
  if (hasFrontDesk(config.amyMode)) {
    const fd = Object.values(config.frontDesk).some(
      (i) => i.enabled && i.qualifiedOutcome === "book",
    );
    if (fd) return true;
  }
  if (hasSpeedToLead(config.amyMode) && config.speedToLead.qualifiedOutcome === "book") {
    return true;
  }
  return false;
}

export function configNeedsTransfer(config: RealtorProductConfig): boolean {
  if (hasFrontDesk(config.amyMode)) {
    if (Object.values(config.frontDesk).some((i) => i.enabled && i.qualifiedOutcome === "transfer")) {
      return true;
    }
  }
  return false;
}

/** Progressive disclosure — only steps relevant to current config. */
export function onboardingStepsForConfig(config: RealtorProductConfig): RealtorOnboardingStep[] {
  const steps: RealtorOnboardingStep[] = ["intent", "business", "phone"];

  if (hasSpeedToLead(config.amyMode)) {
    steps.push("lead_sources");
  }

  if (configNeedsBooking(config)) {
    steps.push("calendar");
  }

  if (hasFrontDesk(config.amyMode)) {
    steps.push("front_desk_capabilities");
    if (config.frontDesk.buyer.enabled) steps.push("buyer_qualification");
    if (config.frontDesk.seller.enabled) steps.push("seller_qualification");
    if (config.frontDesk.showing.enabled) steps.push("showing_config");
    if (config.frontDesk.existingClient.enabled) steps.push("existing_client_config");
    if (config.frontDesk.agentToAgent.enabled) steps.push("agent_to_agent_config");
  }

  if (hasSpeedToLead(config.amyMode)) {
    steps.push("speed_lead_types");
    if (config.speedToLead.buyerQualification) steps.push("outbound_buyer_qual");
    if (config.speedToLead.sellerQualification) steps.push("outbound_seller_qual");
    steps.push("first_call_timing", "follow_up");
    if (config.speedToLead.useRecommendedFollowUp) steps.push("sms_email");
    steps.push("notifications");
  }

  if (configNeedsBooking(config)) steps.push("booking");
  if (configNeedsTransfer(config)) steps.push("transfers");

  steps.push("knowledge", "voice", "review", "test", "go_live");
  return steps;
}

export const STEP_LABELS: Record<RealtorOnboardingStep, string> = {
  intent: "What Amy does",
  business: "Identity & business",
  phone: "Phone",
  lead_sources: "Lead sources",
  calendar: "Appointment types",
  front_desk_capabilities: "What Amy handles",
  buyer_qualification: "Buyer questions",
  seller_qualification: "Seller questions",
  showing_config: "Showing behavior",
  existing_client_config: "Existing clients",
  agent_to_agent_config: "Other Realtors",
  speed_lead_types: "Lead types",
  outbound_buyer_qual: "Outbound buyer questions",
  outbound_seller_qual: "Outbound seller questions",
  first_call_timing: "First-call timing",
  follow_up: "Retry & follow-up",
  sms_email: "SMS & email follow-up",
  booking: "Booking",
  transfers: "Transfers",
  knowledge: "Knowledge",
  voice: "Voice",
  notifications: "Notifications",
  review: "Review",
  test: "Test Amy",
  go_live: "Activate",
};

export function onboardingStepsForMode(amyMode: RealtorAmyMode): RealtorOnboardingStep[] {
  return onboardingStepsForConfig({ ...DEFAULT_REALTOR_PRODUCT_CONFIG, amyMode });
}
