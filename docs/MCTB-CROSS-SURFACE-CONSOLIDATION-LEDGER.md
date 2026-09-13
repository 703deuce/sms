# MCTB Cross-Surface Consolidation Ledger

```
ARCHITECTURE_AUDIT_COMPLETE: YES
ENGINES_REBUILT: 0
DUPLICATE_MCTB_PAYMENT_ENGINE: 0
DUPLICATE_STRIPE_CONNECT: 0
DUPLICATE_MICROSOFT_OAUTH: 0
CANONICAL_PAYMENT_REQUEST: YES
CANONICAL_CONVERSATION_BRIDGE: YES (with attribution gap)
ONBOARDING_SETUP_SHARED_STATE: YES (mechanical)
INTEGRATIONS_WORKSPACE_LEVEL: YES (merchant + calendar consolidated on /integrations)
NUMBERS_A2P_NAV_REMOVED: YES
MCTB_ANALYTICS_DOMAIN_SCOPED: YES
FOLLOW_UP_GAPS: 3
BROKEN: 0
```

## Follow-up gaps (ordered)

| ID | Gap | Severity | Suggested fix |
|----|-----|----------|----------------|
| G1 | `conversationId` / `missedCallId` on `/mctb/appointments/new` not persisted on appointment | Medium | Wire `AppointmentFormClient` / create API metadata |
| G2 | Copied booking UI deep-links to `/appointments/*` | Low | Route helpers in MCTB connected layers |
| G3 | Integrations page “Connected” stat mixes SaaS billing + connectors | Low | Count merchant Connect via `/api/merchant-payments/status` only for payments |

## Locked behaviors (do not duplicate)

- Conversation → `PaymentRequest` only via `/api/payment-requests`
- Conversation → book only via shared appointment APIs
- Connect Microsoft / Stripe once per workspace — MCTB Booking and Payments read same status
- Onboarding writes → `saveMctbOnboardingState` + runtime config; Setup reads both
- `/mctb/numbers` → contextual drawer only

Run: `npx tsx scripts/test-cross-surface-ownership-audit.ts`
