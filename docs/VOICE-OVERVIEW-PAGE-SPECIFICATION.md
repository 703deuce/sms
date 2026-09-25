# Transovo Voice — Overview Permanent Page Specification

**Route:** `/voice/overview`  
**Nav label:** Overview  
**Date:** 2026-09-25  
**Pass type:** READ-ONLY — source + data-semantics + UI architecture (no implementation)

**Governing IA (locked):** Overview · Calls · Receptionist · Business Knowledge · Call Handling · Analytics

**Governing rule:** **SUMMARY AND ACCESS — NEVER DUPLICATE OWNERSHIP.**

Overview is designed **last** because Calls, Receptionist, Business Knowledge, Call Handling, and Analytics now define canonical ownership. Overview owns almost nothing; it answers operational questions and links to canonical destinations.

---

## 1. Executive Design Decision

The permanent Overview is an **Operational Command Summary** — not a configuration editor, analytics workspace, calls list, needs-attention queue, or marketing homepage.

**Verdict:** Replace the current `/voice/overview` implementation entirely at the **presentation and aggregation** layer. Keep existing domain engines (canonical agent resolution, call-handling readiness, analytics `receptionist` slice, outcome classification, needs-attention loader, operating state, live calendar).

**Hard requirements:**

1. **No duplicate configuration** — greeting, voice, hours, transfers, forwarding, knowledge editors, calendar connect, recording, or notifications must not appear as controls; only status + deep links.
2. **No health score / fake uptime** — no “92% ready”, no “All systems operational” from config alone, no “Amy is online right now” without provider health signals (none exist today).
3. **Shared semantics** — recent-call outcomes and summary metrics must use the same inbound-only population and `deriveCallListOutcomeDisplay` / `aggregateReceptionistCalls` as Calls and Analytics.
4. **Quiet healthy state** — operational status is compact text/pills, not a giant green hero.
5. **First-run** — no zero-KPI wall when no receptionist exists; CTA to wizard at `/mctb/voice-agent`.
6. **Fixed period for metrics** — default **Last 7 days**, no large date-range control on Overview; link to `/voice/analytics?days=7`.
7. **Recent calls** — max **5** inbound non-test rows; link to `/voice/calls` and call detail.
8. **Attention** — aggregate **counts + canonical links** only; do not fork `loadNeedsAttentionItems` or build a second queue UI.

**Loader recommendation:** New composed server function `loadVoiceOverviewSummary` (name TBD) behind `GET /api/voice/overview` **replacing** the current ad-hoc Prisma metrics in `src/lib/voice/overview.ts`. It must **compose** existing services, not redefine business rules.

---

## 2. Current Overview Architecture

| Layer | Location | Role today |
|--------|----------|------------|
| Page | `src/app/(app)/voice/overview/page.tsx` | Client component; `useEffect` → `GET /api/voice/overview?days=1\|7\|30` |
| API | `src/app/api/voice/overview/route.ts` | `requireSession` → `loadVoiceOverview(workspaceId, days)` |
| Aggregation | `src/lib/voice/overview.ts` | Standalone Prisma counts; **not** aligned with Analytics receptionist population |
| Sub-nav | `VoiceSubNav` on page | **Renders null** on `/voice/overview` (`getVoiceSectionForPath` has no matcher — correct for standalone overview) |
| Product nav | `src/lib/products/mctb-nav.ts` | Overview = first item under **AI Receptionist** (locked IA) |
| Shell home | `src/lib/products/product-shell.ts` | `aiAfterHoursShellHome()` → `/voice/overview` |
| Legacy nav | `src/lib/products/ai-after-hours-nav.ts` | Older “AI Agent” / `/voice/inbound-routing` labels — **not** canonical IA; MCTB nav is authority for bundled product |

**Data flow today:** Single API call → mixed-direction metrics, server-local “today” midnight, 10 recent calls (all directions), `transferFailures: 0` hardcoded, campaign/agent KPIs, misleading “Needs attention” from `agentsWithErrors` + failed call rows.

**Not used today:** `loadVoiceAnalytics`, `aggregateReceptionistCalls`, `deriveCallListOutcomeDisplay`, `loadNeedsAttentionItems`, `resolveCanonicalVoiceV3WorkspaceAgent`, call-handling readiness, operating state, `openKnowledgeGaps` (except on Analytics page).

---

## 3. Current Element Inventory

