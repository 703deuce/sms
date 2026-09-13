# MICROSOFT CALENDAR CONNECTOR CONFORMANCE AUDIT

**Date:** 2026-09-13  
**Rulebook:** `MICROSOFT-OUTLOOK-CALENDAR-RULES.md`

## Canonical connector surface

| Component | Role |
|-----------|------|
| `src/lib/microsoft/oauth-config.ts` | Authorize/token URLs, scopes, refresh |
| `src/lib/microsoft/graph-helpers.ts` | Account type, URLs, date/time, getSchedule eligibility |
| `src/lib/microsoft/graph-errors.ts` | Normalized error codes |
| `src/lib/microsoft/calendar-capabilities.ts` | Health + AI Booking readiness |
| `src/lib/microsoft/booking-preflight.ts` | Pre-create validation |
| `src/lib/calendar/providers.ts` | **`microsoftGraphFetch`** — all authenticated Graph calendar I/O |
| `src/lib/voice/calendar/booking.ts` | Policy + slot generation + `bookAppointment` |
| `src/lib/mctb/ai-booking/providers/microsoft.ts` | MCTB adapter (no direct Graph) |

## Conformance matrix (summary)

| Rule ID | Requirement | Before | After | Location |
|---------|-------------|--------|-------|----------|
| MS-AUTH-002 | `offline_access` in scopes | COMPLIANT | COMPLIANT | `oauth-config.ts` |
| MS-AUTH-003 | Refresh lock per connection | COMPLIANT | COMPLIANT | `withMicrosoftTokenRefreshLock` |
| MS-ACCT-001 | Personal vs work detection | COMPLIANT | COMPLIANT | `graph-helpers.ts` |
| MS-AVL-001 | getSchedule only when supported | COMPLIANT | COMPLIANT | `getMicrosoftBusy` |
| MS-AVL-002 | calendarView fallback | COMPLIANT | COMPLIANT | `getMicrosoftBusyViaCalendarView` |
| MS-CONN-001 | Capability ≠ “connected” | **NON_COMPLIANT** | **COMPLIANT** | `calendar-capabilities.ts`, `capabilities.ts` |
| MS-EVT-001 | transactionId on create | COMPLIANT | COMPLIANT | `insertMicrosoftEvent` |
| MS-ATT-001 | inviteSent only with email | **NON_COMPLIANT** | **COMPLIANT** | `microsoft.ts` adapter |
| MS-BKG-003 | Booking preflight | **MISSING** | **COMPLIANT** | `booking-preflight.ts` |
| MS-ERR-001 | Normalized errors | **PARTIAL** | **COMPLIANT** | `graph-errors.ts` |
| MS-ARCH-001 | LLM does not call Graph | COMPLIANT | COMPLIANT | agent boundary tests |
| MS-BYPASS | Raw Graph outside connector tree | COMPLIANT | COMPLIANT | conformance script |

## Approved exceptions

| Path | Reason |
|------|--------|
| `oauth-config.ts` `fetch(/me)` during OAuth callback | No `connectionId` yet — uses fresh access token once |

## Mechanical checks

```bash
npx tsx scripts/test-microsoft-connector-conformance.ts
npx tsx scripts/test-mctb-ai-booking-service.ts
npx tsx scripts/test-mctb-ai-booking-agents.ts
```

## Final report

| Flag | Value |
|------|--------|
| `MICROSOFT_RULEBOOK_COMPLETE` | **YES** |
| `MICROSOFT_CONNECTOR_FILES_AUDITED` | 8+ |
| `NON_COMPLIANT_AFTER_FIX` | **0** |
| `REFRESH_CONCURRENCY_SAFE` | **YES** |
| `ONE_CANONICAL_GRAPH_CLIENT` | **YES** (`microsoftGraphFetch`) |
| `UNAPPROVED_RAW_GRAPH_CALENDAR_CALLS` | **0** (in `src/` outside allowlist) |
| `AI_BOOKING_USES_CANONICAL_CONNECTOR` | **YES** |
| `ACCOUNT_TYPE_LIMITS_ENFORCED` | **YES** |
| `BOOKING_POLICY_DETERMINISTIC` | **YES** (VoiceService + `computeFreeSlots`) |
| `MICROSOFT_RULEBOOK_FULL_OPERATION_APPENDIX` | **YES** (`MICROSOFT-OUTLOOK-CALENDAR-OPERATIONS-APPENDIX.md`) |
| `MICROSOFT_UNRESOLVED_NON_COMPLIANCE` | **0** |
| `UNRESOLVED_NON_COMPLIANCE` | **0** |
