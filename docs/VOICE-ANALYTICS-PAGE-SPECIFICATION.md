# Transovo Voice — Analytics Permanent Page Specification

**Route:** `/voice/analytics`  
**Nav label:** Analytics  
**Date:** 2026-09-25  
**Status:** READ-ONLY — source + data-semantics + UI architecture pass (no implementation).

**Governing IA:** Overview · Calls · Receptionist · Business Knowledge · Call Handling · **Analytics** (locked six-destination Voice product).

**Governing question:** What can Transovo **truthfully measure today** for Voice V3 / after-hours receptionist inbound behavior — then design the permanent UI around those facts.

---

## 1. Executive Design Decision

Voice Analytics is an **Analytical Workspace** that aggregates **non-test `VoiceCall` rows** and related workspace tables over a **rolling 7 / 30 / 90-day window** (server `Date` math, not workspace timezone). It must **not** compete with Calls (per-call truth), Receptionist (configuration), Business Knowledge (gap remediation), or Call Handling (policies).

**Verdict:** Implementation is **feasible without runtime/schema changes** for a credible V1 page, but **requires**:

1. **Remove or override** `next.config.ts` redirect `{ source: "/voice/analytics", destination: "/mctb/analytics" }` so the Voice dashboard route is reachable in production (today nav points at Voice analytics while config sends users to MCTB analytics).
2. **Aggregation semantics fixes** (API layer only): align outcome KPIs with `deriveCallDetailMaterialOutcomes` (event-style counts), fix misleading labels (`humanAnswerRate` ≠ human staff answered), and label period-sensitive vs point-in-time metrics (`openKnowledgeGaps`).
3. **UI exposure** of already-computed backend fields (`byDay`, transfer table metrics, response latency, usage costs) using proven Transovo primitives (`PageHeader`, `StatCard`, `MctbAnalyticsChart` pattern).

**Defer / do not expose:** `byCampaign`, generic `toolSuccessRate`, pie charts, fake “conversion %”, agent filter (single-receptionist V1), after-hours segment (no backend filter yet), “Today” until timezone + API support exist.

**Overview** remains out of scope; it will summarize this page last.

---

## 2. Current Analytics Architecture

| Layer | Location | Role |
|--------|----------|------|
| Page | `src/app/(app)/voice/analytics/page.tsx` | Renders `VoiceAnalyticsDashboard` |
| Legacy stub | `src/app/(app)/voice/analytics/after-hours/page.tsx` | `redirect("/voice/analytics")` |
| UI | `src/components/voice/voice-analytics-dashboard.tsx` | Client fetch; subset of API fields |
| API | `GET /api/voice/analytics` | `loadVoiceAnalytics(workspaceId, days, filters?)`; permission `view_analytics` |
| Export | `GET /api/voice/analytics/export` | CSV via `analyticsToCsv` (subset; **no query filters**) |
| Aggregation | `src/lib/voice/analytics.ts` | Single function; in-memory reduce after `findMany` |
| Billing overlap | `src/lib/voice/billing-dashboard.ts` | Reuses `loadVoiceAnalytics` + usage breakdown |
| Reports | `src/app/(app)/voice/reports/page.tsx` | Also fetches `/api/voice/analytics` |
| MCTB product | `src/app/(app)/mctb/analytics/page.tsx` | **Different** `loadMctbAnalytics` — missed-call recovery, not Voice |
| Redirect conflict | `next.config.ts` L65 | `/voice/analytics` → `/mctb/analytics` (**blocks Voice page in deployed builds**) |
| Smart routing | `src/app/(app)/smart-routing/analytics/page.tsx` | Redirects to `/voice/analytics` (inherits same config issue) |

**Data flow:** Prisma `voiceCall.findMany` (filtered) → JS aggregates → JSON. Secondary queries: `voiceTransfer`, `voiceUsageRecord`, `voiceConversationInsight`, `voiceToolExecution`, `voiceFailureDiagnostic`, `voiceKnowledgeGap.count`.

**Not used by analytics UI today:** API filter query params, export endpoint, most numeric fields returned by `loadVoiceAnalytics`.

---

## 3. Exhaustive Metric Inventory

Population baseline for call-scoped metrics: `workspaceId` match, `startedAt >= now - days`, **`isTest: false`**. Unless noted, metrics are **inclusive of inbound and outbound** calls.