| # | UI element | Source | Classification | Notes |
|---|------------|--------|----------------|-------|
| 1 | Page title “AI Voice overview” | `page.tsx` | **REWORD** | → “Overview” |
| 2 | Description “Live metrics for agents, phone calls, campaigns…” | `page.tsx` | **REWORD** | Operational summary copy (§24) |
| 3 | Days `<select>` (Today / 7 / 30) | `page.tsx` | **REMOVE** | Analytics owns exploration; Overview fixed 7d for metrics |
| 4 | `VoiceSubNav` | `page.tsx` | **REMOVE** mount | No section sub-nav on Overview (already null) |
| 5 | 4 quick-link cards (Calls, Receptionist, BK, Calls needs attention) | `page.tsx` | **SUMMARY/LINK** | Replace with activity CTAs + compact dependency rows (§30) |
| 6 | Violet “Phone minutes” explainer callout | `page.tsx` | **REMOVE** | Billing/Analytics territory |
| 7 | StatCard “Phone min — today” | `overview.ts` + page | **MOVE** | Analytics / billing only |
| 8 | StatCard “Phone min — yesterday” + delta | same | **MOVE** | Analytics / billing |
| 9 | StatCard “Calls today” | same | **REUSE** semantics via Analytics | Inbound 7d snapshot, not server-local today |
| 10 | StatCard `aiMinutesUsed` (mislabeled as phone minutes in header) | same | **REMOVE** from Overview | Usage summary on Analytics |
| 11 | StatCard “Active agents” | same | **REMOVE** | Multi-agent legacy; canonical = one V3 receptionist |
| 12 | StatCard “Answer rate” | same | **REMOVE** | Ambiguous; Analytics defines if shown |
| 13 | StatCard “Qualified leads” | same | **REMOVE** | Legacy lead scoring |
| 14 | StatCard “Appointments” | same | **SUMMARY/LINK** | Part of 3–4 KPI strip via `receptionist.appointmentsBooked` |
| 15 | StatCard “Running campaigns” | same | **REMOVE** | Out of V1 Voice IA scope (hidden product) |
| 16 | StatCard “Est. monthly cost” | same | **REMOVE** | Billing; quiet link only (§20) |
| 17 | Recent calls table (Direction, From, To, Status) | page | **REUSE** structure, **REPLACE** columns | Caller, Time, Duration, Outcome, Attention; inbound-only; max 5 |
| 18 | Needs attention panel | page | **DUPLICATE** | Not `loadNeedsAttentionItems`; shows agent config errors + failed calls |
| 19 | “All systems normal.” | page | **REMOVE** | Fake global health (§41) |
| 20 | Link status → call detail | page | **KEEP** | Row link to `/voice/calls/:id` |
| 21 | `assignedNumbers`, `inboundToday`, etc. | API type unused in UI | **LEGACY** | Drop from Overview API surface |
| 22 | `humanConnectionRate` in loader | `overview.ts` | **LEGACY** | Not exposed; misleading name |
| 23 | `transferFailures: 0` | `overview.ts` | **UNSUPPORTED** | Must use Analytics transfer-failed events if surfaced |
| 24 | No `max-w-[1200px]` wrapper | page | **REUSE** frame | Match Calls/Analytics (§23) |

---

## 4. Canonical Ownership Revalidation

| Domain | Owns | Overview may |
|--------|------|----------------|
| **Calls** | Call records, outcomes, recordings, transcripts, attention work on calls, transfer evidence | Show ≤5 recent inbound rows + link; attention **count** → `/voice/calls?attention=open` |
| **Receptionist** | Identity, voice, greeting, behavior, responsibilities, intake, booking behavior, test, save/publish | Name, published/active summary, voice label → `/voice/receptionist` |
| **Business Knowledge** | Core info, hours, timezone, website, FAQs, sources, gaps | Counts (open gaps, optional source issues) → `/voice/knowledge` / `#knowledge-gaps` / `#hours` |
| **Call Handling** | Phone/forwarding, answering/after-hours, transfers, waterfall, on-call, emergency, recording, notifications | Compact behavior summary if provable → `/voice/call-handling` |
| **Analytics** | Aggregates, trends, usage summary, exploration | **3–4** snapshot metrics, 7d, same `receptionist` definitions → `/voice/analytics?days=7` |
| **Overview** | Nothing configurational | Summarize + link only |

**Needs Attention** is **not** a primary nav destination. Calls embeds `NeedsAttentionView` at `/voice/calls?attention=open` using `loadNeedsAttentionItems` (`src/lib/platform/needs-attention.ts`). Voice-relevant kinds: `VOICE_CALLS_ATTENTION_KINDS` in `src/lib/platform/voice-attention-kinds.ts`.

---

## 5. Primary User Questions

Permanent Overview answers **in order**:

**A. Is my receptionist operational?**  
Provable: canonical agent exists, `published` + `ACTIVE`, call handling ownership (`activeCallHandler === ai_receptionist` when explicit), ingress number present, effective handler matches when cheap to verify.

**B. Is anything important wrong or unfinished?**  
Wizard blocking issues (`getWizardActivationIssues`), ingress/handler mismatch, calendar required but missing, open knowledge gaps, voice-calls attention count, failed knowledge sources (if queryable).

**C. What happened recently?**  
7-day snapshot metrics + 5 recent inbound calls with material outcomes.

**D. Where should I go next?**  
Every row/link goes to a canonical route — never inline editors.

---

## 6. Operational State Sources

