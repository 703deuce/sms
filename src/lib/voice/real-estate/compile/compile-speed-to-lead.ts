import type { QualificationDefinition } from "@/lib/voice/outbound/types";
import type { RealtorProductConfig } from "@/lib/realtor/types";
import {
  REAL_ESTATE_TEMPLATE_KEYS,
  REAL_ESTATE_TEMPLATE_VERSION,
  TEMPLATE_AUTHORITY_BOUNDARIES,
  TEMPLATE_BUYER_FIELDS,
  TEMPLATE_KNOWLEDGE_NOTES,
  TEMPLATE_PROPERTY_TYPES,
  TEMPLATE_SELLER_FIELDS,
} from "../templates/definitions";
import { resolveIntentFields } from "./field-manifest";
import { buildSpeedToLeadWorkflowDefinition } from "./compile-workflow-visual";
import type { AgentInstanceStatus, CompiledRealEstateSpeedToLead } from "./types";

function resolveLeadTypes(config: RealtorProductConfig): "buyer" | "seller" | "both" | "auto_detect" {
  const { buyerQualification, sellerQualification } = config.speedToLead;
  if (buyerQualification && sellerQualification) return "both";
  if (buyerQualification) return "buyer";
  if (sellerQualification) return "seller";
  return "auto_detect";
}

function qualificationFieldsForLeadTypes(config: RealtorProductConfig) {
  const fields = [];
  const seen = new Set<string>();

  if (config.speedToLead.buyerQualification) {
    const buyerCfg = config.frontDesk.buyer;
    const buyerFields = resolveIntentFields("buyer", buyerCfg);
    for (const f of buyerFields) {
      if (seen.has(f.field_id)) continue;
      seen.add(f.field_id);
      fields.push({
        field_id: f.field_id,
        label: f.label,
        type: f.type,
        required: f.required,
        collection_instruction: f.collection_instruction,
      });
    }
  }

  if (config.speedToLead.sellerQualification) {
    const sellerCfg = config.frontDesk.seller;
    const sellerFields = resolveIntentFields("seller", sellerCfg);
    for (const f of sellerFields) {
      if (seen.has(f.field_id)) continue;
      seen.add(f.field_id);
      fields.push({
        field_id: f.field_id,
        label: f.label,
        type: f.type,
        required: f.required,
        collection_instruction: f.collection_instruction,
      });
    }
  }

  if (!fields.length) {
    for (const f of TEMPLATE_BUYER_FIELDS) {
      if (seen.has(f.field_id)) continue;
      seen.add(f.field_id);
      fields.push({
        field_id: f.field_id,
        label: f.label,
        type: f.type,
        required: f.required,
        collection_instruction: f.collection_instruction,
      });
    }
  }

  return fields;
}

