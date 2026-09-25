# Voice Overview — Implementation Report

**Date:** 2026-09-25  
**Route:** `/voice/overview`  
**Governing spec:** `docs/VOICE-OVERVIEW-PAGE-SPECIFICATION.md`

**Status:** `VOICE OVERVIEW IMPLEMENTATION COMPLETE — OWNER UI CERTIFICATION REQUIRED`

---

## 1. Files changed

| Area | Path |
|------|------|
| Composition | `src/lib/voice/overview-summary.ts` |
| Presentation helpers | `src/lib/voice/overview-summary-present.ts` |
| Analytics snapshot | `src/lib/voice/analytics/receptionist-period-aggregate.ts`, `receptionist-analytics-snapshot.ts` |
| Attention count | `src/lib/platform/voice-attention-count.ts` |
| API | `src/app/api/voice/overview/route.ts` |
| Page | `src/app/(app)/voice/overview/page.tsx` |
| UI | `src/components/voice/voice-overview-dashboard.tsx` |
| Legacy shim | `src/lib/voice/overview.ts` (re-exports summary loader) |
| Tests | `*.test.ts` under voice/platform; `scripts/test-voice-overview-links.ts` |
| Audit script | `scripts/test-voice-api-audit.ts` |

---

## 2. Legacy Overview disposition

- **Removed** customer-facing legacy KPIs, date selector, quick-link grid, phone-minutes callout, fake “All systems normal,” failed-call attention panel.
- **`src/lib/voice/overview.ts`:** replaced implementation with deprecated re-export of `loadVoiceOverviewSummary` (alias `loadVoiceOverview`) for import stability.
- **Only other caller:** `scripts/test-voice-api-audit.ts` updated to `loadVoiceOverviewSummary`.

---

## 3. Final page structure

1. `PageHeader` — Overview  
2. First-run card OR operational status card  
3. Needs attention (conditional)  
4. Last 7 days — 3 KPIs + View analytics  
5. Recent calls (≤5)  
6. Dependency rows (Business Knowledge, Call Handling)  
7. Quiet Usage & billing link  

---

## 4. Composition loader architecture

- **`loadVoiceOverviewSummary(workspaceId)`** returns `{ data, errors }` with section-level partial failure keys.
- **Client boundary:** `VoiceOverviewDashboard` fetches `GET /api/voice/overview` (same pattern as Analytics); domain composition is server-side in the loader.
- **No** `resolveEffectiveCallHandler` on load.

---

## 5–8. State sources

| Concern | Source |
|---------|--------|
| Receptionist identity | `resolveCanonicalVoiceV3WorkspaceAgent` + `loadWizardFromAgent` |
| Publication | `publishedVersionId` → Draft / Active; no session `pendingPublication` |
| Phone / handler | `readCallHandlingBlock`, `assessAiReceptionistCallHandlingReadiness` (persisted only) |
| Readiness display | `deriveOverviewPublicationStatus` + `getWizardActivationIssues` (blocking only when not active) |

---

## 9–12. Calendar, knowledge, hours, attention

- **Calendar:** `wizardBookingRequiresCalendarConnection` + `resolveLiveCalendar`; href `/integrations` (matches Receptionist booking section).
- **Knowledge:** `VoiceKnowledgeGap` OPEN count; `VoiceKnowledgeSource` `status === 'failed'`.
- **Hours:** `resolveVoiceV2OperatingState` + `operatingStateLabel` (no new schedule evaluator).
- **Attention:** `countVoiceCallsNeedingAttention` → `loadNeedsAttentionItems` filtered by `VOICE_CALLS_ATTENTION_KINDS`; MCTB kinds excluded.

---

## 13–17. Metrics, recent calls, outcomes, KPIs

- **Metrics:** `loadReceptionistAnalyticsSnapshot(workspaceId, 7)` → same `aggregateReceptionistCalls` path as Analytics inbound population.
- **Recent calls:** Prisma `INBOUND`, `isTest: false`, `take: 5`, minimal `transfers` include.
- **Outcomes:** `deriveCallListOutcomeDisplay` (shared with Calls).
- **KPIs:** Exactly 3 — Calls, Appointments booked, Callbacks requested.

---

## 18–22. Dependencies, first-run, states, responsive, a11y

- Dependency rows omit Receptionist when operational card already has Manage link.
- First-run: no KPIs, recent calls, or attention.
- Section skeletons; per-region retry for metrics/calls failures.
- Frame `max-w-[1200px] px-4 py-6 sm:px-8`, `space-y-6`.
- Semantic H1/H2, keyboard links, mobile stacked call rows (~44px).

---

## 23. Legacy nav audit

- **`src/lib/products/ai-after-hours-nav.ts`** remains in use (`resolve-product-nav`, sidebar, mobile nav) with legacy labels (`AI Agent`, `/voice/inbound-routing`).
- **No change** in this pass (per instruction: smallest scope; MCTB `buildMctbV1Nav` is canonical for bundled Voice IA).

---

## 24. Tests and results

```text
vitest run (4 files, 9 tests) — PASS
tsx scripts/test-voice-overview-links.ts — PASS
```

---

## 25. Runtime / protected files

**NONE** modified among:

- Voice V3 runtime, LiveKit, GPT-Live, Sol delegation, tool executors, provider booking, SIP transfer, BK indexing, Prisma schema, MCTB runtime.

---

## 26. Deferred

- Extract `loadVoiceAnalytics` to call `loadReceptionistPeriodAggregate` (optional dedup; snapshot already shares aggregate module).
- Reconcile `ai-after-hours-nav` with locked six-destination IA (separate nav pass).
- Optional `countVoiceAttentionItems` SQL optimization (currently bounded `loadNeedsAttentionItems` filter).

---

## 27. Owner certification checklist

- [ ] First-run workspace (Start setup → `/mctb/voice-agent`)
- [ ] Active published receptionist
- [ ] Draft receptionist
- [ ] MCTB selected as global call handler (muted phone copy, not Voice failure)
- [ ] AI Receptionist selected + phone ready
- [ ] Booking on + calendar connected / disconnected
- [ ] Booking off + no calendar warning
- [ ] Open knowledge gaps + failed source
- [ ] Voice call attention count → Calls attention view
- [ ] No attention — region hidden
- [ ] Recent booked call; transfer-failed parity with Calls list classifier
- [ ] No calls empty copy
- [ ] 7-day KPI parity with Analytics
- [ ] Mobile + 200% zoom
- [ ] All canonical links
- [ ] Production `/voice/overview` after deploy

---

VOICE OVERVIEW IMPLEMENTATION COMPLETE — OWNER UI CERTIFICATION REQUIRED