| Customer concept | Source | Persisted field / table | Exact semantics | Reliable? | Overview treatment | Canonical owner |
|------------------|--------|-------------------------|-----------------|-----------|-------------------|-----------------|
| Receptionist exists | `resolveCanonicalVoiceV3WorkspaceAgent` | `VoiceAgent` + env `VOICE_V3_CANONICAL_AGENT_ID` / cert E164 | Appointment-receptionist agent for workspace | **High** when agent provisioned | First-run vs configured | Receptionist |
| Published / live | Same | `publishedVersionId` non-null | Runtime uses published version | **High** after reload | “Active” vs “Draft — publish required” | Receptionist |
| Agent status | Same | `VoiceAgent.status` | e.g. `ACTIVE`, `CONFIGURATION_ERROR` | **High** | Warning if not ACTIVE | Receptionist |
| Unsaved vs published diff | Editor only | `pendingPublication` React state | **Not persisted** | **No** on fresh load | Do **not** claim “unsaved changes” after reload | Receptionist |
| Ingress number assigned | Canonical agent + ingress resolver | `phoneNumberId`, `resolveCanonicalVoiceIngressPhoneNumberId` | Workspace-owned ingress DID | **Med** — may exist without handler switch | “Phone” row in status | Call Handling |
| Voice owns ingress | `readCallHandlingBlock` | `PhoneNumber.settingsJson` → `activeCallHandler`, `explicitSelectionAt` | User-selected handler | **Med** — requires explicit selection | “Answering with AI Receptionist” vs “Another product active” | Call Handling |
| Provider routing reality | `resolveEffectiveCallHandler` | Telnyx connection vs MCTB TeXML / V3 app | Live provider config | **Med** — network calls; use sparingly | Optional background check or “configured” only | Call Handling |
| MCTB owns ingress | Effective handler `mctb` | TeXML verify | PSTN routes to MCTB | **High** when verified | “Missed Call Text Back is answering” + link MCTB setup | Call Handling / MCTB |
| Forwarding to ingress | MCTB config | `loadMissedCallTextConfig`, forwarding verification | Business line → ingress | **Med** | Only if existing readiness helpers expose customer copy | Call Handling |
| Business name | Wizard state / agent config | `businessName` in draft/published config | Display identity | **High** | Receptionist summary | Receptionist / BK |
| Business hours / open now | `resolveVoiceV2OperatingState` | `operatingMaturity.businessSchedule` + workspace TZ | Open / closed / next open | **High** when schedule configured | “Open until …” or static schedule link | Business Knowledge |
| Timezone | Workspace / wizard | `Workspace.timezone` or config | IANA | **High** | Used for labels only | Business Knowledge |
| Open knowledge gaps | Prisma count | `VoiceKnowledgeGap` `status: OPEN` | Point-in-time, not period | **High** | Count + link | Business Knowledge |
| Knowledge source failure | `VoiceKnowledgeSource.status` | `failed` + `errorMessage` | Per-source indexing/crawl | **High** | Count sources `status === 'failed'` (query) | Business Knowledge |
| Calendar for booking | `resolveLiveCalendar` | `VoiceCalendarConnection` / integrations | `connected` providers | **High** when booking requires FIND/BOOK | Conditional row | Integrations / Receptionist |
| Transfer capability configured | `buildCallHandlingBehaviorSummary` | Wizard transfer fields | Derived labels | **High** from saved state | One-line summary | Call Handling |
| Recording / notifications | Wizard / call-handling | Various JSON fields | Config present | **Med** | Omit unless blocking issue from activation checklist | Call Handling |
| Recent successful call | `VoiceCall` | Latest `INBOUND` non-test `startedAt` | Proof of traffic | **High** | Optional info footnote only — not “online now” | Calls |

---

## 7. Publication State

**After full page reload, Overview can truthfully show:**

- **Setup required** — no `resolveCanonicalVoiceV3WorkspaceAgent` result.
- **Draft** — agent exists, `published === false`.
- **Active** — agent exists, `published === true`, `status === ACTIVE` (narrow: “published receptionist is active”).

**Overview must NOT claim:**

- “All current settings are live” (no persisted draft-vs-published diff).
- “Unpublished changes” ( `pendingPublication` is session-local in `voice-receptionist-editor.tsx`).

Optional copy when published: “Published configuration is active” — not “every edit is live.”

---

## 8. Phone / Ingress State

**Ownership chain:** Global call handling switcher (`src/lib/call-handling/*`) → `activeCallHandler` (`mctb` | `ai_receptionist`) on ingress phone `settingsJson` → `resolveEffectiveCallHandler` for provider truth.

**Customer-facing states (only if supported):**

| State | When |
|-------|------|
| Ready to receive calls | `assessAiReceptionistCallHandlingReadiness.ready === true` and effective handler is `ai_receptionist` |
| Phone setup needs attention | No ingress id, missing provider fields, or readiness `message` |
| Another call-handling product is active | `activeCallHandler === 'mctb'` or effective `mctb` while viewing Voice Overview |
| Finish phone setup | Wizard `phone` step incomplete / blocking (`computeMctbWizardStepReadiness`) |

**Do not show:** SIP trunk IDs, dispatch rules, LiveKit FQDN, Telnyx connection IDs.

**Link:** `/voice/call-handling` (canonical; not `/voice/inbound-routing` in locked IA).

---

## 9. Readiness Model

**No percentage.** Derived categories from persisted checks only:

| Category | Meaning |
|----------|---------|
| **Setup incomplete** | No canonical agent or wizard blocking issues |
| **Needs attention** | Blocking activation issue OR handler/ingress/calendar/knowledge failure |
| **Ready** | Published active agent + handler ready + no blocking issues |
| **Active with optional improvements** | Ready + non-blocking warnings (e.g. recording disclosure warning) |

See §47 matrix for per-check conditions.

---

## 10. First-Run Model

| State | UI |
|-------|-----|
| **No receptionist** | H1 + short explanation + **Start setup** → `/mctb/voice-agent`. No metrics, no recent calls, no attention card. |
| **Configured incomplete** | Operational region lists **specific** missing items with links (wizard step or canonical page). |
| **Active** | Full summary layout (§26–31). |

Wizard remains a **process** at `/mctb/voice-agent`, not permanent IA.

---

## 11. Attention Model

Overview shows **at most 3–5 aggregate rows** (count + label + link), built from:

1. **Voice calls queue** — filter `loadNeedsAttentionItems` to `VOICE_CALLS_ATTENTION_KINDS`, count items with `status === 'needs_attention'`, link `/voice/calls?attention=open`.
2. **Knowledge gaps** — `openKnowledgeGaps` count, link `/voice/knowledge#knowledge-gaps`.
3. **Setup blocking** — from `getWizardActivationIssues` blocking severity, link to appropriate wizard step or `/voice/receptionist`, `/voice/knowledge`, `/voice/call-handling`.