function buildQualificationDefinition(config: RealtorProductConfig): QualificationDefinition {
  const agentName = config.identity?.agentName?.trim() || "Amy";
  const companyName =
    config.business.teamName?.trim() ||
    config.business.brokerage?.trim() ||
    "Your Real Estate Team";
  const areas = config.business.serviceAreas?.length
    ? config.business.serviceAreas
    : ["your service area"];

  const fields = qualificationFieldsForLeadTypes(config);
  const requiredForQualified = fields.filter((f) => f.required).map((f) => f.field_id);

  return {
    id: `re-speed-to-lead-${config.compiledVersion ?? 1}`,
    label: `${companyName} — Speed-to-Lead qualification`,
    businessName: companyName,
    agentDisplayName: agentName,
    reasonForContact: "You recently submitted a request for information about real estate services.",
    introTemplate:
      "Hi, is this {leadName}? This is {agentDisplayName} with {businessName}. {reason} " +
      "I'm following up to get a better idea of what you're looking for so one of our realtors can help. " +
      "Do you have a minute for a few quick questions?",
    closeTemplate:
      "Perfect, I've got everything I need. I'll pass this along to one of our realtors at {businessName} " +
      "so they can follow up with you. Thanks for your time!",
    openingGuidance: [
      `Confirm identity, introduce yourself as ${agentName} with ${companyName}.`,
      "Explain they submitted a real estate inquiry online.",
      "Ask permission for a few quick questions — do not jump straight into qualification.",
    ],
    authorityBoundaries: TEMPLATE_AUTHORITY_BOUNDARIES,
    business: {
      name: companyName,
      description: `${companyName} helps buyers and sellers throughout ${areas.join(", ")}.`,
      services: ["Buyer representation", "Seller representation", "Home search support"],
      serviceAreas: areas,
      propertyTypes: TEMPLATE_PROPERTY_TYPES,
      knowledgeNotes: TEMPLATE_KNOWLEDGE_NOTES.map((n) =>
        n.replace("customer's configured service areas", areas.join(", ")),
      ),
      phone: config.business.officePhone?.trim(),
      website: config.business.website?.trim(),
    },
    campaign: {
      type: "new_lead_follow_up",
      source: config.leadSources.join(", ") || "Lead source",
      reasonForContact: "Follow up on a new real estate lead.",
      offerOrInterest: "Real estate services",
      callerExplanation:
        "You recently submitted a request for information. I'm following up to learn what you're looking for.",
      establishedIntent:
        config.speedToLead.buyerQualification && !config.speedToLead.sellerQualification
          ? "home buying"
          : config.speedToLead.sellerQualification && !config.speedToLead.buyerQualification
            ? "home selling"
            : undefined,
      skipFieldIds: ["name", "callback_phone"],
    },
    allowedOutcomes: [
      "QUALIFIED",
      "NOT_QUALIFIED",
      "NOT_INTERESTED",
      "NURTURE",
      "HOT",
      "CALLBACK_REQUESTED",
      "WRONG_NUMBER",
      "COMPLETED_INTAKE",
    ],
    fields,
    rules: [
      { outcome: "NOT_INTERESTED", requireInterested: false },
      {
        outcome: "QUALIFIED",
        requiredFields: requiredForQualified.length ? requiredForQualified : ["target_areas"],
        requireInterested: true,
      },
      { outcome: "NOT_QUALIFIED", requireInterested: true },
    ],
  };
}

export function compileSpeedToLeadFromProductConfig(
  config: RealtorProductConfig,
  input?: { status?: AgentInstanceStatus; configVersion?: number; agentId?: string },
): CompiledRealEstateSpeedToLead {
  const agentName = config.identity?.agentName?.trim() || "Amy";
  const companyName =
    config.business.teamName?.trim() ||
    config.business.brokerage?.trim() ||
    "Your Real Estate Team";

  const partial: Omit<CompiledRealEstateSpeedToLead, "workflowDefinition" | "qualification"> = {
    templateKey: REAL_ESTATE_TEMPLATE_KEYS.SPEED_TO_LEAD,
    templateVersion: REAL_ESTATE_TEMPLATE_VERSION,
    configVersion: input?.configVersion ?? (config.compiledVersion ?? 0) + 1,
    compiledAt: new Date().toISOString(),
    status: input?.status ?? config.status ?? "draft",
    identity: {
      agentName,
      companyName,
      brokerageName: config.business.brokerage?.trim(),
      realtorName: config.business.teamName?.trim(),
      website: config.business.website?.trim(),
      businessPhone: config.business.officePhone?.trim(),
      timezone: config.business.timezone?.trim() || "America/New_York",
    },
    calling: {
      callImmediately: config.speedToLead.callImmediately,
      leadTypes: resolveLeadTypes(config),
      maxAttempts: config.speedToLead.maxAttempts ?? 3,
      retryScheduleHours: config.speedToLead.retryScheduleHours ?? [2, 24, 72],
      voicemailBehavior: config.speedToLead.voicemailBehavior ?? "leave_message",
    },
    followUp: {
      useRecommended: config.speedToLead.useRecommendedFollowUp,
      qualifiedOutcome: config.speedToLead.qualifiedOutcome,
    },
    transfer: {
      enabled: Boolean(config.phone.transferNumber?.trim()),
      transferNumber: config.phone.transferNumber?.trim(),
    },
    booking: {
      enabled: config.speedToLead.qualifiedOutcome === "book",
      calendlyEventMappings: config.calendlyEventMappings,
    },
  };

  const qualification = buildQualificationDefinition(config);

  return {
    ...partial,
    qualification,
    workflowDefinition: buildSpeedToLeadWorkflowDefinition(
      partial,
      input?.agentId || "pending",
    ),
  };
}

/** Template default seller fields for outbound when seller-only mode. */
export { TEMPLATE_BUYER_FIELDS, TEMPLATE_SELLER_FIELDS };
