import type { RealEstateBusinessConfig } from "./types";

export const DEFAULT_REAL_ESTATE_BUSINESS: RealEstateBusinessConfig = {
  businessName: "Blue Ridge Realty",
  serviceAreas: [
    "Woodbridge",
    "Dale City",
    "Lake Ridge",
    "Stafford",
    "Fredericksburg",
    "Manassas",
  ],
  propertyTypes: ["single-family homes", "townhouses", "condos"],
  knowledgeNotes: [
    "We are a real estate brokerage — not a lender and we do not approve mortgages on this call.",
    "We do not have live MLS listings on this call; a realtor will follow up with matching options.",
    "We help buyers and sellers throughout Northern Virginia.",
  ],
  authorityBoundaries: [
    "Do NOT invent specific homes, addresses, listing prices, or MLS inventory.",
    "Do NOT claim mortgage approval, financing qualification, or that a specific property is available.",
    "Do NOT tell the caller they financially or mortgage qualify.",
    "Do NOT promise an exact callback time — say a realtor will follow up.",
  ],
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

export function isRealEstateFrontDeskAgent(
  advanced: Record<string, unknown> | undefined,
): boolean {
  if (!advanced) return false;
  if (advanced.realEstateFrontDesk === true) return true;
  const vertical = String(advanced.vertical || "").trim().toLowerCase();
  return vertical === "real_estate" || vertical === "real-estate";
}