**Do not** list individual callback rows on Overview (Calls queue owns detail).

**Hide** attention region when all counts are zero (optional single quiet line: “No items need attention” — small text, not a large card).

---

## 12. Recent Activity

- **Source:** `VoiceCall.findMany` — `workspaceId`, `isTest: false`, `direction: INBOUND`, `orderBy: startedAt desc`, `take: 5`, include minimal fields for `deriveCallListOutcomeDisplay` (outcome, appointmentBooked, transferred, voicemailDetected, transfers relation if needed for transfer-failed badge).
- **Reuse:** `fmtCallPhone`, `fmtCallDateTable`, `fmtCallDurationTable`, `CallOutcomeBadge`, `CallAttentionBadge`, `deriveCallListOutcomeDisplay` from Calls list.
- **CTA:** “View all calls” → `/voice/calls`.
- **No** search, filter, pagination.

---

## 13. Summary Metrics

**Maximum 3–4 metrics**, period label **Last 7 days**:

| Proposed metric | Analytics field |
|-----------------|-----------------|
| Calls | `receptionist.totalCalls` |
| Appointments booked | `receptionist.appointmentsBooked` |
| Callbacks requested | `receptionist.callbacksRequested` |
| Optional 4th | `receptionist.voicemailCount` **or** transfers answered — only if product wants a fourth; default **3** |

**Source:** `loadVoiceAnalytics(workspaceId, 7).receptionist` — same population `inbound_non_test`, business timezone day keys for any derived copy.

**CTA:** “View analytics” → `/voice/analytics?days=7`.

---

## 14. Metric Population

Identical to Analytics implementation (`src/lib/voice/analytics/voice-analytics-aggregate.ts`):

- `isReceptionistAnalyticsCall`: `isTest === false` && `direction === 'INBOUND'`.
- Outcomes via `deriveCallMaterialOutcomeEvents` (not raw `VoiceCall.outcome` alone).
- Period: rolling 7 days with `resolveBusinessTimezone` + `buildAnalyticsPeriodBounds` (business TZ boundaries — same as Analytics impl).

---

## 15. Business Outcomes

Recent call **primary** outcome badge = `deriveCallListOutcomeDisplay(call).primary`.  
Attention badge = `deriveCallListOutcomeDisplay(call).attention` when present.

Aggregate metrics use material outcome **events** (Analytics), not Overview-local rules. A call may be “Appointment Booked” with a separate transfer-failed attention badge on the row (Calls Pass 2 semantics).

---

## 16. Business Knowledge Summary

**Allowed:**

- “N unanswered questions” from `VoiceKnowledgeGap` OPEN count.
- “N sources need attention” from `VoiceKnowledgeSource` where `status === 'failed'` (count query).

**Link:** “Review knowledge” → `/voice/knowledge` or `#knowledge-gaps`.

**Forbidden on Overview:** editors for website, hours, FAQs, sources.

---

## 17. Call Handling Summary

**Allowed (from saved wizard state + `buildCallHandlingBehaviorSummary`):**

- One line: transfers on/off + primary destination label.
- After-hours / on-call: only if `operatingMaturity` fields support a short label (e.g. “After-hours receptionist active”).

**Link:** “Manage call handling” → `/voice/call-handling`.

**Forbidden:** transfer editor, forwarding editor, recording toggles.

---

## 18. Receptionist Summary

**Allowed:**

- Display name (`agentName` from canonical agent).
- Status pill: Setup required | Draft | Active (from §7).
- Voice label: customer-facing voice name from published config (read-only string).

**Link:** “Manage receptionist” → `/voice/receptionist`.

---

## 19. Business Hours Summary

If `operatingMaturity.businessSchedule` exists and `resolveVoiceV2OperatingState` returns `open` / `closed` / `nextOpenAt`:

- Show: “Open until 5:00 PM” or “Closed · Opens Monday 9:00 AM” (workspace TZ).

Else: static “Business hours configured” with link to `/voice/knowledge#hours`.

**Do not** duplicate schedule editor.

---

## 20. Calendar / Integration State

When `wizardBookingRequiresCalendarConnection(state)` is true for the workspace agent config:

- **Connected:** “Microsoft Calendar connected” (or provider label from `resolveLiveCalendar`).
- **Not connected:** “Calendar connection needs attention” → canonical integration route used by Receptionist wizard (e.g. agent integrations or settings — **reuse existing href** from Receptionist dependency rows; do not invent new page).

When booking not enabled: omit calendar row.

---

## 21. Usage / Billing Treatment

- **No** monthly cost StatCard on Overview.
- Optional footer link: “Usage & billing” → `/voice/billing` if product shell already exposes it under Analytics section.
- Usage **summary** remains on Analytics.

---

## 22. Page Archetype

**Operational Overview / Command Summary** per `TRANSOVO-PAGE-ARCHITECTURE-RULES.md`.

Not: dashboard of charts, setup form, configuration workspace, analytics workspace.

---

## 23. Existing Visual Primitive Inventory