| Metric | Customer-facing name (proposed) | Source field(s) | DB / query | Calculation | Unit | Population | Date basis | Filters | Null handling | Legacy? | V3 relevant? | Confidence |
|--------|-----------------------------------|-----------------|------------|-------------|------|------------|------------|---------|---------------|---------|--------------|------------|
| `periodDays` | (meta) | param | — | 7/30/90 only | days | — | rolling | — | default 30 | no | yes | High |
| `totalCalls` | Calls | `VoiceCall` | findMany count | `calls.length` | count | non-test, started in window | `startedAt` | optional API filters | empty → 0 | no | yes | High |
| `inbound` | Inbound calls | `direction` | same | `direction === INBOUND` | count | subset | same | same | — | no | yes | High |
| `outbound` | Outbound calls | `direction` | same | `OUTBOUND` count | count | subset | same | same | — | **campaign/outbound** | partial | High |
| `answerRate` | Answer rate | `status` | same | statuses in `ANSWERED, IN_PROGRESS, COMPLETED, TRANSFERRED` / total | ratio | all directions | same | same | total=0 → 0 | ambiguous label | medium | **Med** — not “Amy answered” |
| `humanAnswerRate` | (mislabel risk) | `answeredAt`, `voicemailDetected`, `status` | same | `answeredAt` set, not voicemail, status not in NO_ANSWER/BUSY/FAILED/CANCELLED/VOICEMAIL / total | ratio | all directions | same | same | total=0 → 0 | name misleading | yes | **Med** — means live conversation w/o VM |
| `noAnswerRate` | No answer rate | `status === NO_ANSWER` | same | count/total | ratio | same | same | same | — | yes | medium | Med |
| `failureRate` | Failure rate | `FAILED`, `BUSY` | same | count/total | ratio | same | same | same | — | yes | medium | Med |
| `voicemailRate` | Voicemail rate | `voicemailDetected` | same | count/total | ratio | **all directions** | same | same | — | yes | **should be inbound-only UI** | Med |
| `transferRate` | Transfer rate (call flag) | `transferred` | same | count/total | ratio | same | same | same | — | yes | Med |
| `successfulTransferRate` | Transfer success rate | `VoiceTransfer` | separate findMany by `createdAt` | `status===completed && answered` / transfer rows | ratio | transfers in window | **`createdAt`** not call `startedAt` | **not** call filters | no transfers → 0 | yes | **Med** — human answered on transfer leg |
| `qualifiedRate` | Qualified lead rate | `leadScore >= 40` | calls | count/total | ratio | same | same | same | legacy lead scoring | **legacy** | low | Low |
| `appointmentRate` | Appointment rate | `appointmentBooked` | calls | count/total | ratio | same | same | same | conflates booked vs requested | yes | **Misleading as conversion** | Med |
| `avgDurationSeconds` | Average duration | `durationSeconds` | calls | sum/n | seconds | calls with duration summed (null→0) | same | same | null→0 in sum | yes | High |
| `totalCostCents` | Call-attributed cost | `costCents` | calls | sum | cents | same | same | same | 0 default | partial | **incomplete total** | Med |
| `costPerCall` | Cost per call | derived | — | totalCost/total rounded | cents | same | same | same | — | partial | Med |
| `costPerQualifiedLead` | Cost per qualified lead | derived | — | totalCost/qualified | cents | qualified>0 | same | — | — | legacy | Low |
| `costPerAppointment` | Cost per appointment | derived | — | totalCost/appointments | cents | appts>0 | same | — | — | yes | Med |
| `aiMinutes` | AI minutes | `VoiceUsageRecord` | category `ai_minutes` | sum quantity | minutes | usage rows in window | **`createdAt`** | not tied to call filters | — | yes | Med |
| `telephonyMinutes` | Telephony minutes | usage | category `telephony` | sum | minutes | same | `createdAt` | — | — | yes | Med |
| `modelCostCents` | Model cost | usage | `model` or `llm` | sum billed/provider | cents | same | `createdAt` | — | — | yes | Med |
| `transcriptionCostCents` | Transcription cost | usage | `transcription` | sum | cents | same | `createdAt` | — | — | yes | Med |
| `byDay` | Daily call volume | `startedAt` | calls | `toISOString().slice(0,10)` keys | count/day | same | **UTC date** | call filters only | — | yes | **TZ wrong for customer** | Med |
| `byAgent` | Per-agent rollup | `agentId` | calls | calls, qualified, costCents | mixed | same | same | same | `none` bucket | multi-agent era | **low for V1** | Med |
| `byCampaign` | Per-campaign | `campaignId` | calls | count | count | same | same | same | `none` | **outbound campaigns** | **no for V1 Voice** | High (as “hide”) |
| `outcomes` | Raw outcome keys | `outcome` or `status` | calls | frequency map | count | same | same | same | fallback `status` | messy strings | yes | **Low for UI as-is** |
| `sentimentCounts` | Sentiment | `VoiceConversationInsight.sentiment` | insights by `createdAt` | substring match pos/neg/neu | count | insights in window | insight `createdAt` | **not** call-filtered | unknown bucket | post-call LLM/heuristic | partial | **Low** |
| `toolSuccessRate` | Tool success | `VoiceToolExecution` | workspace executions | completed/(completed+failed) | ratio | all tools lumped | `createdAt` | not call-filtered | no execs → 0 | — | **not customer-safe aggregate** | Low |
| `toolFailures` | Tool failures | same | same | failed count | count | same | same | — | — | internal | Low |
| `latency.avgToolLatencyMs` | Tool latency avg | `latencyMs` | tool execs | mean of non-negative | ms | execs with latency | `createdAt` | — | — | technical | Low |
| `latency.p95ToolLatencyMs` | Tool latency p95 | same | sorted | p95 index | ms | same | same | — | — | technical | Low |
| `latency.avgResponseLatencyMs` | Response latency avg | `VoiceCall.metadata.responseLatency` | calls | samples or medianMs per call | ms | calls with metadata samples | call window | call filters | null if no samples | **V3 telemetry** | partial coverage | **Med** |
| `latency.medianResponseLatencyMs` | Median response | same | sorted samples | median | ms | same | same | same | null | V3 | partial | Med |
| `latency.p95ResponseLatencyMs` | p95 response | same | sorted | p95 | ms | same | same | same | null | V3 | partial | Med |
| `latency.responseLatencyMetric` | (definition string) | constant | — | caller EOS → first audible agent audio | — | — | — | — | — | yes | High |
| `latency.diagnosticCounts` | Failure diagnostics | `VoiceFailureDiagnostic` | top 500 rows | `category:code` counts | count | `createdAt` window | not call-filtered | — | internal | Low |
| `voiceProduct.callbacksRequested` | Callbacks | `outcomes` map | derived | outcome string contains `CALLBACK` | count | **event from raw outcomes** | same | — | overlaps | yes | Med |
| `voiceProduct.messagesTaken` | Messages | outcomes | contains `MESSAGE` | count | event | same | — | — | yes | Med |
| `voiceProduct.emergenciesEscalated` | Emergencies | outcomes | contains `EMERGENCY` | count | event | same | — | — | yes | Med |
| `voiceProduct.transferAttempts` | Transfer attempts | `VoiceTransfer` | count rows | `transfers.length` | count | transfer `createdAt` window | **misaligned with call window filters** | — | yes | Med |
| `voiceProduct.transferCompleted` | Transfers completed | transfers | `status===completed` | count | count | same | same | — | not human answered | yes | Med |
| `voiceProduct.transferFailed` | Transfers failed | transfers + outcomes | max(table failed, outcome match) | count | count | same | — | — | yes | Med |
| `voiceProduct.appointmentsBooked` | Appointments booked | `appointmentBooked` | calls | count | count | same | same | — | yes | High |
| `voiceProduct.spamOrSolicitorOutcomes` | Spam/solicitor | outcomes | SOLICIT/SPAM/UNWANTED | count | event | same | — | — | yes | Med |
| `voiceProduct.openKnowledgeGaps` | Open knowledge gaps | `VoiceKnowledgeGap` | `status OPEN` count | **all-time open**, not period | count | workspace | **not period-filtered** | — | yes | High count semantics |

