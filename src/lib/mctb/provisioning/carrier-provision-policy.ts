/**
 * Carrier provision policy — infrastructure vs app entitlements.
 *
 * **Carrier (Telnyx/Twilio):** Every workspace number is ALWAYS wired for both
 * MCTB TeXML voice and workspace SMS at purchase, import, repair, and switch.
 * Never skip or tear down carrier routing based on billing plan, product SKU,
 * or which package the customer bought (SMS-only, MCTB-only, or both).
 *
 * **App:** Product access is gated separately:
 * - MCTB runtime sends → `getMctbEntitlement()` / `canSendAutomaticRecovery`
 * - SMS campaigns / blast → `isMessagingReady()` / `ProductEntitlement` sms
 * - UI surfaces → product entitlements and workspace billing state
 *
 * Upgrades unlock features without re-provisioning. Downgrades / non-payment
 * block in-app only — carrier channels stay warm for instant re-activation.
 *
 * Number switching updates runtime config (which DID John points at). Sibling
 * numbers remain dual-provisioned; do not call `releaseMctbTexmlIngressFromPhone`
 * on switch.
 *
 * **Runtime gates (app only — carrier stays wired):**
 * - `config.enabled` + `getMctbEntitlement().canSendAutomaticRecovery` → MCTB SMS
 * - Called DID must be a workspace-owned ingress (sibling TFNs allowed; not cross-tenant)
 * - Missing carrier ForwardedFrom must not block recovery SMS
 * - `isMessagingReady()` / product entitlements → campaign / blast SMS
 */
export const MCTB_CARRIER_DUAL_CHANNEL_POLICY_ID = "mctb_carrier_dual_channel_v1" as const;