| Primitive | File | Used on | Overview reuse |
|-----------|------|---------|----------------|
| `PageHeader` | `src/components/ui/page-header.tsx` | Calls, Analytics, Receptionist | **Yes** — title, description, optional quiet actions |
| `StatCard` | `src/components/ui/card.tsx` | Analytics, current Overview | **Yes** — 3–4 compact KPIs only |
| `Card` | same | Calls recent table wrapper | **Yes** — single bordered regions |
| `Table` / `TR` / `TD` | `src/components/ui/table.tsx` | Calls, current Overview | **Yes** — recent calls |
| `CallOutcomeBadge` | `src/components/calls/call-outcome-badge.tsx` | Calls | **Yes** |
| `CallAttentionBadge` | `src/components/calls/call-attention-badge.tsx` | Calls | **Yes** |
| `DependencyRow` | `src/components/voice/dependency-row.tsx` | Receptionist, Call Handling | **Yes** — product summaries |
| `StatusPill` | `appointment-receptionist/ui.tsx` | Wizard / Receptionist | **Yes** — receptionist status |
| `InfoCallout` | same | Wizard | Sparingly for first-run |
| Skeletons | Calls/Analytics patterns | Section-level `animate-pulse` | **Yes** |
| MCTB Overview | `src/components/mctb/home/*` | Reference only | KPI strip density, needs-attention **link** pattern — not MCTB metrics |

**Do not** introduce a new dashboard visual system.

---

## 24. Page Frame

Match Calls and Analytics:

```text
mx-auto max-w-[1200px] px-4 py-6 sm:px-8
```

- Section vertical gap: `space-y-6` or `gap-6` between major regions.
- Card interior: `px-5 py-3` header band + table body (existing Calls pattern).
- Grid for KPIs: `grid gap-4 sm:grid-cols-3` (3 metrics) or `sm:grid-cols-2 lg:grid-cols-4` if fourth metric approved.

---

## 25. Header

- **H1:** Overview  
- **Description:** “See how your receptionist is running, what happened recently, and anything that needs your attention.”  
- **Actions:** None when active. First-run: primary CTA in operational region, not oversized header button.

---

## 26. Exact Information Hierarchy

1. Operational status (receptionist + dependencies)  
2. Needs attention (conditional)  
3. Last 7 days metrics (conditional on configured product)  
4. Recent calls (conditional)  
5. Compact dependency rows (Receptionist, Business Knowledge, Call Handling)

First viewport must answer: **Is Amy working, and is there anything I need to do?**

---

## 27. Operational Status Region

Quiet block (bordered card or stacked rows), **no hero banner**.

Example shape (only rows with data):

```text
AI Receptionist                    [Active | Draft | Setup required]
Amy · <voice label>
Phone                              Ready | Needs attention | MCTB answering
Calendar                           Connected | Needs attention (if booking on)
Business knowledge                 Ready | N unanswered · M source issues
Business hours                     Open until 5:00 PM (if engine supports)
                          Manage receptionist →
```

---

## 28. Needs Attention Region

Rendered only when Σ counts > 0:

```text
Needs attention
2 calls need follow-up             Review calls →
1 unanswered question              Review knowledge →
```

Use canonical URLs. No per-item transcripts.

---

## 29. Summary Metric Region

```text
LAST 7 DAYS                        View analytics →
[Calls]  [Appointments booked]  [Callbacks requested]
```

No trend charts.

---

## 30. Recent Calls Region

Desktop columns: Caller | Time | Duration | Outcome | Attention | chevron  
Mobile: stacked caller/time + outcome + attention; full row tap → detail.

Max 5 rows. Footer link View all calls.

---

## 31. Dependency / Quick Access Region

Max **3** `DependencyRow` blocks — not six nav cards.

Skip duplicate links to Calls and Analytics (already in activity sections).

---

## 32. Duplicate Configuration Removal

| Control currently elsewhere | Overview treatment |
|----------------------------|-------------------|
| Greeting / voice pickers | Status + link Receptionist |
| Business hours editor | Open/closed summary or link BK |
| Transfer / forwarding editors | One-line summary + link Call Handling |
| Knowledge / website / FAQ | Counts + link BK |
| Calendar OAuth | Status + link integrations |
| Recording / notifications | Omit or single warning from activation issues |
| Date range selector | Remove |
| Campaign / agent management | Remove |

---

## 33. Data Freshness

See §52 matrix. Rule: do not label heterogeneous sources as one “Live” badge.

---

## 34. First-Use State

See §10. No mock zeros.

---

## 35. Loading

Section skeletons preserving layout geometry. No full-page spinner.

---

## 36. Empty

| Case | Behavior |
|------|----------|
| Product not configured | Setup CTA only |
| Active, no calls | Operational status visible; “No calls yet” in recent region |
| No attention | Hide block or one quiet line |

---

## 37. Error

Independent regions: operational status may load while recent calls fail → inline retry on calls card only.

---

## 38. Partial

| Missing data | Behavior |
|--------------|----------|
| Analytics slice fails | Hide KPI strip; link to Analytics still ok |
| Recent calls fail | Message + retry |
| Knowledge counts fail | Omit knowledge count line |
| Calendar probe fails | Omit calendar row |

Do not flip global status to red.

---

## 39. Responsive

- Desktop: status + attention may share row if density allows (`lg:grid-cols-2`).
- Tablet: 2-col → 1-col.
- Mobile: single column; 44px touch targets on row links.

---

## 40. Accessibility

One H1; section H2s; status text not color-only; descriptive link text (“Review calls”, not “Click here”); keyboard navigable call rows; `aria-live` polite for attention counts if dynamically updated.

---

## 41. Health / Readiness Language

Forbidden: health %, “All systems operational”, “online right now” from config.

Allowed: concrete counts and states (“2 items need attention”, “Draft — publish required”).

---

## 42. Shared Domain Logic

