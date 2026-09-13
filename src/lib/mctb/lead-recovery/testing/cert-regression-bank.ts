/**
 * Permanent regression scenarios discovered during DeepSeek certification.
 * Do not delete to greenwash — tighten assertions only when product intent changes.
 */
import type { IntentCertScenario } from "@/lib/mctb/lead-recovery/testing/cert-scenarios";

export const REGRESSION_BANK: IntentCertScenario[] = [
  {
    id: "regression-hours-secondary",
    category: "BUSINESS_HOURS",
    message: "What time do you close?",
    expectPrimary: ["BUSINESS_HOURS", "GENERAL_INQUIRY", "BUSINESS_FAQ"],
    expectSecondary: ["BUSINESS_HOURS"],
    preferLlm: true,
  },
  {
    id: "regression-urgent-not-emergency",
    category: "URGENT",
    message: "I really need this fixed soon, it's been two days.",
    expectPrimary: ["SERVICE_REQUEST", "BOOKING_REQUEST", "EMERGENCY_OR_URGENT"],
    preferLlm: true,
  },
];
