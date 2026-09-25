# Voice Analytics — Implementation Report

**Date:** 2026-09-25  
**Route:** `/voice/analytics`  
**Status:** VOICE ANALYTICS IMPLEMENTATION COMPLETE — OWNER UI CERTIFICATION REQUIRED

---

## 1. Files Changed

| Area | Files |
|------|--------|
| Routing | `next.config.ts`, `scripts/test-voice-analytics-routing.ts` |
| Outcome domain | `src/lib/voice/calls/outcome-classification.ts`, `src/lib/voice/calls/outcome-display.ts` |
| Timezone | `src/lib/voice/timezone-day-boundary.ts`, `src/lib/voice/call-service.ts` |
| Analytics core | `src/lib/voice/analytics.ts`, `src/lib/voice/analytics/*` |
| UI | `src/components/voice/voice-analytics-dashboard.tsx`, `src/app/(app)/voice/analytics/page.tsx` |
| Tests | `src/lib/voice/analytics/*.test.ts` |
| Spec (prior pass) | `docs/VOICE-ANALYTICS-PAGE-SPECIFICATION.md` |

---

## 2. Routing Fix

Removed `next.config.ts` redirect:

`/voice/analytics` → `/mctb/analytics`

Static check: `npx tsx scripts/test-voice-analytics-routing.ts` → **OK**

`/voice/analytics/after-hours` remains `redirect("/voice/analytics")` at route level.

---

## 3. Final Page Architecture

Analytical workspace at `max-w-[1200px]`: header + 6 KPI grid + knowledge gap link + daily volume chart + call outcomes + receptionist performance + optional sentiment + usage + collapsed advanced.

---

## 4. Call Population

**Decision: permanent customer analytics are inbound-only.**

Evidence: Voice V3 PSTN receptionist ingress persists `direction: "INBOUND"` (`src/lib/voice-v3/start-appointment-receptionist-pstn.ts`).

**Population:** `isTest: false` AND `direction === INBOUND` within business-local period bounds.

Outbound campaign calls remain in legacy root fields (`totalCalls`, `outbound`, `byCampaign`, etc.) for `/voice/reports` and billing compatibility but are **excluded** from `receptionist.*` KPIs.

---

## 5. Shared Outcome Classification

Extracted pure module: `src/lib/voice/calls/outcome-classification.ts`

`outcome-display.ts` re-exports for Calls UI — **no rule fork**.

Analytics uses `deriveCallMaterialOutcomeEvents`, `callHasTransferFailedEvent`, `countTransfersAnsweredOnCall`.

---

## 6. Material Outcome Aggregation

`aggregateReceptionistCalls` increments **event counts** per call (multiple badges per call). Implemented in `src/lib/voice/analytics/voice-analytics-aggregate.ts`.

---

## 7. Appointment Semantics

**Appointments booked** = `appointmentBooked` on inbound calls (also reflected in material outcomes). No conversion rate exposed.

---

## 8. Transfer Semantics

- **Transfers answered:** `VoiceTransfer.status === "completed" && answered === true` on calls in population (scoped via `callId` in transfer query).
- **Transfers failed:** one event per call max via `callHasTransferFailedEvent` (outcome + transfer rows).

---

## 9. Callback Semantics

**Callbacks requested** only — from material outcome events.

---

## 10. Voicemail Semantics

Inbound population only: `voicemailCount / totalCalls` (inbound).

---

## 11. Timezone Resolution

`resolveVoiceBusinessTimezone(workspaceId)` loads appointment-receptionist setup and uses `ensureWizardOperatingMaturity` → `businessSchedule.timezone` (same canonical source as Business Knowledge).

Fallback: `America/New_York`.

---

## 12. Date/Day Bucketing

- Period: **local calendar days** — today plus previous `(days - 1)` days in business timezone (`voiceAnalyticsPeriodBounds`).
- Daily chart: `localDateKeyInTimezone(startedAt, timezone)` — **not** UTC `toISOString().slice(0,10)`.
- Legacy `byDay` on API root still UTC for compatibility.

---

## 13. KPI Selection

Six KPIs (inbound-only): Calls, Appointments booked, Transfers answered, Callbacks requested, Avg. duration, Voicemail.

No separate “Inbound calls” KPI (redundant with inbound-only population).

---

## 14. KPI Layout

`grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3` — six compact `StatCard` blocks on wide desktop (no 4+2 orphan row).

---

## 15. Primary Trend

`MctbAnalyticsChart` — daily call volume, ~240px, business-timezone buckets. SR-only table for accessibility.

---

## 16. Outcome Breakdown

Sorted event counts; includes explicit **Transfers answered** row; footnote on overlap.

---

## 17. Knowledge Gap Treatment

Point-in-time `openKnowledgeGaps` — contextual link only when &gt; 0; not in KPI row; unchanged by date range.

---

## 18. Receptionist Performance

Median response time (with sample copy), transfers failed, inbound voicemail.

---

## 19. Latency Coverage

Median + p95 in advanced; omitted/zero misrepresentation when no samples.

---

## 20. Sentiment Treatment

Shown only when analyzed count ≥ 10.

---

## 21. Usage Treatment

AI minutes + phone minutes; link to `/voice/billing`. No “total cost” label on partial call cost.

---

## 22. Advanced Treatment

Collapsed; p95 latency only when present.

---

## 23. Drill-Down Links

Real filters only: `/voice/calls?dateRange=7d|30d`, `filter=booked|transferred|messages`, `attention=open`, `/voice/knowledge#knowledge-gaps`, `/voice/billing`.

---

## 24. Loading/Empty/Error/Partial States

Skeleton KPI + chart; empty copy; error with retry; sentiment/usage partial omission.

---

## 25. Responsive Implementation

Per spec §35 — 2→3→6 KPI grid; chart reflow.

---

## 26. Accessibility

H1/H2, range `role="group"`, chart `aria-label`, SR-only daily table, KPI hints.

---

## 27. API/Aggregation Changes

Extended `loadVoiceAnalytics` with `receptionist` object + `timezone`. Legacy fields retained.

---

## 28. Compatibility With Reports/Billing

Root `totalCalls`, `answerRate`, `qualifiedRate`, `appointmentRate`, cost fields unchanged in shape for `/voice/reports` and billing.

---

## 29. Tests and Exact Results

```bash
npx vitest run src/lib/voice/analytics/voice-analytics-aggregate.test.ts src/lib/voice/analytics/voice-analytics-period.test.ts src/lib/voice/calls/outcome-display.test.ts
# 3 files, 16 tests passed

npx tsx scripts/test-voice-analytics-routing.ts
# OK
```

---

## 30. Runtime/Compiler Files Changed

**None** (Voice V3 runtime, LiveKit, executors, Prisma schema untouched).

---

## 31. Deferred Items

- After-hours filter/section
- Custom/Today ranges
- Export button (CSV not aligned — hidden)
- Per-tool success metrics
- Campaign/agent filters
- Knowledge gaps opened in period aggregate

---

## 32. Owner Certification Checklist

- [ ] Open `/voice/analytics` — does **not** land on MCTB Analytics
- [ ] 7/30/90 URL `?days=` persistence
- [ ] Call count vs Calls list (same period, inbound)
- [ ] Known booked call in appointments aggregate
- [ ] Booked + failed transfer increments both outcomes
- [ ] Chart day boundary near local midnight
- [ ] Business Knowledge gap link
- [ ] Billing link
- [ ] Mobile + 200% zoom
- [ ] Production route after deploy

---

VOICE ANALYTICS IMPLEMENTATION COMPLETE — OWNER UI CERTIFICATION REQUIRED
