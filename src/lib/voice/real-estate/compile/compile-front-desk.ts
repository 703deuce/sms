import type { RealtorProductConfig } from "@/lib/realtor/types";
import type { RealEstateBusinessConfig, RealEstateIntent } from "../types";
import {
  FRONT_DESK_INTENT_KEY_TO_RUNTIME,
  REAL_ESTATE_TEMPLATE_KEYS,
  REAL_ESTATE_TEMPLATE_VERSION,
  TEMPLATE_AUTHORITY_BOUNDARIES,
  TEMPLATE_KNOWLEDGE_NOTES,
  TEMPLATE_PROPERTY_TYPES,
  type FrontDeskIntentConfigKey,
} from "../templates/definitions";
import { resolveIntentFields } from "./field-manifest";
import { workflowVisualizationMeta } from "@/lib/voice/architecture/compiled-policy";
import { buildFrontDeskWorkflowDefinition } from "./compile-workflow-visual";
import type { AgentInstanceStatus, CompiledRealEstateFrontDesk } from "./types";

function resolveIdentity(config: RealtorProductConfig) {
  const agentName = config.identity?.agentName?.trim() || "Amy";
  const companyName =
    config.business.teamName?.trim() ||
    config.business.brokerage?.trim() ||
    "Your Real Estate Team";
  return {
    agentName,
    companyName,
    brokerageName: config.business.brokerage?.trim(),
    realtorName: config.business.teamName?.trim(),
    website: config.business.website?.trim(),
    businessPhone: config.business.officePhone?.trim() || config.phone.transferNumber?.trim(),
    timezone: config.business.timezone?.trim() || "America/New_York",
    greeting: config.identity?.greeting?.trim(),
  };
}

function resolveBusiness(config: RealtorProductConfig): RealEstateBusinessConfig {
  const identity = resolveIdentity(config);
  const areas = config.business.serviceAreas?.length
    ? config.business.serviceAreas
    : ["your service area"];
  const customNotes =
    config.knowledge?.customNotes?.filter((n) => n.trim()) ||
    (config.knowledge?.serviceAreaNotes?.trim()
      ? [config.knowledge.serviceAreaNotes.trim()]
      : []);
  const knowledgeNotes = [
    ...TEMPLATE_KNOWLEDGE_NOTES.map((n) =>
      n.replace("customer's configured service areas", areas.join(", ")),
    ),
    ...customNotes,
  ];
  return {
    businessName: identity.companyName,
    serviceAreas: areas,
    propertyTypes: TEMPLATE_PROPERTY_TYPES,
    knowledgeNotes,
    authorityBoundaries: TEMPLATE_AUTHORITY_BOUNDARIES,
  };
}

function resolveVoice(config: RealtorProductConfig) {
  return {
    provider: "openai_realtime" as const,
    model:
      config.voice?.model?.trim() ||
      process.env.VOICE_REALTIME_MODEL?.trim() ||
      "gpt-realtime-2.1-mini",
    voice:
      config.voice?.voice?.trim() ||
      process.env.VOICE_REALTIME_VOICE?.trim() ||
      "marin",
    speed: config.voice?.speed ?? 1.0,
  };
}

function compileIntents(config: RealtorProductConfig) {
  const intents = {} as CompiledRealEstateFrontDesk["intents"];
  for (const [key, runtimeIntent] of Object.entries(FRONT_DESK_INTENT_KEY_TO_RUNTIME) as [
    FrontDeskIntentConfigKey,
    RealEstateIntent,
  ][]) {
    const intentCfg = config.frontDesk[key];
    intents[runtimeIntent] = {
      enabled: intentCfg.enabled,
      qualifiedOutcome: intentCfg.qualifiedOutcome,
      fields: intentCfg.enabled ? resolveIntentFields(runtimeIntent, intentCfg) : [],
    };
  }
  return intents;
}

export function compileFrontDeskFromProductConfig(
  config: RealtorProductConfig,
  input?: { status?: AgentInstanceStatus; configVersion?: number },
): CompiledRealEstateFrontDesk {
  const identity = resolveIdentity(config);
  const business = resolveBusiness(config);
  const intents = compileIntents(config);
  const bookingEnabled = Object.values(intents).some(
    (i) => i.enabled && i.qualifiedOutcome === "book",
  );

  const partial: Omit<CompiledRealEstateFrontDesk, "workflowDefinition" | "workflowVisualization"> = {
    templateKey: REAL_ESTATE_TEMPLATE_KEYS.FRONT_DESK,
    templateVersion: REAL_ESTATE_TEMPLATE_VERSION,
    configVersion: input?.configVersion ?? (config.compiledVersion ?? 0) + 1,
    compiledAt: new Date().toISOString(),
    status: input?.status ?? config.status ?? "draft",
    identity,
    business,
    voice: resolveVoice(config),
    intents,
    transfer: {
      enabled: Boolean(config.phone.transferNumber?.trim()),
      transferNumber: config.phone.transferNumber?.trim(),
    },
    booking: {
      enabled: bookingEnabled,
      appointmentTypes: config.appointmentTypes || [],
      calendlyEventMappings: config.calendlyEventMappings,
    },
    notifications: config.notifications,
    instructions: config.instructions?.custom?.trim()
      ? { custom: config.instructions.custom.trim() }
      : undefined,
  };

  return {
    ...partial,
    workflowDefinition: buildFrontDeskWorkflowDefinition(partial),
    workflowVisualization: workflowVisualizationMeta(),
  };
}