| Concern | Module |
|---------|--------|
| Material outcomes | `src/lib/voice/calls/outcome-classification.ts` |
| List display | `src/lib/voice/calls/outcome-display.ts` |
| Analytics receptionist | `src/lib/voice/analytics.ts` + `voice-analytics-aggregate.ts` |
| Business TZ period | `src/lib/voice/analytics/voice-analytics-period.ts`, `resolve-business-timezone.ts` |
| Operating state | `src/lib/voice-receptionist-wizard/operating-maturity/operating-state.ts` |
| Call handling summary | `src/lib/voice/call-handling/behavior-summary.ts` |
| Canonical agent | `src/lib/voice-v3/canonical-workspace-agent.ts` |
| Readiness | `src/lib/call-handling/readiness.ts` |
| Attention | `src/lib/platform/needs-attention.ts` + `voice-attention-kinds.ts` |
| Activation issues | `src/lib/solutions/appointment-receptionist/capability-checklist.ts` |

**Proposed extraction:** `loadVoiceOverviewSummary` in `src/lib/voice/overview-summary.ts` (new) composing above — **no** duplicated classifiers in React.

---

## 43. API / Loader Strategy

**Recommendation: Option C + thin API**

- Server function `loadVoiceOverviewSummary(workspaceId)` composes domain services in one `Promise.all` with **per-section error capture** (partial results).
- `GET /api/voice/overview` returns `{ data, errors?: { recentCalls?: string, metrics?: string } }`.
- **Do not** extend client to 6+ round trips.
- **Do not** redefine metrics inside the route.

Alternative considered: call `loadVoiceAnalytics` only — insufficient for operational status (agent, handler, calendar, wizard issues).

---

## 44. Performance

**Avoid:** full transcripts, recordings, analytics history, all knowledge sources, unbounded attention list.

**Prefer:**

- `take: 5` recent calls with minimal `select` / `include`.
- `loadVoiceAnalytics(7)` or shared subset query (may be heavy — consider extracting `loadReceptionistAnalyticsSnapshot` reusing same query path as Analytics).
- `count` for gaps and failed sources.
- Attention: **count** via filtered query or `loadNeedsAttentionItems` with early exit after count (implementation may add `countVoiceAttentionItems` helper).

**Indexes:** existing on `VoiceCall(workspaceId, startedAt)`, `VoiceKnowledgeGap(workspaceId, status)`.

No schema migration required for V1.

---

## 45. Security / Privacy

Match Calls list: `fmtCallPhone` masking rules; contact name when `contactId` resolved; no transcript snippets; no recording URLs; workspace scoping on every query; `requireSession` on API.

---

## 46. Implementation Reconciliation Matrix

| Current element | Current source | Classification | Permanent destination | Proposed Overview treatment | Runtime/data risk |
|-----------------|----------------|----------------|----------------------|----------------------------|-------------------|
| Title/description | page.tsx | REWORD | Overview header | Operational copy | Low |
| Days select | page.tsx | REMOVE | Analytics | Fixed 7d label | Low |
| Quick-link cards | page.tsx | SUMMARY/LINK | Various | Dependency rows + CTAs in sections | Low |
| Phone minutes callout | page.tsx | REMOVE | Billing/Analytics | None | Low |
| 10× StatCard grid | overview.ts | REMOVE/MOVE | Analytics/Billing | 3 StatCards max | Med — must use receptionist slice |
| Recent calls table | overview.ts | REUSE | Calls semantics | 5 inbound + outcomes | Med — needs transfer include |
| Needs attention panel | overview.ts | DUPLICATE | Calls attention API | Aggregate counts | Med — must filter kinds |
| agentsWithErrors | VoiceAgent health | MOVE | Receptionist | Activation/warning row | Low |
| recentFailures | failed VoiceCalls | REMOVE | Calls list filter | Use attention queue not raw failures | High if kept — mislabels attention |
| runningCampaigns | VoiceCampaign | REMOVE | Hidden product | None | Low |
| qualifiedLeads | leadScore≥40 | REMOVE | Legacy | None | Low |
| answerRate | status ratio all directions | REMOVE | Analytics (if ever) | None | High misleading |
| monthlyCostCents | usage records | REMOVE | Billing | Optional link | Low |
| activeAgents count | VoiceAgent ACTIVE | REMOVE | N/A | Single canonical agent | Low |
| API `days` param | route | REMOVE | — | Hardcode 7 for metrics | Low |

---

## 47. Operational Readiness Matrix

| Check | Source | Exact condition | Level | Customer wording | Destination |
|-------|--------|-----------------|-------|------------------|-------------|
| Agent exists | `resolveCanonicalVoiceV3WorkspaceAgent` | non-null | Blocking if false | Set up your AI Receptionist | `/mctb/voice-agent` |
| Published | `publishedVersionId` | `published === true` | Blocking for “ready” | Publish to go live | `/voice/receptionist` |
| Status ACTIVE | `VoiceAgent.status` | `=== 'ACTIVE'` | Warning | Receptionist needs attention | `/voice/receptionist` |
| Voice owns calls | `readCallHandlingBlock` | `activeCallHandler === 'ai_receptionist'` && explicit | Blocking for Voice ops | Another product is answering | `/voice/call-handling` |
| Ingress ready | `assessAiReceptionistCallHandlingReadiness` | `ready === true` | Blocking | Phone setup needs attention | `/voice/call-handling` |
| Business name | wizard config | `wizardHasBusinessName` | Blocking in wizard | Add business name | `/voice/knowledge` or wizard |
| Calendar | `resolveLiveCalendar` + booking capability | required ⇒ `connected` | Blocking if booking on | Calendar connection needs attention | Integrations link from Receptionist |
| Transfer dest | activation issues | `blocking.has('transfer')` | Blocking if transfers enabled | Add transfer destination | `/voice/call-handling` |
| Knowledge gaps | gap count | `openKnowledgeGaps > 0` | Info | N unanswered questions | `/voice/knowledge#knowledge-gaps` |
| Failed sources | `VoiceKnowledgeSource` | `status === 'failed'` | Warning | Sources need attention | `/voice/knowledge` |
| Recording disclosure | wizard warnings | `recording_disclosure` warning | Info | Review recording settings | `/voice/call-handling` |