---

## 4. Metric Classification

| Class | Metrics |
|-------|---------|
| **A. Business outcome** | Appointments booked (`appointmentBooked`), callbacks/messages/emergencies/spam (outcome substring aggregates), transfer completed/failed (with caveats), material outcomes from Calls taxonomy |
| **B. Call activity** | totalCalls, inbound, outbound, avg duration, voicemail (inbound presentation), byDay volume |
| **C. Performance / experience** | response latency (metadata), transfer success rate (answered), tool latency/success (internal) |
| **D. Cost / usage** | call `costCents`, usage record categories, billing dashboard breakdown |
| **E. Quality / insight** | sentimentCounts, openKnowledgeGaps (point-in-time), diagnostics |
| **F. Legacy / unsuitable** | qualifiedRate, byCampaign, generic toolSuccessRate, raw `outcomes` keys as customer labels, answerRate as “performance” without definition |

---

## 5. Call Population Definition

**Authoritative analytics population today:**

- Table: `voice_calls`
- `workspaceId` = current workspace
- `isTest: false` (**excludes** wizard/browser test calls flagged test; does not automatically exclude all demo paths — depends on `isTest` persistence)
- `startedAt >= (now - days)` using server-local `Date` (not workspace TZ, not calendar “today”)
- Optional API filters: `agentId`, `campaignId`, `direction`, `outcome`, `phoneNumberId` (UI does not pass these)

**Includes:** PSTN and non-test sessions that create `VoiceCall` rows, inbound receptionist and outbound campaign calls unless filtered.

**Excludes:** `isTest: true` calls.

**Not filtered:** spam/solicitor short calls, failed setup, zero-duration — all count if row exists.

**Recommended customer label:** **Calls** with help text: “Non-test voice calls in the selected period.” Do not label **Calls handled** until after-hours/eligibility semantics exist.

---

## 6. Outcome Semantics

**Calls canonical derivation:** `src/lib/voice/calls/outcome-display.ts`

- List: `deriveCallListOutcomeDisplay` → one **primary** badge + optional **attention** badge.
- Detail: `deriveCallDetailMaterialOutcomes` → **set** of material outcomes (overlap allowed). Tests prove booked + transfer failed on same call.

**Analytics today:** `outcomes` map uses raw `VoiceCall.outcome` (fallback `status`) — **does not** use derivation. `voiceProduct.*` uses **substring matching** on outcome keys — **double-counts** and **misses** field-based truths (e.g. `appointmentBooked` without outcome string).

**Required analytics model:**

