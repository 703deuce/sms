export type RealtorAmyMode = "front_desk" | "speed_to_lead" | "both";

export type RealtorOnboardingStep =
  | "intent"
  | "business"
  | "phone"
  | "lead_sources"
  | "calendar"
  | "ai_setup"
  | "follow_up"
  | "test"
  | "go_live";

export type RealtorQualifiedOutcome = "book" | "transfer" | "notify" | "message";

export type RealtorBusinessConfig = {
  teamName?: string;
  brokerage?: string;
  website?: string;
  officePhone?: string;
  serviceAreas?: string[];
  businessHours?: string;
  timezone?: string;
  teamType?: "solo" | "team";
};

export type RealtorPhoneConfig = {
  mode?: "transovo_number" | "forward" | "port";
  inboundHours?: "always" | "after_hours" | "overflow";
  transferNumber?: string;
  outboundNumberE164?: string;
};

export type RealtorIntentFieldToggle = {
  fieldId: string;
  enabled: boolean;
  required: boolean;
};

export type RealtorIntentConfig = {
  enabled: boolean;
  fields: RealtorIntentFieldToggle[];
  qualifiedOutcome: RealtorQualifiedOutcome;
};

export type RealtorProductConfig = {
  version: 1;
  enabled: boolean;
  onboardingComplete: boolean;
  live: boolean;
  amyMode: RealtorAmyMode;
  currentStep: RealtorOnboardingStep;
  business: RealtorBusinessConfig;
  phone: RealtorPhoneConfig;
  leadSources: string[];
  appointmentTypes: string[];
  frontDesk: {
    buyer: RealtorIntentConfig;
    seller: RealtorIntentConfig;
    showing: RealtorIntentConfig;
    existingClient: RealtorIntentConfig;
    agentToAgent: RealtorIntentConfig;
    general: RealtorIntentConfig;
  };
  speedToLead: {
    callImmediately: boolean;
    buyerQualification: boolean;
    sellerQualification: boolean;
    qualifiedOutcome: RealtorQualifiedOutcome;
    useRecommendedFollowUp: boolean;
  };
  deployedAgentId?: string;
  deployedOutboundAgentId?: string;
  followUpAutomationId?: string;
  deployedAt?: string;
  /** Maps appointment type label → Calendly event type URI or slug */
  calendlyEventMappings?: Record<string, string>;
};

export const DEFAULT_REALTOR_PRODUCT_CONFIG: RealtorProductConfig = {
  version: 1,
  enabled: false,
  onboardingComplete: false,
  live: false,
  amyMode: "both",
  currentStep: "intent",
  business: {
    teamType: "solo",
    timezone: "America/New_York",
    serviceAreas: ["Woodbridge", "Stafford", "Fredericksburg"],
  },
  phone: { mode: "transovo_number", inboundHours: "after_hours" },
  leadSources: [],
  appointmentTypes: [
    "Buyer Consultation",
    "Seller Consultation",
    "Listing Appointment",
    "Phone Call",
    "Showing Request",
  ],
  frontDesk: {
    buyer: {
      enabled: true,
      qualifiedOutcome: "book",
      fields: [
        { fieldId: "target_areas", enabled: true, required: true },
        { fieldId: "property_type", enabled: true, required: true },
        { fieldId: "budget_or_price_range", enabled: true, required: true },
        { fieldId: "purchase_timeframe", enabled: true, required: true },
        { fieldId: "bedrooms", enabled: true, required: false },
        { fieldId: "preapproval_status", enabled: true, required: false },
      ],
    },
    seller: {
      enabled: true,
      qualifiedOutcome: "notify",
      fields: [
        { fieldId: "property_address", enabled: true, required: true },
        { fieldId: "reason_for_selling", enabled: true, required: true },
        { fieldId: "desired_timeline", enabled: true, required: true },
      ],
    },
    showing: { enabled: true, qualifiedOutcome: "book", fields: [] },
    existingClient: { enabled: true, qualifiedOutcome: "transfer", fields: [] },
    agentToAgent: { enabled: true, qualifiedOutcome: "message", fields: [] },
    general: { enabled: true, qualifiedOutcome: "message", fields: [] },
  },
  speedToLead: {
    callImmediately: true,
    buyerQualification: true,
    sellerQualification: true,
    qualifiedOutcome: "book",
    useRecommendedFollowUp: true,
  },
};

export type RealtorLeadStatus =
  | "new"
  | "working"
  | "contacted"
  | "qualified"
  | "appointment"
  | "nurture"
  | "closed";

export type RealtorLeadRow = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  status: RealtorLeadStatus;
  source?: string | null;
  intent?: string | null;
  assignedTo?: string | null;
  addedAt: string;
  lastActivityAt?: string | null;
  needsAttention?: boolean;
  collectedFields?: Record<string, string>;
};

export type RealtorNeedsAttentionItem = {
  id: string;
  leadId?: string;
  leadName: string;
  reason: string;
  detail: string;
  urgency: "low" | "normal" | "high";
  createdAt: string;
  href: string;
};

export type RealtorAmyActivityItem = {
  id: string;
  title: string;
  detail: string;
  kind: "calling" | "waiting" | "following_up" | "front_desk" | "completed";
  createdAt: string;
};
