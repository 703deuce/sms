export type RealtorAmyMode = "front_desk" | "speed_to_lead" | "both";

export type RealtorOnboardingStep =
  | "intent"
  | "business"
  | "phone"
  | "lead_sources"
  | "calendar"
  | "front_desk_capabilities"
  | "buyer_qualification"
  | "seller_qualification"
  | "showing_config"
  | "existing_client_config"
  | "agent_to_agent_config"
  | "speed_lead_types"
  | "outbound_buyer_qual"
  | "outbound_seller_qual"
  | "first_call_timing"
  | "follow_up"
  | "sms_email"
  | "booking"
  | "transfers"
  | "knowledge"
  | "voice"
  | "notifications"
  | "review"
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
  /** Customer-facing label override. */
  label?: string;
  /** Spoken question — configuration, not prompt code. */
  question?: string;
  /** Collection guidance for the runtime field engine. */
  instruction?: string;
  type?: "text" | "phone" | "long_text" | "currency_range" | "select";
  order?: number;
  /** True when the customer added a field not in the template catalog. */
  custom?: boolean;
};

export type RealtorIntentConfig = {
  enabled: boolean;
  fields: RealtorIntentFieldToggle[];
  qualifiedOutcome: RealtorQualifiedOutcome;
};

export type RealtorAgentInstanceStatus = "draft" | "testing" | "active" | "paused";

export type RealtorIdentityConfig = {
  agentName?: string;
  greeting?: string;
};

export type RealtorVoiceConfig = {
  provider?: "openai_realtime";
  model?: string;
  voice?: string;
  speed?: number;
};

export type RealtorKnowledgeConfig = {
  useRecommended?: boolean;
  customNotes?: string[];
  serviceAreaNotes?: string;
};

export type RealtorNotificationConfig = {
  onQualified?: boolean;
  onAppointmentBooked?: boolean;
  onNeedsHuman?: boolean;
  emailRecipients?: string[];
};

export type RealtorProductConfig = {
  version: 1 | 2;
  enabled: boolean;
  onboardingComplete: boolean;
  live: boolean;
  amyMode: RealtorAmyMode;
  currentStep: RealtorOnboardingStep;
  /** draft → testing → active; production uses last published version. */
  status?: RealtorAgentInstanceStatus;
  /** Monotonic compile version — bumped on each publish. */
  compiledVersion?: number;
  /** Template keys for deployed agent instances. */
  frontDeskTemplateKey?: "real_estate_front_desk";
  speedToLeadTemplateKey?: "real_estate_speed_to_lead";
  templateVersion?: number;
  identity?: RealtorIdentityConfig;
  voice?: RealtorVoiceConfig;
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
    maxAttempts?: number;
    retryScheduleHours?: number[];
    voicemailBehavior?: "leave_message" | "hang_up";
    firstCallDelayMinutes?: number;
  };
  deployedAgentId?: string;
  deployedOutboundAgentId?: string;
  frontDeskTemplateAgentId?: string;
  outboundTemplateAgentId?: string;
  followUpAutomationId?: string;
  deployedAt?: string;
  publishedAt?: string;
  /** Draft config saved while editing — production uses last published compile. */
  draftSavedAt?: string;
  knowledge?: RealtorKnowledgeConfig;
  notifications?: RealtorNotificationConfig;
  /** Maps appointment type label → Calendly event type URI or slug */
  calendlyEventMappings?: Record<string, string>;
  /** Published voice agent version ids for reproducibility */
  frontDeskPublishedVersionId?: string;
  outboundPublishedVersionId?: string;
};

export const DEFAULT_REALTOR_PRODUCT_CONFIG: RealtorProductConfig = {
  version: 2,
  enabled: false,
  onboardingComplete: false,
  live: false,
  amyMode: "both",
  currentStep: "intent",
  status: "draft",
  compiledVersion: 0,
  frontDeskTemplateKey: "real_estate_front_desk",
  speedToLeadTemplateKey: "real_estate_speed_to_lead",
  templateVersion: 1,
  identity: { agentName: "Amy" },
  voice: { provider: "openai_realtime", model: "gpt-realtime-2.1-mini", voice: "marin", speed: 1.0 },
  business: {
    teamType: "solo",
    timezone: "America/New_York",
    serviceAreas: [],
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
    existingClient: { enabled: true, qualifiedOutcome: "message", fields: [] },
    agentToAgent: { enabled: true, qualifiedOutcome: "message", fields: [] },
    general: { enabled: true, qualifiedOutcome: "message", fields: [] },
  },
  speedToLead: {
    callImmediately: true,
    buyerQualification: true,
    sellerQualification: true,
    qualifiedOutcome: "book",
    useRecommendedFollowUp: true,
    firstCallDelayMinutes: 0,
  },
  knowledge: { useRecommended: true, customNotes: [] },
  notifications: {
    onQualified: true,
    onAppointmentBooked: true,
    onNeedsHuman: true,
    emailRecipients: [],
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