---

## 48. Attention Matrix

| Attention type | Source | Count/query | Severity | Overview wording | Destination |
|----------------|--------|-------------|----------|------------------|-------------|
| Callback request | `loadNeedsAttentionItems` | kind `callback_request`, voice filter | High | “N calls need follow-up” (aggregate) | `/voice/calls?attention=open` |
| Failed transfer | same | `failed_transfer` | High | included in calls aggregate | same |
| Voicemail | same | `voicemail` | Med | included in calls aggregate | same |
| Form submission | same | `form_submission` | Med | included | same |
| Repeat caller | same | `repeat_caller` | Med | included | same |
| Unanswered knowledge | `voiceKnowledgeGap.count` OPEN | count | Med | “N unanswered questions” | `/voice/knowledge#knowledge-gaps` |
| Setup blocking | `getWizardActivationIssues` | blocking.length | High | “Finish setup: …” | step-specific |
| MCTB missed-call reply | needs-attention | **Exclude** from Voice overview | — | MCTB product | MCTB routes |

---

## 49. Metric Matrix

| Metric | Source | Definition | Period | Population | Same as Analytics? | Overview |
|--------|--------|------------|--------|------------|---------------------|----------|
| Calls | `receptionist.totalCalls` | inbound non-test count in period | 7d | inbound_non_test | Yes | StatCard |
| Appointments booked | `receptionist.appointmentsBooked` | `appointmentBooked` on population | 7d | same | Yes | StatCard |
| Callbacks requested | `receptionist.callbacksRequested` | material outcome Callback Requested | 7d | same | Yes | StatCard |
| Voicemail (optional 4th) | `receptionist.voicemailCount` | `voicemailDetected` | 7d | same | Yes | Optional |
| Phone minutes | legacy overview | talk time | — | all directions | No | **Exclude** |
| Qualified leads | legacy | leadScore≥40 | — | — | No | **Exclude** |
| Answer rate | legacy | status ratio | — | all directions | No | **Exclude** |

---

## 50. Recent Call Matrix

| Field | Source | Display helper | Privacy | Link |
|-------|--------|----------------|---------|------|
| Caller | `contact` or `fromE164` INBOUND | `fmtCallPhone` + name | Same as Calls | `/voice/calls/:id` |
| Time | `startedAt` | `fmtCallDateTable` | — | same |
| Duration | `durationSeconds` | `fmtCallDurationTable` | — | same |
| Outcome | call row + transfers | `deriveCallListOutcomeDisplay` → `CallOutcomeBadge` | — | same |
| Attention | derived | `CallAttentionBadge` | — | same |

---

## 51. Dependency Summary Matrix

| Dependency | Source | State shown | Overview may say | Owner |
|------------|--------|-------------|------------------|-------|
| Receptionist | canonical agent + config | name, published, voice | “Amy · Active” | `/voice/receptionist` |
| Phone/ingress | readiness + handler block | ready / MCTB / incomplete | “Phone ready” / “Needs attention” | `/voice/call-handling` |
| Calendar | `resolveLiveCalendar` | connected / not | Provider label | Integration route |
| Business Knowledge | gaps + sources | counts | “2 unanswered questions” | `/voice/knowledge` |
| Business hours | operating state | open/closed | “Open until …” | `/voice/knowledge#hours` |
| Call Handling | `buildCallHandlingBehaviorSummary` | transfers summary | “Transfers to Front Desk when needed” | `/voice/call-handling` |

---

## 52. Data Freshness Matrix

| UI element | Source | Query time | Persisted vs derived | Publish dependent? | Failure behavior |
|------------|--------|------------|----------------------|--------------------|------------------|
| Agent status | DB | load | persisted | No | Setup required |
| Published flag | DB | load | persisted | No | Draft label |
| Handler ownership | phone settingsJson | load | persisted | No | Omit row if unknown |
| Effective handler | Telnyx API | optional | live provider | No | Show configured only |
| 7d metrics | analytics aggregate | load | point-in-time | No | Hide strip |
| Open gaps | count | load | point-in-time | No | Omit line |
| Recent calls | DB | load | persisted | No | Retry region |
| Operating open/closed | computed | load schedule | persisted schedule | No | Link only |
| Attention counts | DB composite | load | mixed | No | Omit block |

---

## 53. Component Reuse Matrix

