/**
 * Port-out destination rules — separate from provider routing.
 */

export const PORT_OUT_DESTINATION_TYPES = [
  "verizon",
  "att",
  "t_mobile",
  "google_voice_personal",
  "cricket",
  "traditional_landline",
  "regional_carrier",
  "other_voip",
  "other",
] as const;

export type PortOutDestinationType = (typeof PORT_OUT_DESTINATION_TYPES)[number];

export type PortOutDestinationRule = {
  destination: PortOutDestinationType;
  label: string;
  directPortSupport: "supported" | "risky" | "unsupported";
  warningType: "none" | "compatibility" | "intermediary" | "unsupported";
  warningMessage: string | null;
  requiresCompatibilityCheck: boolean;
  intermediaryRequired: boolean;
  portabilityGuaranteeEligible: boolean;
};

export const PORT_OUT_DESTINATION_RULES: PortOutDestinationRule[] = [
  {
    destination: "verizon",
    label: "Verizon",
    directPortSupport: "supported",
    warningType: "none",
    warningMessage: null,
    requiresCompatibilityCheck: false,
    intermediaryRequired: false,
    portabilityGuaranteeEligible: true,
  },
  {
    destination: "att",
    label: "AT&T",
    directPortSupport: "supported",
    warningType: "none",
    warningMessage: null,
    requiresCompatibilityCheck: false,
    intermediaryRequired: false,
    portabilityGuaranteeEligible: true,
  },
  {
    destination: "t_mobile",
    label: "T-Mobile",
    directPortSupport: "supported",
    warningType: "none",
    warningMessage: null,
    requiresCompatibilityCheck: false,
    intermediaryRequired: false,
    portabilityGuaranteeEligible: true,
  },
  {
    destination: "google_voice_personal",
    label: "Google Voice (Personal)",
    directPortSupport: "risky",
    warningType: "intermediary",
    warningMessage:
      "Google Voice Personal generally expects an eligible U.S. mobile number. You may need to port Transovo → wireless carrier → Google Voice. This is a known destination limitation, not a problem with your Transovo number.",
    requiresCompatibilityCheck: true,
    intermediaryRequired: true,
    portabilityGuaranteeEligible: false,
  },
  {
    destination: "cricket",
    label: "Cricket",
    directPortSupport: "unsupported",
    warningType: "unsupported",
    warningMessage:
      "Direct port to Cricket is often not supported for VoIP and wireline-style numbers. We do not guarantee a direct port to Cricket. Consider a major wireless carrier first.",
    requiresCompatibilityCheck: true,
    intermediaryRequired: false,
    portabilityGuaranteeEligible: true,
  },
  {
    destination: "traditional_landline",
    label: "Traditional landline",
    directPortSupport: "risky",
    warningType: "compatibility",
    warningMessage:
      "Compatibility should be confirmed with your landline carrier. Rate-center support can matter for these destinations.",
    requiresCompatibilityCheck: true,
    intermediaryRequired: false,
    portabilityGuaranteeEligible: true,
  },
  {
    destination: "regional_carrier",
    label: "Regional / local carrier",
    directPortSupport: "risky",
    warningType: "compatibility",
    warningMessage:
      "Compatibility should be confirmed with your regional carrier. Rate-center support can matter.",
    requiresCompatibilityCheck: true,
    intermediaryRequired: false,
    portabilityGuaranteeEligible: true,
  },
  {
    destination: "other_voip",
    label: "Other VoIP provider",
    directPortSupport: "supported",
    warningType: "compatibility",
    warningMessage: "Confirm your VoIP provider can accept ported local numbers before starting.",
    requiresCompatibilityCheck: true,
    intermediaryRequired: false,
    portabilityGuaranteeEligible: true,
  },
  {
    destination: "other",
    label: "Other",
    directPortSupport: "risky",
    warningType: "compatibility",
    warningMessage: "Confirm portability with your destination carrier before relying on a direct transfer.",
    requiresCompatibilityCheck: true,
    intermediaryRequired: false,
    portabilityGuaranteeEligible: true,
  },
];

export function getDestinationRule(
  destination: string | null | undefined,
): PortOutDestinationRule | null {
  const key = destination?.trim().toLowerCase();
  if (!key) return null;
  return PORT_OUT_DESTINATION_RULES.find((r) => r.destination === key) ?? null;
}

export function destinationLabel(destination: string | null | undefined): string {
  const rule = getDestinationRule(destination);
  if (rule) return rule.label;
  return destination?.trim() || "Unknown";
}
