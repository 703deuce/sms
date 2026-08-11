import type { RealEstateFieldDefinition, RealEstateIntent } from "./types";

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
];

const BUYER_FIELDS: RealEstateFieldDefinition[] = [
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
    collection_instruction: "When they hope to buy (ASAP, 1-3 months, 3-6 months, 6+ months, just researching).",
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

const SELLER_FIELDS: RealEstateFieldDefinition[] = [
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

const SHOWING_FIELDS: RealEstateFieldDefinition[] = [
  ...SHARED_FIELDS,
  {
    field_id: "property_of_interest",
    label: "Property of interest",
    type: "text",
    required: true,
    collection_instruction: "Address, MLS number, or description of the property they want to see.",
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

const EXISTING_CLIENT_FIELDS: RealEstateFieldDefinition[] = [
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

const AGENT_TO_AGENT_FIELDS: RealEstateFieldDefinition[] = [
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
    field_id: "callback_phone",
    label: "Callback phone",
    type: "phone",
    required: false,
    collection_instruction: "Direct line if different from caller ID.",
  },
];

const GENERAL_FIELDS: RealEstateFieldDefinition[] = [
  ...SHARED_FIELDS,
  {
    field_id: "reason_for_call",
    label: "Reason for call",
    type: "text",
    required: true,
    collection_instruction: "What brought them to call today.",
  },
];

const INTENT_FIELD_MAP: Record<RealEstateIntent, RealEstateFieldDefinition[]> = {
  buyer: BUYER_FIELDS,
  seller: SELLER_FIELDS,
  showing: SHOWING_FIELDS,
  existing_client: EXISTING_CLIENT_FIELDS,
  agent_to_agent: AGENT_TO_AGENT_FIELDS,
  general: GENERAL_FIELDS,
};

export function fieldsForIntent(intent: RealEstateIntent): RealEstateFieldDefinition[] {
  return INTENT_FIELD_MAP[intent] || GENERAL_FIELDS;
}

export function fieldsForIntents(intents: RealEstateIntent[]): RealEstateFieldDefinition[] {
  const seen = new Set<string>();
  const merged: RealEstateFieldDefinition[] = [];
  for (const intent of intents) {
    for (const field of fieldsForIntent(intent)) {
      if (seen.has(field.field_id)) continue;
      seen.add(field.field_id);
      merged.push(field);
    }
  }
  return merged;
}

export function missingRequiredFields(
  intents: RealEstateIntent[],
  collected: Record<string, string>,
): RealEstateFieldDefinition[] {
  return fieldsForIntents(intents).filter(
    (field) => field.required && !collected[field.field_id]?.trim(),
  );
}

export function isIntakeComplete(
  intents: RealEstateIntent[],
  collected: Record<string, string>,
): boolean {
  if (!intents.length) return false;
  return missingRequiredFields(intents, collected).length === 0;
}

export function normalizeIntent(raw: string): RealEstateIntent | null {
  const value = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, RealEstateIntent> = {
    buyer: "buyer",
    buy: "buyer",
    buying: "buyer",
    home_buyer: "buyer",
    seller: "seller",
    sell: "seller",
    selling: "seller",
    home_seller: "seller",
    showing: "showing",
    tour: "showing",
    property_showing: "showing",
    schedule_showing: "showing",
    existing_client: "existing_client",
    existing: "existing_client",
    client: "existing_client",
    current_client: "existing_client",
    agent_to_agent: "agent_to_agent",
    agent: "agent_to_agent",
    realtor: "agent_to_agent",
    broker: "agent_to_agent",
    general: "general",
    other: "general",
    inquiry: "general",
  };
  return aliases[value] || null;
}