| Region | Component | File | Reuse unchanged? | Adapter |
|--------|-----------|------|------------------|---------|
| Header | PageHeader | ui/page-header | Yes | Copy only |
| KPIs | StatCard | ui/card | Yes | Labels |
| Recent calls | Table + badges | calls/* | Yes | Data fetch |
| Attention | Custom list | new thin | Pattern from MCTB home | Counts only |
| Dependencies | DependencyRow | voice/dependency-row | Yes | Props |
| Status | StatusPill | appointment-receptionist/ui | Yes | Map from agent |
| Loading | skeleton divs | — | New | Match Calls |

---

## 54. Exact Text Wireframe

```text
OVERVIEW
See how your receptionist is running, what happened recently,
and anything that needs your attention.

── FIRST RUN (no canonical agent) ──
AI Receptionist
Set up your receptionist to answer calls, help callers, and handle
appointments after hours.
[Start setup → /mctb/voice-agent]

── ACTIVE (example — rows only when provable) ──

[Operational status card]
AI Receptionist                          Active
Amy · Warm professional (voice label)
Phone                                    Ready
Calendar                                 Microsoft Calendar connected
Business knowledge                       2 unanswered questions
Business hours                           Open until 5:00 PM
                              Manage receptionist →

[Needs attention — only if counts > 0]
Needs attention
2 calls need follow-up                   Review calls →
1 unanswered question                  Review knowledge →

[Metrics — only if configured]
LAST 7 DAYS                              View analytics →
Calls          42
Appointments booked    8
Callbacks requested  5

[Recent calls]
RECENT CALLS                             View all calls →
Caller          Time       Duration   Outcome            Attention
Jane Smith      Today 2p   03:12      Appointment Booked —
(555) 234-5678  Today 11a  01:05      Callback Requested Needs attention
… max 5 rows

[Dependency rows]
Business Knowledge
2 unanswered questions · 1 source needs attention
                              Review knowledge →

Call Handling
Calls transfer to Front Desk when needed
                              Manage call handling →

── Footer (optional) ──
Usage & billing →
```

---

## 55. Density Review

| Metric | Estimate (active, healthy) |
|--------|----------------------------|
| First viewport | Header + operational card (5–6 rows) + maybe attention |
| Card count | 3–4 bordered regions (status, metrics, calls, dependencies) |
| Table rows | ≤5 |
| Page length | ~1–1.5 screens desktop; mobile similar scroll |
| Risk flags | Current page = 10 KPIs + 4 nav cards + 2 large cards — **reduce ~70%** |

---

## 56. Visual Failure Checklist

| Failure mode | Spec compliance |
|--------------|-----------------|
| Giant green success banner | **Avoid** |
| Giant AI hero | **Avoid** |
| Six navigation cards | **Avoid** — max 3 dependency rows |
| Duplicate configuration | **Avoid** — §32 |
| Full Analytics duplication | **Avoid** — 3 KPIs only |
| Full Calls duplication | **Avoid** — 5 rows, no filters |
| Fake real-time health | **Avoid** — §41 |
| Fake readiness score | **Avoid** — §40 |
| Zero KPI grid before setup | **Avoid** — §33 |
| Provider jargon | **Avoid** |
| Technical IDs | **Avoid** |
| Card soup | **Avoid** — merge related rows |
| Excessive whitespace | Match Calls density |

---

## 57. Implementation Risks

1. **`loadVoiceAnalytics(7)` cost** on every Overview landing — mitigate with shared snapshot helper or parallel query reuse; cache short TTL optional later (not V1).
2. **Transfer relation on recent calls** — list API may need `include: { transfers: true }` for `deriveCallListOutcomeDisplay` parity with Calls (verify Calls list payload).
3. **Attention count without loading 100 items** — may need dedicated count query per kind.
4. **`resolveEffectiveCallHandler` latency** — default to persisted handler block; provider verify async or omit.
5. **Wizard state load** — must read same source as Receptionist (`GET` appointment-receptionist or shared loader) for summaries — do not third-store.
6. **Legacy `ai-after-hours-nav`** still points Call Handling to `/voice/inbound-routing` — Overview spec uses **`/voice/call-handling`** per locked IA; shell nav is separate cleanup.

---

## 58. Exact Implementation Boundary

**Expected UI work**

- `src/app/(app)/voice/overview/page.tsx` — prefer server wrapper + client islands OR full server component with streaming sections.
- New `src/components/voice/overview/*` (status, attention strip, recent calls, metrics strip).
- `src/lib/voice/overview-summary.ts` (compose loaders).

**Possible aggregation work**

- `countVoiceAttentionItems(workspaceId)` in platform layer.
- Thin wrapper `loadReceptionistMetricsSnapshot(workspaceId, 7)` extracted from analytics if full `loadVoiceAnalytics` is too heavy.

**Must not change**

- LiveKit / GPT-Live / Sol / voice tool executors  
- Provider booking implementations  
- SIP transfer implementation  
- BK indexing pipelines  
- Receptionist persistence schema  
- Prisma schema  
- MCTB runtime  

---

## 59. Open Questions / Blockers

| # | Question | Impact | Proposed resolution |
|---|----------|--------|---------------------|
| 1 | Should Overview call `resolveEffectiveCallHandler` on every load? | Perf + Telnyx rate | Default **no** — show persisted `activeCallHandler` only; optional “Verify routing” on Call Handling |
| 2 | Fourth KPI metric — voicemail vs transfers answered? | Layout | Product pick; default **3 KPIs** |
| 3 | Exact calendar deep link for all tenants | Consistency | Reuse `DependencyRow` href from `voice-receptionist-editor.tsx` |
| 4 | Include MCTB attention items when both products entitled? | IA purity | **Exclude** from Voice Overview; MCTB Overview owns MCTB attention |
| 5 | Server vs client page | SEO/perf | Prefer **server-first** with RSC for status + metrics |
| 6 | Calls list API includes `transfers` for outcome display? | Recent calls parity | Verify during implementation; extend select if missing |

**Blockers:** None for spec approval. Implementation should wait for human review of §47 and §48 matrices.

---

VOICE OVERVIEW PAGE SPEC COMPLETE — READY FOR IMPLEMENTATION REVIEW
