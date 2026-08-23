# Smart Routing — Dual Number Architecture (V1)

**Date:** 2026-08-23

## Summary

Smart Routing V1 now uses **two workspace-level private numbers** instead of one dual-purpose DID:

| Number | Purpose | Customer forwards here? | Employee PIN path? |
|--------|---------|-------------------------|-------------------|
| **Routing Number** | Inbound Smart Routing only | Yes | Never |
| **Business Callback Number** | Employee outbound access only | **No** | Always (authorized + PIN) |

Top-level runtime is determined by **called number**, not `forwardedFrom` / Diversion metadata.

## Database

`smart_routing_workspace_settings`:

- `routing_number_e164` + `assigned_phone_number_id` (existing inbound)
- `callback_number_e164` + `assigned_callback_phone_number_id` (new)

Migration: `supabase/migrations/20260824_smart_routing_dual_numbers.sql`

Existing routing assignments are preserved. Callback number is auto-assigned from another workspace number when available (`ensureCallbackNumberAssigned`).

## Runtime

- `ingress-router.ts` — `resolveSmartRoutingIngress()` returns `inbound_routing` | `employee_callback` | `none`
- `webhook-handlers.ts` — Callback Number → employee access or reject; Routing Number → inbound only
- `access-detection.ts` — Removed `forwardedFrom` gate; authorized caller match only on Callback Number ingress
- `number-provisioning.ts` — `assignRoutingPhoneNumber`, `assignCallbackPhoneNumber`, `ensureCallbackNumberAssigned`
- Number owners: `smart_routing` (routing), `smart_routing_callback` (callback)

## Loop protection

- Destinations API blocks Routing + Callback numbers
- `isBlockedCallbackDestination` blocks both numbers for outbound legs
- Flow builder cannot assign Callback Number as flow DID

## Forwarding metadata

Parser retained for caller preservation, MCTB, analytics. **No longer** discriminates inbound vs employee callback.

See updated `docs/smart-routing-forwarding-metadata-audit.md`.

## DID cost

One additional Telnyx number per Smart Routing workspace (Callback Number). Same per-workspace model — not per employee.

## Live PSTN still required

1. Public number → Routing Number → menu; ANI preserved
2. Authorized employee → Callback Number → PIN → outbound shows verified business number
3. Employee calling forwarded public number → Routing Number → **customer menu** (not PIN)
4. Unknown caller → Callback Number → rejected
5. SR + MCTB fallback unchanged

## Tests

- `npx tsx scripts/test-smart-routing-dual-numbers.ts`
- `npx tsx scripts/test-smart-routing-setup-readiness.ts`
- `npm run test:smart-routing-standalone-v1`
- `npm run test:smart-routing-compiler`
- `npm run build`
