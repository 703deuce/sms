# Appointments Business Texting — Completion Pass

**Date:** 2026-09-10  
**Branch:** `cursor/appt-business-texting-audit-8af6`  
**Scope:** Texting only — no Booking Types / Meetings / Services / Classes / Workshops IA

## Completion gate

| Flag | Value |
|------|-------|
| `BUSINESS_TEXTING_ABSORPTION_COMPLETE` | **NO** |
| `READY_TO_RESUME_FINAL_PRODUCT_CERTIFICATION` | **NO** |

### Remaining blockers

1. **BT-TEST-08** — Live/test-safe campaign send end-to-end (PROVIDER_BLOCKED without controlled Telnyx workspace)
2. **BT-TEST-10** — Campaign recipient reply → Inbox roundtrip (PROVIDER_BLOCKED)
3. **BT-TEST-18 / BT-TEST-19** — Mobile + accessibility browser certification
4. **Visual migration** — `ReviewDetails`, `RecurringModal`, calendar chrome, filter menus still mix legacy Kimi classes; scoped CSS overrides remain as fallback
5. **Browser equivalence proof** — `/appointments/campaigns` vs `/campaigns/*` not fully exercised in automated browser matrix this pass

## What this pass closed

| Gap | Status |
|-----|--------|
| Contact Detail → Message | **DONE** — `ContactMessageAction` → `/conversations?contactId=` |
| Activity timeline empty CTA | **DONE** — same deep link |
| Appointment-aware campaign audiences | **DONE** — `appointment_preset` type, picker “Suggested audiences”, `audience.ts` resolution |
| Template ownership / picker | **DONE** — Campaign composer uses `/api/templates` (Campaign/SMS types); manage link → `/templates` |
| Design-system migration (phase 1) | **PARTIAL** — `campaign-ui-primitives.tsx`; migrated list, create, audience picker |
| Internal Appointments legacy links | **DONE** — calendar, category create, import, segments, detail duplicate |
| Automated guards / boundary | **PASS** — `test-mass-texting-campaign-guards`, `test-mass-texting-boundary`, `test-mass-texting-integration` |

## Architecture preserved

- Same Campaign engine, Contact model, Inbox, mass-texting APIs, processor, BullMQ, provider pipeline
- No new Campaign model, worker, inbox, or contact database
- `MASS_MESSAGING_IN_V1_NAV` remains false (standalone Mass SMS shell hidden)

## Next steps before certification resume

1. Run controlled provider smokes (send, schedule activation, STOP, inbound reply)
2. Finish visual migration on review/recurring/filter surfaces
3. Browser equivalence matrix on representative campaigns (list, draft, schedule, send, results)
4. Capture desktop + mobile screenshots per `APPOINTMENTS-BUSINESS-TEXTING-VISUAL-AUDIT.md`
