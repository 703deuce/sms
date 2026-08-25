/** Primary caller intent — invisible routing; one agent handles all. */
export type RealEstateIntent =
  | "buyer"
  | "seller"
  | "showing"
  | "existing_client"
  | "agent_to_agent"
  | "general";

export type RealEstateCallerType =
  | "unknown"
  | "buyer"
  | "seller"
  | "existing_client"
  | "agent"
  | "vendor"
  | "other";

export type RealEstateLeadStatus =
  | "new"
  | "intake_in_progress"
  | "qualified"
  | "nurture"
  | "not_interested"
  | "message_taken"
  | "appointment_booked"
  | "transferred";

export type RealEstateFieldDefinition = {
  field_id: string;
  label: string;
  type: "text" | "long_text" | "phone" | "email";
  required: boolean;
  collection_instruction: string;
};

export type RealEstateCallState = {
  primaryIntent?: RealEstateIntent;
  secondaryIntents: RealEstateIntent[];
  callerType: RealEstateCallerType;
  collectedFields: Record<string, string>;
  /** Rolling caller utterances for intake backfill (last N per call). */
  intakeUtterances?: string[];
  contactId?: string;
  contactName?: string;
  leadStatus: RealEstateLeadStatus;
  messageTaken?: boolean;
  intakeComplete?: boolean;
  updatedAt: string;
};

export type RealEstateBusinessConfig = {
  businessName: string;
  serviceAreas: string[];
  propertyTypes: string[];
  knowledgeNotes: string[];
  authorityBoundaries: string[];
};

export const REAL_ESTATE_INTENT_LABELS: Record<RealEstateIntent, string> = {
  buyer: "home buyer",
  seller: "home seller",
  showing: "property showing",
  existing_client: "existing client",
  agent_to_agent: "agent or broker",
  general: "general inquiry",
};
