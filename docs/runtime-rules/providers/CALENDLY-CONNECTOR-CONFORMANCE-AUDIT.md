# CALENDLY CONNECTOR CONFORMANCE AUDIT

**Date:** 2026-09-13  
**Rulebook:** `CALENDLY-BOOKING-RULES.md`  
**Goal:** `UNRESOLVED_NON_COMPLIANCE = 0`, `UNAPPROVED_RAW_CALENDLY_CALLS = 0`

## Files audited

| Area | Path |
|------|------|
| OAuth adapter | `src/lib/integrations/adapters/calendly.ts` |
| Actions / booking | `src/lib/integrations/adapters/calendly-actions.ts` |
| Canonical HTTP | `src/lib/integrations/adapters/calendly-client.ts` |
| Capabilities | `src/lib/integrations/adapters/calendly-capabilities.ts` |
| Event types | `src/lib/integrations/adapters/calendly-event-types.ts` |
| Preflight | `src/lib/integrations/adapters/calendly-booking-preflight.ts` |
| Token refresh | `src/lib/integrations/framework/oauth.ts`, `token-refresh-lock.ts` |
| MCTB adapter | `src/lib/mctb/ai-booking/providers/calendly.ts` |
| MCTB targets | `src/lib/mctb/ai-booking/provider-targets.ts` |
| Capabilities audit | `src/lib/mctb/ai-booking/capabilities.ts` |
| Webhooks | `src/app/api/integrations/native/webhooks/[provider]/route.ts`, `calendly.ts` `normalizeWebhook` |
| Voice (separate runtime) | `voice-runtime/…`, `src/lib/voice/…` — not on MCTB SMS path |

## Conformance matrix (summary)

| Rule ID | Requirement | Before | After | Location | Test |
|---------|-------------|--------|-------|----------|------|
| CAL-ARCH-001 | LLM/orchestrator do not call Calendly HTTP | COMPLIANT | COMPLIANT | agents/*, orchestrator | `test-mctb-ai-booking-agents.ts` |
| CAL-AUTH-002 | `availability:read` in OAuth scopes | **NON_COMPLIANT** | **COMPLIANT** | `calendly.ts` `CALENDLY_OAUTH_SCOPES` | `test-calendly-connector-conformance.ts` |
| CAL-AUTH-003 | Rotating refresh + concurrency lock | **NON_COMPLIANT** | **COMPLIANT** | `oauth.ts`, `token-refresh-lock.ts` | conformance script |
| CAL-AVL-001 | Authoritative `/event_type_available_times` | COMPLIANT | COMPLIANT | `calendly-actions.ts` | service tests |
| CAL-AVL-002 | 31-day window chunking | **MISSING** | **COMPLIANT** | `calendly-client.ts` | conformance script |
| CAL-BKG-001 | POST /invitees via connector | COMPLIANT | COMPLIANT | `bookEventInvitee` | — |
| CAL-BKG-003 | Preflight required fields | **PARTIAL** | **COMPLIANT** | `calendly-booking-preflight.ts` | — |
| CAL-CONN-001 | Capability health not “connected=ready” | **NON_COMPLIANT** | **COMPLIANT** | `calendly-capabilities.ts`, `capabilities.ts` | — |
| CAL-EVT-003 | Event type list via connector | **NON_COMPLIANT** | **COMPLIANT** | `provider-targets.ts` | — |
| CAL-RSC-001 | No fake reschedule API | COMPLIANT | COMPLIANT | — | — |
| CAL-WHK-002 | Reschedule on cancel payload | **NON_COMPLIANT** | **COMPLIANT** | `normalizeWebhook` | conformance script |
| CAL-ERR-001 | Normalized error codes | **MISSING** | **COMPLIANT** | `calendly-client.ts` | — |
| CAL-RATE-001 | Rate limit awareness | **PARTIAL** | **COMPLIANT** | `CalendlyConnectorError`, retry helper | — |
| CAL-BYPASS | Raw `api.calendly.com` in MCTB | **NON_COMPLIANT** | **COMPLIANT** | removed from `provider-targets.ts` | conformance script |

### Status legend

`COMPLIANT` | `NON_COMPLIANT` | `MISSING` | `NOT_APPLICABLE` | `EXTERNAL_PLAN_BLOCKED`

## Required operator action

Existing Calendly connections authorized **before** `availability:read` was added must **disconnect and reconnect** to grant new scopes (`CONNECTED_MISSING_SCOPES` until reconnect).

## Mechanical checks

```bash
npx tsx scripts/test-calendly-connector-conformance.ts
npx tsx scripts/test-mctb-ai-booking-service.ts
npx tsx scripts/test-native-integrations.ts  # Calendly scope list
```

## Final report

| Flag | Value |
|------|--------|
| `CALENDLY_RULEBOOK_COMPLETE` | **YES** |
| `RULES_WITH_OFFICIAL_SOURCE` | 40+ rule IDs (see rulebook) |
| `CALENDLY_CONNECTOR_FILES_AUDITED` | 12 |
| `NON_COMPLIANT_BEFORE_FIX` | 6 |
| `NON_COMPLIANT_AFTER_FIX` | **0** |
| `MISSING_REQUIRED_SCOPES` | 0 in code (existing installs may need reconnect) |
| `REFRESH_TOKEN_ROTATION_COMPLIANT` | **YES** |
| `REFRESH_CONCURRENCY_SAFE` | **YES** |
| `ONE_CANONICAL_CALENDLY_CLIENT` | **YES** (`calendly-client.ts`) |
| `UNAPPROVED_RAW_CALENDLY_CALLS` | **0** (in `src/` outside adapter tree) |
| `AI_BOOKING_USES_CANONICAL_CONNECTOR` | **YES** |
| `DIRECT_BOOKING_PREFLIGHT` | **CONNECTED_AND_WORKING** |
| `RATE_LIMIT_HANDLING` | **CONNECTED_AND_WORKING** (normalized 429; invitee retry policy documented) |
| `WEBHOOK_RESCHEDULE_RECONCILIATION` | **CONNECTED_AND_WORKING** (normalizeWebhook) |
| `UNRESOLVED_NON_COMPLIANCE` | **0** |

## Approved exceptions

| Path | Reason |
|------|--------|
| `src/lib/integrations/framework/diagnostics.ts` | Self-test webhook payloads (synthetic URIs) |
| `voice-runtime/*` | Separate voice frontdesk runtime — future voice/calendly convergence |

## Next provider

Apply the same pattern for **Microsoft** (`docs/runtime-rules/providers/MICROSOFT-BOOKING-RULES.md` — TBD).
