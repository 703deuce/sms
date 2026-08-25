import type { RealEstateFieldDefinition, RealEstateIntent } from "../types";

/** Canonical product template keys — not customer-specific. */
export const REAL_ESTATE_TEMPLATE_KEYS = {
  FRONT_DESK: "real_estate_front_desk",
  SPEED_TO_LEAD: "real_estate_speed_to_lead",
} as const;

export type RealEstateTemplateKey =
  (typeof REAL_ESTATE_TEMPLATE_KEYS)[keyof typeof REAL_ESTATE_TEMPLATE_KEYS];

export const REAL_ESTATE_TEMPLATE_VERSION = 1;

/** Brief intent keys mapped to runtime intents. */
export const FRONT_DESK_INTENT_KEYS = [
  "buyer",
  "seller",
  "showing",
  "existingClient",
  "agentToAgent",
  "general",
] as const;

export type FrontDeskIntentConfigKey = (typeof FRONT_DESK_INTENT_KEYS)[number];

export const FRONT_DESK_INTENT_KEY_TO_RUNTIME: Record<
  FrontDeskIntentConfigKey,
  RealEstateIntent
> = {
  buyer: "buyer",
  seller: "seller",
  showing: "showing",
  existingClient: "existing_client",
  agentToAgent: "agent_to_agent",
  general: "general",
};

/** Generic Realtor safety boundaries — no customer names or locations. */
export const TEMPLATE_AUTHORITY_BOUNDARIES = [
  "Do NOT invent specific homes, addresses, listing prices, or MLS inventory.",
  "Do NOT claim mortgage approval, financing qualification, or that a specific property is available.",
  "Do NOT tell the caller they financially or mortgage qualify.",
  "Do NOT promise an exact callback time — say a realtor will follow up.",
];

export const TEMPLATE_KNOWLEDGE_NOTES = [
  "We are a real estate brokerage — not a lender and we do not approve mortgages on this call.",
  "We do not have live MLS listings on this call; a realtor will follow up with matching options.",
  "We help buyers and sellers in the customer's configured service areas.",
];

export const TEMPLATE_PROPERTY_TYPES = [
  "single-family homes",
  "townhouses",
  "condos",
];

const SHARED_FIELDS: RealEstateFieldDefinition[] = [
  {
    field_id: "name",
    label: "Name",
    type: "text",
    required: true,
    collection_instruction: "Confirm their full name.",
  },
  {
    field_id: "callback_phone",
    label: "Callback phone",
    type: "phone",
    required: false,
    collection_instruction: "Best number to reach them if different from this line.",
  },
  {
    field_id: "preferred_contact_method",
    label: "Preferred contact method",
    type: "text",
    required: false,
    collection_instruction:
      "How they want the team to follow up — phone call, text message, or email.",
  },
  {
    field_id: "email",
    label: "Email",
    type: "email",
    required: false,
    collection_instruction: "Email address when they want follow-up by email.",
  },
];

export const TEMPLATE_BUYER_FIELDS: RealEstateFieldDefinition[] = [
  ...SHARED_FIELDS,
  {
    field_id: "target_areas",
    label: "Target areas",
    type: "text",
    required: true,
    collection_instruction: "Neighborhoods, cities, or areas they want to buy in.",
  },
  {
    field_id: "property_type",
    label: "Property type",
    type: "text",
    required: true,
    collection_instruction: "Single-family, townhouse, condo, or open to multiple types.",
  },
  {
    field_id: "budget_or_price_range",
    label: "Budget",
    type: "text",
    required: true,
    collection_instruction: "Rough price range or budget in natural language.",
  },
  {
    field_id: "purchase_timeframe",
    label: "Purchase timeframe",
    type: "text",
    required: true,
    collection_instruction:
      "When they hope to buy (ASAP, 1-3 months, 3-6 months, 6+ months, just researching).",
  },
  {
    field_id: "bedrooms",
    label: "Bedrooms",
    type: "text",
    required: false,
    collection_instruction: "How many bedrooms they need.",
  },
  {
    field_id: "bathrooms",
    label: "Bathrooms",
    type: "text",
    required: false,
    collection_instruction: "How many bathrooms they prefer.",
  },
  {
    field_id: "financing_status",
    label: "Financing status",
    type: "text",
    required: false,
    collection_instruction: "Cash, financing, or unsure.",
  },
  {
    field_id: "preapproval_status",
    label: "Pre-approval status",
    type: "text",
    required: false,
    collection_instruction: "Whether they are pre-approved, in progress, no, or unknown.",
  },
  {
    field_id: "must_have_features",
    label: "Must-have features",
    type: "long_text",
    required: false,
    collection_instruction: "Garage, yard, school district, etc.",
  },
  {
    field_id: "additional_notes",
    label: "Additional notes",
    type: "long_text",
    required: false,
    collection_instruction: "Anything else useful for the realtor follow-up.",
  },
];

