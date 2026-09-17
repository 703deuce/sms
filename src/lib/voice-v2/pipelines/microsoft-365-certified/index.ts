/**
 * Frozen Microsoft 365 PSTN booking pipeline — copy of 06125f5f certified path.
 * Wizard bookingStrategy MICROSOFT_365 + Telnyx voice_v2_find/book tools MUST use only this module.
 * Do not import qualification, intake gates, or alternate strategies here.
 */
export { executeMicrosoft365CertifiedFindAvailability } from "./find-availability";
export { executeMicrosoft365CertifiedBookOfferedSlot } from "./book-offered-slot";

export const MICROSOFT_365_CERTIFIED_PIPELINE_BASELINE_SHA = "06125f5f";