| Metric family | Model |
|---------------|--------|
| Material business outcomes (booked, requested, link sent, callback, message, transfer failed/completed, spam, etc.) | **Event counts** — for each call, increment one counter per badge in `deriveCallDetailMaterialOutcomes` (+ attention-only facts where appropriate) |
| Raw outcome table (optional advanced) | Show raw keys with warning — not primary KPI |
| Rates like “appointment conversion” | **DO NOT EXPOSE** unless denominator = eligible calls is persisted |

**Do not** use list-primary precedence as analytics truth.

---

## 7. Appointment Analytics

| State | Source of truth | Reliable historically? | V3 | Treatment |
|-------|-----------------|------------------------|-----|-----------|
| Appointment booked | `appointmentBooked` + outcome strings | partial | yes | Count via material derivation |
| Appointment requested | outcome `appointment_requested`, `request_only` | partial | yes | Event count |
| Booking link sent | outcome `booking_link_sent` | partial | yes | Event count |
| Rescheduled / cancelled | outcome/tool persistence | **unverified in aggregate** | partial | **Defer** until traced per-call |
| Rate appointments/total | derived | **misleading** | — | **Do not expose** |

---

## 8. Transfer Analytics

| Concept | Source | Meaning provable? |
|---------|--------|-------------------|
| Transfer attempted | `VoiceTransfer` row count | Yes — row created |
| Transfer completed | `status === completed` | SIP/workflow completed — **not** always human answered |
| Transfer succeeded (human) | `status === completed && answered === true` | **Yes** — use for “Transfers answered” KPI |
| Transfer failed | `failed`, `exhausted`, `answered === false`, or call outcome transfer_failed | Yes with overlap |
| Call `transferred` flag | `VoiceCall.transferred` | Attempted or connected — use with transfer table for detail |

**Customer language:** “Transfers completed” = completed transfer records; “Transfers answered” = completed **and** `answered` (narrower). Do not say “Human answered” unless `answered` is true.

---

## 9. Callback Analytics

Callbacks counted only via outcome string `CALLBACK` in `voiceProduct.callbacksRequested`. **No** aggregate for callback completed/pending in `loadVoiceAnalytics`. CallbackRequest rows may exist elsewhere — **not wired to analytics**.

**Treatment:** Show **Callbacks requested** count only. **Do not** show completion rate.

---

## 10. Voicemail Analytics

- **Detection:** `voicemailDetected` boolean on call.
- **Rate today:** `voicemailDetected count / totalCalls` (all directions).

**Recommended UI:** **Voicemail (inbound)** = inbound subset denominator. Document denominator in help text.

Voicemail recording/transcription: per-call on Calls detail — **not** aggregated in `loadVoiceAnalytics`.

---

## 11. Knowledge Analytics

| Data | Available? | Notes |
|------|------------|-------|
| Open gaps (workspace) | Yes | `openKnowledgeGaps` — **not period-filtered** |
| Gaps opened/asked in period | **No** in analytics API | Would need `VoiceKnowledgeGap.firstAskedAt` / `lastAskedAt` aggregation |
| RAG search success | **No** aggregate | Tool/exec not broken out |
| Calls with unanswered question | Per-call `hasKnowledgeGap` on Calls UI | Not aggregated |

**Treatment:** Link card: “N open knowledge gaps” → `/voice/knowledge#knowledge-gaps`. Optional future: “Calls with unanswered questions in period” after aggregation work.

---

## 12. Latency / Performance Analytics

| Metric | Start | End | Unit | Agg | Customer-facing? |
|--------|-------|-----|------|-----|------------------|
| Response latency (metadata) | Caller end of speech | First audible agent audio | ms | mean/median/p95 across samples | **Yes** (secondary section) if `responseLatencySampleSize > 0` |
| Tool latency | tool start | tool complete | ms | mean/p95 all tools | Advanced only |
| Tool success rate | — | — | ratio | all tools | **No** (misleading) |
| Session resolve / PSTN→LiveKit | not in `loadVoiceAnalytics` | — | — | — | **Do not expose** without new aggregation |
| Diagnostics | failure records | — | count | top codes | Advanced / operator |

**Implementation note:** `src/lib/voice/response-latency.ts` documents stages; analytics only reads persisted `metadata.responseLatency` on calls.

---

## 13. Tool / Operation Success

`VoiceToolExecution` has `toolId`, `status`, `latencyMs` but analytics aggregates **all tools together**. No booking vs transfer vs knowledge breakdown in `loadVoiceAnalytics`.

**Treatment:** Defer generic tool success. Future: filter executions by tool name/slug for “Booking operations succeeded” if stable tool IDs exist.

---

## 14. Cost / Usage Analytics

| Component | Source | Exact/est | Coverage |
|-----------|--------|-----------|----------|
| Call `costCents` | VoiceCall | persisted per call | May omit model/LiveKit portions |
| Usage `ai_minutes`, `telephony` | VoiceUsageRecord | billed quantities | Window on `createdAt` |
| Model / transcription | usage categories | billed/provider cents | Partial |
| Full stack | `billing-dashboard.ts` | combines analytics + usage | **Billing page** is canonical for invoices |

**Treatment:** Analytics **Usage** section: show **AI & telephony usage** labels from usage records; link **Usage & billing** (`/voice/billing`) for money truth. Do not label **Total cost** if only `costCents` sum on calls.

