# Port Out Production — Audit & Implementation

## Audit summary (pre-implementation)

### What already worked
- Personal porting page with Port Out tab
- Telnyx per-number `port_out_pin` read/write via Phone Numbers API
- Twilio port-out account number from workspace **subaccount SID** (`MessagingRegistration.subaccountSid`)
- Local `PortRequest` rows + audit on initiate
- Port-away window + release guards during port-out
- Twilio per-customer subaccount provisioning on number purchase

### Partially implemented
- Port-out “request” was a `PortRequest` row stuck at `submitted` with `direction:out` in free-text `notes`
- 7-day port-away window (not 30-day portability guarantee)
- Twilio PIN stored locally only (no Twilio port-away PIN API)
- Port-out lock bypassed on initiate (auto-unlock)

### Fake / wireframe-only
- Port-in portability check in Personal UI (client timeout + digit regex)
- Port-out stepper steps 2–6, demo table rows, static eligibility banner
- Authorized contact + transfer date fields not persisted

### Incorrect behavior fixed in this pass
- Initiate no longer auto-unlocks locked PIN
- Customer-facing carrier labels use **Transovo** branding (not Telnyx/Twilio)
- Dedicated `PortOutRequest` model with normalized statuses

## New architecture

| Layer | Path |
|-------|------|
| Schema | `prisma/schema.prisma` → `PortOutRequest` |
| Statuses | `src/lib/numbers/port-out-constants.ts` |
| Destinations | `src/lib/numbers/port-out-destination-rules.ts` |
| Lifecycle | `src/lib/numbers/port-out-service.ts` |
| Telnyx orders | `src/lib/numbers/telnyx-port-out-service.ts` |
| Customer UI | `src/components/personal/personal-port-out-flow.tsx` |
| APIs | `/api/personal/port-out`, `/api/personal/numbers/[id]/port-out` |
| Webhook | `/api/telnyx/port-out` |

## Normalized customer statuses

`WAITING_FOR_CARRIER` → `REQUEST_RECEIVED` → `AUTHORIZED` → `SCHEDULED` → `COMPLETED`, plus `ACTION_REQUIRED`, `PORTABILITY_REVIEW`, `UNEXPECTED_PORT_REQUEST`, `CANCELED`.

## 30-Day Portability Guarantee

- Eligibility: `initiatedAt <= purchasedAt + 30 days` AND destination rule allows guarantee
- PIN/account/name rejections → `ACTION_REQUIRED` (not automatic refund)
- Rate-center / number-type rejections → `PORTABILITY_REVIEW`

## Twilio subaccount note

Twilio U.S. local port-out requires a PIN. Account number for port-away is sourced from the **customer’s Twilio subaccount SID** when `MessagingRegistration.subaccountSid` exists. **Live acceptance test required** to confirm this is the identifier gaining carriers accept — do not hard-code parent account credentials.

## Remaining gaps (follow-up)

- Twilio port-away status webhooks + PIN API integration
- Stripe refund execution on guarantee `refund_requested`
- Inventory relist vs release policy automation
- Live Telnyx + Twilio subaccount port-out acceptance tests
- Voice vs messaging port status split in customer UI
- Idempotent webhook dedupe via `providerPortOutId` + event store

## Tests

```bash
npx tsx scripts/test-port-out-production.ts
```