export const TEMPLATE_SELLER_FIELDS: RealEstateFieldDefinition[] = [
  ...SHARED_FIELDS,
  {
    field_id: "property_address",
    label: "Property address",
    type: "text",
    required: true,
    collection_instruction: "Address or neighborhood of the home they want to sell.",
  },
  {
    field_id: "reason_for_selling",
    label: "Reason for selling",
    type: "text",
    required: true,
    collection_instruction: "Why they are selling (relocating, upsizing, downsizing, etc.).",
  },
  {
    field_id: "desired_timeline",
    label: "Desired timeline",
    type: "text",
    required: true,
    collection_instruction: "When they hope to list or close.",
  },
  {
    field_id: "estimated_value_range",
    label: "Estimated value range",
    type: "text",
    required: false,
    collection_instruction: "Rough price range they expect, if known.",
  },
  {
    field_id: "additional_notes",
    label: "Additional notes",
    type: "long_text",
    required: false,
    collection_instruction: "Condition, upgrades, or anything else for the listing agent.",
  },
];

export const TEMPLATE_SHOWING_FIELDS: RealEstateFieldDefinition[] = [
  ...SHARED_FIELDS,
  {
    field_id: "property_of_interest",
    label: "Property of interest",
    type: "text",
    required: true,
    collection_instruction:
      "Address, MLS number, or description of the property they want to see.",
  },
  {
    field_id: "preferred_showing_time",
    label: "Preferred showing time",
    type: "text",
    required: true,
    collection_instruction: "When they would like to tour the property.",
  },
  {
    field_id: "additional_notes",
    label: "Additional notes",
    type: "long_text",
    required: false,
    collection_instruction: "Agent name on listing, financing status, or other context.",
  },
];

export const TEMPLATE_EXISTING_CLIENT_FIELDS: RealEstateFieldDefinition[] = [
  ...SHARED_FIELDS,
  {
    field_id: "reason_for_call",
    label: "Reason for call",
    type: "text",
    required: true,
    collection_instruction: "What they need help with today.",
  },
  {
    field_id: "transaction_reference",
    label: "Transaction reference",
    type: "text",
    required: false,
    collection_instruction: "Property address or deal they are calling about.",
  },
];

export const TEMPLATE_AGENT_TO_AGENT_FIELDS: RealEstateFieldDefinition[] = [
  {
    field_id: "agent_name",
    label: "Agent name",
    type: "text",
    required: true,
    collection_instruction: "Their name and brokerage if mentioned.",
  },
  {
    field_id: "brokerage",
    label: "Brokerage",
    type: "text",
    required: false,
    collection_instruction: "Brokerage or company name.",
  },
  {
    field_id: "reason_for_call",
    label: "Reason for call",
    type: "text",
    required: true,
    collection_instruction: "Showing coordination, offer, referral, or other agent matter.",
  },
  {
    field_id: "preferred_contact_method",
    label: "Preferred contact method",
    type: "text",
    required: false,
    collection_instruction: "Phone call, text message, or email for follow-up.",
  },
  {
    field_id: "email",
    label: "Email",
    type: "email",
    required: false,
    collection_instruction: "Email when they want follow-up by email.",
  },
  {
    field_id: "callback_phone",
    label: "Callback phone",
    type: "phone",
    required: false,
    collection_instruction: "Direct line if different from caller ID.",
  },
];

export const TEMPLATE_GENERAL_FIELDS: RealEstateFieldDefinition[] = [
  ...SHARED_FIELDS,
  {
    field_id: "reason_for_call",
    label: "Reason for call",
    type: "text",
    required: true,
    collection_instruction: "What brought them to call today.",
  },
];

/** Default template field catalog keyed by runtime intent. */
export const TEMPLATE_INTENT_FIELD_CATALOG: Record<RealEstateIntent, RealEstateFieldDefinition[]> =
  {
    buyer: TEMPLATE_BUYER_FIELDS,
    seller: TEMPLATE_SELLER_FIELDS,
    showing: TEMPLATE_SHOWING_FIELDS,
    existing_client: TEMPLATE_EXISTING_CLIENT_FIELDS,
    agent_to_agent: TEMPLATE_AGENT_TO_AGENT_FIELDS,
    general: TEMPLATE_GENERAL_FIELDS,
  };

export const TEMPLATE_INTENT_LABELS: Record<FrontDeskIntentConfigKey, string> = {
  buyer: "Buyer lead",
  seller: "Seller lead",
  showing: "Showing request",
  existingClient: "Existing client",
  agentToAgent: "Other Realtor / agent-to-agent",
  general: "General / other",
};