---

## 15. Sentiment / Caller Insights

Generated in post-call pipeline (`src/lib/voice/post-call.ts`) — LLM + heuristic; stored on `VoiceConversationInsight`. Analytics counts insights in period (not necessarily 1:1 with calls if insight missing).

**Treatment:** Secondary “Caller sentiment” row only if insight count ≥ threshold; never top KPI. Show table: positive / neutral / negative / unknown with **“Based on N analyzed calls”**.

---

## 16. Date Range & Timezone Semantics

| Topic | Current behavior |
|-------|------------------|
| Ranges | API: **7, 30, 90** only (`days` query); invalid → 30 |
| Custom / Today | **Not supported** on analytics API |
| Window | `since.setDate(since.getDate() - days)` from request time — **rolling**, not calendar month |
| byDay buckets | UTC from `startedAt.toISOString().slice(0,10)` |
| Calls list `today` | Server local midnight (`rangeStart` in calls API) — **inconsistent with analytics** |
| Workspace TZ | Canonical: `operatingMaturity.businessSchedule.timezone` (Business Knowledge) — **not used** by analytics |

**Document for implementation:** Adopt workspace timezone for day boundaries and byDay; align Calls `dateRange` vocabulary (`7d`/`30d`) with analytics. **Do not implement in this pass.**

---

## 17. Filter Inventory

See **Filter Matrix** (§39). Summary: backend supports agent, campaign, direction, outcome, phoneNumberId; UI supports **days only**. No after-hours, attention, or material-outcome filters.

---

## 18. Agent / Campaign Audit

**Agent:** Schema allows multiple `VoiceAgent` per workspace; V1 Voice IA assumes **one after-hours receptionist** experience. `byAgent` is meaningful for multi-agent/outbound workspaces only.

**Decision:** **Do not expose Agent filter** in V1 Analytics UI. Keep API param for future.

**Campaign:** `campaignId` ties to outbound `VoiceCampaign` / dialer (`call-service.processVoiceCampaignBatch`). Not inbound receptionist.

**Decision:** **DO NOT EXPOSE** campaign breakdown or filter on Voice Analytics.

---

## 19. Current Page Reconciliation

### `/voice/analytics` (`VoiceAnalyticsDashboard`)

| Element | Classification |
|---------|----------------|
| VoiceSubNav | **KEEP** |
| PageHeader + 7/30/90 select | **KEEP**; reword title/description; add URL `?days=` |
| KPI: Total, Inbound, Answer rate, Avg duration | **REWORD** answer rate definition or replace with Inbound volume + Avg duration; **REMOVE** misleading answer rate from top row or rename |
| voiceProduct outcome StatCards | **KEEP** structure; **REUSE** material outcome counts when API fixed |
| Open knowledge gaps link | **KEEP** |
| Raw outcome monospace table | **MOVE** to Advanced or replace with labeled outcome bars |
| byDay (unused) | **REUSE** — primary trend |
| Export | **ADVANCED** — wire only if CSV expanded + filters |

### `/voice/analytics/after-hours`

**REMOVE** as destination (redirect stays). After-hours = future **filter**, not section.

---

## 20. Existing Visual Primitive Inventory

| Primitive | Source | Used by | Analytics use |
|-----------|--------|---------|----------------|
| `PageHeader` | `src/components/ui/page-header.tsx` | Voice analytics, Calls | Title, description, range control |
| `StatCard` | `src/components/ui/card.tsx` | Voice analytics, overview | Compact KPIs (`text-2xl` — acceptable, not hero) |
| `Card` | same | tables | Outcome breakdown |
| `Table` | `src/components/ui/table.tsx` | Calls, MCTB | Optional outcome table |
| `MctbAnalyticsChart` | `src/components/mctb/analytics/mctb-analytics-chart.tsx` + CSS | MCTB analytics | **Primary trend** — bar chart, a11y `role="img"`, tooltip |
| Range button group | `mctb-analytics-view.tsx` | MCTB | Prefer segmented buttons over raw `<select>` for parity |
| Skeleton | `mctb-analytics-skel` classes | MCTB | Section loading |
| `formatNumber` | `src/lib/utils` | everywhere | KPI formatting |
| Appointments `BookingsChart` | `src/components/appointments/kimi-ui/overview/components/BookingsChart.tsx` | Appointments | Secondary reference only |
| Personal mock charts | `src/components/personal/mockup/charts.tsx` | Personal/billing | **Do not use** for Voice (mock naming) |

**Tokens:** `surface`, `rounded-xl`, `text-muted-foreground`, `font-display`, grid `gap-4`, Calls page `max-w-[1200px] px-4 sm:px-8`.

---

## 21. Page Archetype

**Analytical Workspace** — read-only aggregates, time range, drill-down links, no configuration.

---

## 22. Page Frame

**Evidence:** Calls operational pages use `mx-auto max-w-[1200px] px-4 py-6 sm:px-8`. MCTB Analytics uses full-width 12-column canvas with `mctb-analytics-inner` padding.

