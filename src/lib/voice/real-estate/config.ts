import type { RealEstateBusinessConfig } from "./types";
import {
  TEMPLATE_AUTHORITY_BOUNDARIES,
  TEMPLATE_KNOWLEDGE_NOTES,
  TEMPLATE_PROPERTY_TYPES,
} from "./templates/definitions";
import type { CompiledRealEstateFrontDesk } from "./compile/types";

/** Generic template defaults — no customer-specific names or locations. */
export const DEFAULT_REAL_ESTATE_BUSINESS: RealEstateBusinessConfig = {
  businessName: "Your Real Estate Team",
  serviceAreas: ["your service area"],
  propertyTypes: TEMPLATE_PROPERTY_TYPES,
  knowledgeNotes: TEMPLATE_KNOWLEDGE_NOTES,
  authorityBoundaries: TEMPLATE_AUTHORITY_BOUNDARIES,
};

export function resolveRealEstateBusinessConfig(
  dynamicVariables?: Record<string, unknown> | null,
): RealEstateBusinessConfig {
  const dv = dynamicVariables || {};
  const areas = dv.service_areas || dv.serviceAreas;
  const types = dv.property_types || dv.propertyTypes;
  const notes = dv.knowledge_notes || dv.knowledgeNotes;
  const boundaries = dv.authority_boundaries || dv.authorityBoundaries;

  return {
    businessName:
      String(dv.business_name || dv.businessName || DEFAULT_REAL_ESTATE_BUSINESS.businessName).trim() ||
      DEFAULT_REAL_ESTATE_BUSINESS.businessName,
    serviceAreas: Array.isArray(areas)
      ? areas.map(String)
      : DEFAULT_REAL_ESTATE_BUSINESS.serviceAreas,
    propertyTypes: Array.isArray(types)
      ? types.map(String)
      : DEFAULT_REAL_ESTATE_BUSINESS.propertyTypes,
    knowledgeNotes: Array.isArray(notes)
      ? notes.map(String)
      : DEFAULT_REAL_ESTATE_BUSINESS.knowledgeNotes,
    authorityBoundaries: Array.isArray(boundaries)
      ? boundaries.map(String)
      : DEFAULT_REAL_ESTATE_BUSINESS.authorityBoundaries,
  };
}

export function businessConfigFromCompiled(
  compiled: CompiledRealEstateFrontDesk,
): RealEstateBusinessConfig {
  return compiled.business;
}

export function isRealEstateFrontDeskAgent(
  advanced: Record<string, unknown> | undefined,
): boolean {
  if (!advanced) return false;
  if (advanced.realEstateFrontDesk === true) return true;
  const vertical = String(advanced.vertical || "").trim().toLowerCase();
  return vertical === "real_estate" || vertical === "real-estate";
}

export function getCompiledFrontDeskFromAdvanced(
  advanced: Record<string, unknown> | undefined,
): CompiledRealEstateFrontDesk | null {
  const compiled = advanced?.realEstateCompiled;
  if (!compiled || typeof compiled !== "object") return null;
  return compiled as CompiledRealEstateFrontDesk;
}
