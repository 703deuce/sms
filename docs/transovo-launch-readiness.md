/**
 * Transovo platform launch readiness — automated vs manual verification.
 * Updated after launch consolidation (nav, entitlements, business call back, add-ons).
 */

export const TRANSOVO_LAUNCH_READINESS = {
  automated: [
    "npm run test:transovo-platform",
    "npm run test:transovo-finish-gaps",
    "npm run test:transovo-voicemail",
    "npm run test:transovo-callback",
    "npm run build",
  ],
  manual: [
    "PSTN inbound call through forwarded business number → Smart Routing menu",
    "Employee business call back from dashboard (answer team phone → customer sees business caller ID)",
    "Employee business call back via access number + PIN",
    "MCTB recovery after unanswered routed call (both consent modes)",
    "Stripe checkout → entitlement flags (when billing enabled)",
    "Carrier forwarding setup on production business number",
  ],
  launchBlockers: [
    "Employee PIN bridge: Press 1 last routed caller (employee-aware), Press 2 manual dial",
    "Live Telnyx outbound bridge on production (dashboard-initiated + PIN flows)",
    "Verified business caller ID on production workspace before outbound bridge",
    "Entitlement migration: existing workspaces grandfathered; new workspaces purchase-driven",
    "Coolify: npm run db:push:force + supplemental supabase/migrations/*.sql",
  ],
} as const;