**Recommendation:** `max-w-[1200px] mx-auto px-4 py-6 sm:px-8` for Voice Analytics (align with Calls); inner chart spans full content width (~1152px). Section gap `mt-8` (32px). Chart height ~240px (match MCTB compact). KPI grid `gap-4`, `sm:grid-cols-2 lg:grid-cols-4` (max 4 per row).

---

## 23. Header Specification

- **H1:** Analytics  
- **Description:** Understand call volume, outcomes, and receptionist performance.  
- **Actions:** Date range segmented control — **Last 7 days | Last 30 days | Last 90 days** (maps to `days=7|30|90`). Persist `?days=` in URL (MCTB pattern).  
- **Export:** Optional text button if CSV expanded; today export ignores filters — **hide until fixed**.  
- **No** Compare, no fake After-hours toggle until backend exists.

---

## 24. Primary KPI Selection (verified only)

| # | Label | Definition | Source | Format | Trend | Drill-down |
|---|-------|------------|--------|--------|-------|------------|
| 1 | **Calls** | Non-test calls in period | `totalCalls` | integer | byDay mini optional | `/voice/calls?dateRange=30d` (align param in impl) |
| 2 | **Inbound calls** | Inbound subset | `inbound` | integer | — | `/voice/calls?dateRange=30d` + direction if added |
| 3 | **Appointments booked** | `appointmentBooked` true | count material | integer | byDay future | `/voice/calls?filter=booked&dateRange=` |
| 4 | **Transfers answered** | transfer completed & answered | recompute from transfers or voiceProduct + label fix | integer | — | Calls filter transferred (approximate) |
| 5 | **Callbacks requested** | material/outcome callback | `voiceProduct` / derived | integer | — | `/voice/calls?filter=messages` (imperfect) |
| 6 | **Avg. call duration** | mean duration | `avgDurationSeconds` | `Nm Ns` | — | — |

**Not selected for top row:** answerRate, humanAnswerRate, qualifiedRate, sentiment, tool success, cost (move to sections).

---

## 25. Primary Trend

**Chart:** Daily **call volume** (`byDay`) using `MctbAnalyticsChart` pattern.

- Series 1: total calls per UTC day (label footnote until TZ fix).
- Optional toggle later: overlay **appointments booked per day** (requires new daily aggregation).

**Do not** plot 9 series.

---

## 26. Outcome Breakdown

**Horizontal bar list** or compact table of **material outcome labels** (Calls badge strings), sorted by count.

Footnote: **“A single call can count toward more than one outcome.”**

No pie chart. Percentages shown as **share of outcome events**, not % of calls (sum may exceed 100%).

---

## 27. After-Hours Treatment

No backend filter. **Do not** add After-hours section. Document as **future**: filter using operating schedule + call timestamp in workspace TZ (implementation: API + Calls alignment).

---

## 28. Receptionist Performance

Secondary section **Receptionist performance**:

- Median response latency (if sample size shown)
- Transfers failed count
- Voicemail rate (inbound denominator)
- Optional: sentiment breakdown

Collapsible **Advanced**: tool latency, diagnostic counts, raw outcome keys.

---

## 29. Cost / Usage Treatment

Subsection or link row:

- AI minutes + telephony minutes (from API)
- Link: **View usage & billing** → `/voice/billing`

---

## 30. Caller Insights Treatment

Include only **sentiment** if `positive+neutral+negative+unknown >= 10` (configurable threshold). Otherwise omit section.

---

## 31. Drill-Down Rules

| From | Target | Supported today? |
|------|--------|------------------|
| Calls KPI | `/voice/calls?dateRange=7d\|30d` | **Partial** — map days→dateRange in impl |
| Appointments | `/voice/calls?filter=booked` | Yes |
| Transfers | `/voice/calls?filter=transferred` | Yes |
| Callbacks/messages | `/voice/calls?filter=messages` | Approximate |
| Knowledge gaps | `/voice/knowledge#knowledge-gaps` | Yes |
| Transfer failures | `/voice/calls?attention=open` | Needs-attention queue, not pure outcome |
| Appointments product | `/appointments` | Optional link |

**Do not invent** `?outcome=` on Calls — not in list API.

---

## 32. Empty / Loading / Error / Partial States

| State | Behavior |
|-------|----------|
| Loading | KPI + chart skeletons (MCTB pattern), preserve layout |
| Empty | “No calls in this period.” + suggest different range / confirm receptionist live |
| Error | Banner on page; retry |
| Partial | e.g. calls loaded, sentiment empty — hide sentiment section |
| Success | Quiet refresh on range change — no toast |

---

## 33. Responsive Contract

- Desktop: 4-column KPI grid, full-width chart  
- Tablet: 2-column KPI, chart scroll min-width 0  
- Mobile: 2→1 KPI, filters wrap, chart remains with bar scroll  
- 200% zoom: no horizontal page scroll (chart internal scroll OK)

---

## 34. Accessibility Contract

- Single H1; section H2s  
- `aria-label` on date range group  
- Chart: `aria-label` + numeric table alternative for daily totals  
- KPI text includes definition in `aria-describedby` or visible help  
- Keyboard: range buttons focusable; chart bars keyboard focus if links  
- Trends: not color-only  

---

## 35. Data Semantics Matrix

| Metric | Customer label | Source | Exact calculation | Population | Date basis | Confidence | UI treatment |
|--------|----------------|--------|-------------------|------------|------------|------------|----------------|
| totalCalls | Calls | VoiceCall | count rows | non-test, startedAt window | rolling days | High | Primary KPI |
| inbound | Inbound calls | VoiceCall.direction | INBOUND count | same | same | High | Primary KPI |
| appointmentsBooked | Appointments booked | appointmentBooked | sum true | same | same | High | Primary KPI |
| transfersAnswered | Transfers answered | VoiceTransfer | completed∧answered | transfer createdAt window | transfer date | Med | Primary KPI |
| callbacksRequested | Callbacks requested | outcomes/ material | callback outcome | calls | call startedAt | Med | Primary KPI |
| avgDurationSeconds | Avg. call duration | durationSeconds | mean | same | same | High | Primary KPI |
| byDay | Daily calls | startedAt UTC date | count/day | same | UTC | Med | Chart |
| humanAnswerRate | — | calls | see §3 | same | same | Med | **Do not expose** (label) |
| qualifiedRate | — | leadScore≥40 | ratio | same | same | Low | **Hide** |
| byCampaign | — | campaignId | — | — | — | — | **Hide** |
| toolSuccessRate | — | tool execs | completed/total | all tools | createdAt | Low | **Hide** |
| openKnowledgeGaps | Open knowledge gaps | gaps table | OPEN count | workspace | all-time | High | Link card |
| sentiment* | Caller sentiment | insights | bucket counts | insights | createdAt | Low | Secondary |

*(Full inventory in §3; duplicate rows trimmed for brevity — implementation must use §3 as authoritative list.)*

---

## 36. Outcome Matrix

| Outcome | Source of truth | Event or exclusive? | Can overlap? | Historical | V3 | Treatment |
|---------|-----------------|---------------------|--------------|------------|-----|-----------|
| Appointment booked | `appointmentBooked` + derivation | Event | Yes | partial | yes | Count |
| Appointment requested | outcome strings | Event | Yes | partial | yes | Count |
| Booking link sent | outcome | Event | Yes | partial | yes | Count |
| Callback requested | outcome / material | Event | Yes | partial | yes | Count |
| Message taken | outcome | Event | Yes | partial | yes | Count |
| Transfer completed | VoiceTransfer | Event | Yes | partial | yes | Count |
| Transfer failed | transfer + outcome | Event | Yes | partial | yes | Count |
| Voicemail | voicemailDetected | Event | Yes | partial | yes | Inbound rate |
| Lead captured | leadScore/isLead | Event | Yes | legacy | partial | Defer/hide |
| Urgent / Emergency | outcome | Event | Yes | partial | yes | Count |
| Spam / Solicitor | outcome | Event | Yes | partial | yes | Count |
| Knowledge gap | per-call gap flag | Event | Yes | partial | yes | Defer aggregate |
| Unresolved need | — | — | — | no | — | Defer |

---

## 37. Performance Matrix

| Metric | Start | End | Unit | Aggregation | Sample | Customer-facing? |
|--------|-------|-----|------|-------------|--------|------------------|
| Response latency | Caller end of speech | First agent audio | ms | mean/median/p95 | calls with metadata samples | Yes (secondary) |
| Tool latency | tool invoke | complete | ms | mean/p95 | tool executions | Advanced only |
| Transfer success | transfer request | completed+answered | boolean | rate on transfers | transfer rows | Yes (labeled) |

---

## 38. Cost Matrix

| Cost component | Source | Exact/est | Coverage | Providers | Customer label |
|----------------|--------|-----------|----------|-----------|----------------|
| Call costCents | VoiceCall | persisted | per-call partial | Telnyx/etc | Call usage (partial) |
| AI minutes | VoiceUsageRecord | billed | usage window | platform | AI minutes |
| Telephony minutes | VoiceUsageRecord | billed | usage window | Telnyx | Phone minutes |
| Model/transcription | VoiceUsageRecord | billed/provider | partial | OpenAI/etc | Model/transcription usage |
| Invoices | Stripe via billing API | exact | billing page | Stripe | **Usage & billing** |

---

## 39. Filter Matrix

| Filter | Backend supported? | Current UI? | Useful for Voice V1? | Permanent UI? |
|--------|------------------|-------------|----------------------|---------------|
| days 7/30/90 | Yes | Yes (select) | Yes | Yes (segmented) |
| Custom range | No | No | Yes later | No |
| Today | No | No | Yes later | No |
| agentId | Yes | No | Low | No |
| campaignId | Yes | No | **No** | **No** |
| direction | Yes | No | Maybe | Defer |
| outcome (raw) | Yes | No | Low | No |
| phoneNumberId | Yes | No | Maybe multi-line | Defer |
| after-hours | No | No | Yes later | No |
| material outcome | No | No | Yes later | Via Calls filters |

---

## 40. Component Reuse Matrix

| Region | Component | Source | Reuse unchanged? | Adapter | Visual change | Data risk |
|--------|-----------|--------|------------------|---------|---------------|-----------|
| Header | PageHeader | ui/page-header | Yes | copy | — | Low |
| KPIs | StatCard | ui/card | Yes | labels | — | Med until API fix |
| Trend | MctbAnalyticsChart | mctb/analytics | Mostly | voice CSS namespace | voice wrapper | Med UTC |
| Range | MCTB range buttons | mctb-analytics-view | Pattern | `days` param | match Voice tokens | Low |
| Outcomes | Card + table/bars | ui/card | Yes | material labels | — | High until derivation |
| Nav | VoiceSubNav | voice-subnav | Yes | — | — | Low |
| Billing link | Link | next/link | Yes | — | — | Low |

---

## 41. Exact Text Wireframe

```
[VoiceSubNav: Analytics | Usage & billing]

ANALYTICS                                    [ 7 days | 30 days | 90 days ]
Understand call volume, outcomes, and receptionist performance.

┌─────────┬─────────┬─────────┬─────────┐
│ Calls   │ Inbound │ Appts   │ Avg dur │  (StatCard grid, 4 cols desktop)
└─────────┴─────────┴─────────┴─────────┘
┌─────────┬─────────┬─────────┬─────────┐
│ Xfers   │Callback │ (opt)   │         │  (second row OR merge to 6 KPI max)
│ answered│requested│         │         │
└─────────┴─────────┴─────────┴─────────┘

CALL VOLUME OVER TIME
[MctbAnalyticsChart — daily bars, total calls]
Footnote: Daily buckets use workspace timezone (after impl); until then UTC.

CALL OUTCOMES
[Horizontal bars — material outcome labels, event counts]
Note: One call may appear in multiple outcomes.

[If openKnowledgeGaps > 0: Card link → Business Knowledge gaps]

RECEPTIONIST PERFORMANCE
[StatCard or small table: median response latency | inbound voicemail rate | transfers failed]
[Optional: sentiment breakdown if N≥10]

USAGE
AI minutes · Telephony minutes · [View usage & billing →]

▼ Advanced (collapsed)
Raw provider outcomes table · Tool latency · Diagnostic codes
```

Widths: container `max-w-[1200px]`; chart `width 100%` height ~240px; section `mt-8`.

---

## 42. Density Review

| Item | Count |
|------|------:|
| Top-level KPIs | 5–6 |
| Charts | 1 primary |
| Tables | 1 outcome (+ optional advanced) |
| Default page length | ~2–3 viewports |
| Advanced | 1 collapsed block |
| Mobile burden | Moderate — acceptable |

---

## 43. Visual Failure Checklist

Verified design **avoids**: giant hero, 12-KPI wall, rainbow charts, donut charts, fake trends, fake compare, unsupported export, campaign UI, raw outcome codes in primary UI, exclusive percentages for overlapping outcomes, provider jargon, mislabeled humanAnswerRate.

---

## 44. Implementation Risks

| Risk | Class |
|------|--------|
| `next.config` MCTB redirect | **UI-only** config fix |
| Outcome aggregates ≠ Calls derivation | **API aggregation fix** |
| UTC byDay / rolling window | **Data semantics fix** + TZ |
| openKnowledgeGaps not period-scoped | **Data semantics** or label |
| Transfer metrics use transfer `createdAt` | **Data semantics fix** |
| humanAnswerRate / answerRate labels | **UI-only** or hide |
| findMany all calls memory | **Query performance** at scale |
| Partial latency metadata | **Historical limitation** |
| Sentiment coverage gaps | **Do not expose** until threshold |
| Export omit filters/metrics | **API** before exposing button |

---

## 45. Exact Implementation Boundary

### In scope (implementation pass)

- Remove `/voice/analytics` → MCTB redirect in `next.config.ts`
- Replace/extend `VoiceAnalyticsDashboard` per wireframe
- Extend `loadVoiceAnalytics` **or** add `loadVoiceAnalyticsV2` for material outcomes + inbound voicemail + daily series (preferred: extend same module)
- URL state `?days=`
- Reuse `MctbAnalyticsChart` (shared or voice-scoped CSS)
- Optional: expand `analyticsToCsv` if export shipped

### Out of scope

- Voice V3 runtime, compiler, Telnyx webhooks, LiveKit worker
- Prisma schema migrations
- Overview page
- Calls / Receptionist / BK / CH pages
- After-hours filter until schedule-aware query exists
- Campaign/agent filters

### Protected files (should not need edits for UI-only path)

- `src/lib/voice-v3/**` runtime
- `src/lib/agents/**`
- `voice-runtime/**`
- MCTB analytics (`src/lib/mctb/analytics.ts`)

---

## Related surfaces (audit notes)

| Surface | Role |
|---------|------|
| `/voice/reports` | Legacy multi-product report; uses same API |
| `/voice/billing` | Canonical monetary detail |
| `/voice/overview` | Duplicate KPIs — future summary only |
| `/mctb/analytics` | **Different product** — do not merge |

---

VOICE ANALYTICS PAGE SPEC COMPLETE — READY FOR IMPLEMENTATION REVIEW
