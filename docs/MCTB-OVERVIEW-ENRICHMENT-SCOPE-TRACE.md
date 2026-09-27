# MCTB Overview enrichment — scope trace (read-only)

**Purpose:** Explain why `/api/mctb/overview-enrichment` spends ~9s on Microsoft/Calendly/direct-booking readiness when **current V1 MCTB appointment behavior is Send Booking Link**, not direct calendar booking.

**Rules for this document:** Trace only — no product changes, no optimization, no deletion. Measured on workspace `ws_1` via server-side timing (no browser).

---

## Answer to the core question

**Why is MCTB spending ~9 seconds on Microsoft/Calendly/direct-booking readiness for a Send Booking Link product?**

Because **overview enrichment still runs the Lead Recovery + AI Booking-over-SMS stack**, including **`evaluateMctbAiBookingReadiness()`** (Microsoft/Calendly audit, connection heal, booking context). That path is for **`AI_BOOK` / direct calendar booking**, not for **`SEND_BOOKING_LINK`**.

It is wired into the dashboard to drive the **AI Recovery card** (`status`, `policySummary`, and **“Calendar provider disconnected”** → `/integrations?provider=microsoft`). That is **legacy / narrowed-scope leakage**, not a V1 Send-Link requirement.

**Compounding issue:** `loadLeadRecoveryConfig()` **always** calls `computeLeadRecoveryPolicyHealth()` before returning (`src/lib/mctb/lead-recovery/config.ts` ~240). `loadMctbOverviewEnrichment()` then calls **`computeLeadRecoveryPolicyHealth` again** and **`evaluateMctbAiBookingReadiness` again** in parallel — so the same expensive work runs **multiple times per enrichment request**.

---

## Send Booking Link path (actual runtime)

```
Lead Recovery policy → SEND_BOOKING_LINK action
  → resolveBookingUrl()
      → mctbBookingLink row (bookingLinkId), OR
      → resolveFallbackBookingUrl() from ai-booking config (URL only)
  → SMS: "Book here: {url}"
```

**Does not call:** `evaluateMctbAiBookingReadiness`, Microsoft OAuth audit, Calendly availability, `findAvailableTimes`, or `createBooking`.

(`resolveBookingUrl` may read `loadMctbAiBookingConfig` only for **fallback URL**, not calendar readiness.)

**`AI_BOOK` path (different product):** `action-runtime` → `delegateAiBooking` → `lib/mctb/ai-booking/*` (orchestrator, slots, Microsoft/Calendly adapters). That **is** direct booking; it is **not** the V1 Send-Link flow described for launch.

**Source:** `src/lib/mctb/lead-recovery/action-runtime.ts` — `SEND_BOOKING_LINK` case and `resolveBookingUrl()`.

---

## Function-by-function trace

### `loadLeadRecoveryConfig`

| Question | Answer |
|----------|--------|
| 1. What exact CURRENT customer-visible MCTB feature consumes this result? | AI Recovery configuration (enabled, scenarios, policies, booking link id) |
| 2. What exact UI field/card consumes it? | `/mctb/ai-recovery`, enrichment-driven Overview AI Recovery card; APIs `/api/mctb/lead-recovery/config` |
| 3. What runtime path consumes it? | Lead recovery conversation runtime, policy engine, action runtime |
| 4. Is that runtime path currently reachable in the V1 MCTB product? | **Yes** (AI Recovery is in scope) |
| 5. Direct calendar booking or Send Booking Link? | Sets `bookingMode`: `AI_BOOK` if `aiBooking.enabled`, else `SEND_BOOKING_LINK` if fallback link id, else `COLLECT_ONLY` |
| 6. If direct booking — where exposed? | **`AI_BOOK` remains in code** if workspace has `aiBooking.enabled` in stored config |
| 7. If not exposed — why connected to Overview? | Enrichment calls it for card copy + health; **also embeds full policy health on every load** |
| 8. Does AI Recovery require this for message generation? | **No** for every inbound SMS — config/instructions/link load at conversation time |
| 9. Or load instructions/context/link on actual interaction? | **Yes** — policies/actions applied in lead-recovery runtime when a recovery interaction runs |
| 10. Does policy health treat Microsoft/Calendly as required for healthy AI Recovery? | **Indirectly** — via embedded `computeLeadRecoveryPolicyHealth` when policies use `AI_BOOK` |

**Note:** On return, this function **always** runs `computeLeadRecoveryPolicyHealth(workspaceId, baseConfig)` before returning the config object.

---

### `computeLeadRecoveryPolicyHealth`

| Question | Answer |
|----------|--------|
| 1. Customer-visible feature | AI Recovery “healthy / needs attention / provider blocked” |
| 2. UI consumer | Overview enrichment (`leadRecovery.status`, `attentionReason`); `/mctb/ai-recovery` settings API; simulation |
| 3. Runtime consumer | **Not** on each SMS send for link-only mode; used at **config load** and APIs |
| 4. V1 reachable | Yes |
| 5–6. Booking type | **`AI_BOOK` on `BOOKING_REQUEST`** → calls `evaluateMctbAiBookingReadiness` + entitlement. **`SEND_BOOKING_LINK`** → only active `mctbBookingLink` / `bookingLinkId` count |
| 7. Why on Overview | Enrichment + duplicated inside `loadLeadRecoveryConfig` |
| 8–9. Required to generate/reply? | Not required to **generate** a reply; only if dashboard health is defined as Microsoft-ready |
| 10. Microsoft/Calendly required for healthy setup? | **Yes when policy actions include `AI_BOOK`** — **No when only `SEND_BOOKING_LINK` and link configured** |

Also pulls **Stripe Text-to-Pay** capabilities if payment policies use text-to-pay (adjacent/deferred surface).

**Source:** `src/lib/mctb/lead-recovery/policy-health.ts`

---

### `evaluateMctbAiBookingReadiness` (nested operations)

| Step | What it does | Booking type |
|------|----------------|---------------|
| `ensureMctbMicrosoftConnectionPointer` | Heal/point Microsoft calendar connection | **Direct AI booking** |
| `loadMctbAiBookingConfig` | Read `aiBooking` workspace config | Both (link fallback URL vs `enabled` flag) |
| `resolveFallbackBookingUrl` | URL for link fallback | **Send link** |
| `auditMctbAiBookingProvider` | Calendly scopes/plan or **Microsoft calendar capabilities** | **Direct booking** |
| `getBookingContext` | Adapter `getBookingContext` + **audit again** | **Direct booking** |
| Scheduling target checks | event type / calendar id / service name | **Direct booking** |

| Question | Answer |
|----------|--------|
| 1. Customer-visible feature | **MCTB AI Booking over SMS** (`/api/mctb/ai-booking/*`), lead recovery when action is `AI_BOOK`; also Voice ai-booking helpers |
| 2. UI consumer (MCTB) | Overview enrichment attention text; `/api/mctb/ai-booking/config`, `/api/mctb/lead-recovery/config` — not Opus Stage 2 primary launch surfaces |
| 3. Runtime consumer | `AI_BOOK` delegate, `mctb/ai-booking/conversation-runtime`, orchestrator find/book |
| 4. V1 MCTB launch path | **Reachable in code** if `aiBooking.enabled` / `AI_BOOK` policies; **not** the described V1 customer journey (Send Link only) |
| 5–6. Direct booking vs link | **Direct calendar booking** — not Send Link |
| 7. Why on Overview | Enrichment uses `aiReadiness.providerConnected` for **“Calendar provider disconnected”** banner branch |
| 8–9. Required for AI Recovery messages? | **Not** for Send-Link SMS; **is** required before `AI_BOOK` automation runs |
| 10. Policy health Microsoft requirement? | **Yes when `AI_BOOK` is on booking policy** |

**Source:** `src/lib/mctb/ai-booking/readiness.ts`, `capabilities.ts`, `service.ts`, `microsoft-connection.ts`

---

### `loadMctbLineInboundConfig`

| Question | Answer |
|----------|--------|
| 1. Feature | Inbound mode on MCTB line (MCTB recovery vs Voice Agent), forwarding verified, ingress E.164 |
| 2. UI consumer (Stage 2 Opus Overview) | **None** — `callHandling` returned by enrichment but **not rendered** on `NewUiMctbOverviewPage`. Legacy `mctb-home-sections.tsx` shows “Call recovery” row |
| 3. Runtime consumer | Inbound handling API, SIP ingress sync reads mode from phone settings |
| 4. V1 | **Yes** for call routing (separate from SMS booking) |
| 5–9. Booking | N/A |
| Overview vs runtime | **A: call settings runtime — yes. B: Overview recompute — not needed for Opus Overview UI** |

**Source:** `src/lib/mctb/inbound-handling/line-config.ts`

---

### `resolveInboundHandlingDecision`

| Question | Answer |
|----------|--------|
| 1. Feature | Choose **mctb_recovery vs voice_agent** for forwarded call |
| 2. UI consumer | `/api/mctb/inbound-handling`; **not** Opus Overview |
| 3. Runtime consumer | Inbound-handling API; mode also used in `sip-ingress/sync` — **not** invoked from Overview UI |
| 4. V1 | Legitimate **call** runtime concern |
| Overview? | Enrichment calls it but **result unused on Stage 2 Overview** — **runtime decision ≠ dashboard requirement** |

**Source:** `src/lib/mctb/inbound-handling/router.ts`, `src/app/api/mctb/inbound-handling/route.ts`

---

## Operation summary table

| Operation | Current MCTB V1 feature using it | UI consumer | Runtime consumer | Needed on Overview? | Needed at runtime? | Current-scope / legacy-scope / unknown |
|-----------|----------------------------------|-------------|------------------|---------------------|--------------------|----------------------------------------|
| `loadLeadRecoveryConfig` | AI Recovery config | Overview card (enrichment), AI Recovery pages | Lead recovery SMS runtime | **Partial** (enabled + summary only) | **Yes** (on interaction / editor) | **Current + legacy embed** (always runs policy health) |
| `computeLeadRecoveryPolicyHealth` | AI Recovery health | Overview attention, AI Recovery APIs | Config save/load, simulation | **Debatable** (simple checks suffice for link mode) | **On `AI_BOOK`, not pure Send Link** | **Legacy when `AI_BOOK`** |
| `evaluateMctbAiBookingReadiness` | AI Booking over SMS | Overview Microsoft message; ai-booking APIs | `AI_BOOK` conversation path | **No for V1 Send-Link launch** | **Only if `AI_BOOK` enabled** | **Legacy / adjacent** |
| `loadMctbLineInboundConfig` | Inbound line settings | Legacy home only (not Opus Overview) | Inbound API / SIP settings | **No (Opus)** | **Yes (calls)** | **Current** |
| `resolveInboundHandlingDecision` | Call routing policy | Inbound-handling API only | Call routing (API / settings) | **No** | **Yes (ingress policy)** | **Current runtime; legacy on Overview** |

---

## Measured enrichment timing (`ws_1`, server-only)

**`loadMctbOverviewEnrichment` total: ~8880–11225 ms** (run-to-run variance)

| Operation | ms |
|-----------|---:|
| `loadLeadRecoveryConfig` | **~4572** (includes internal `computeLeadRecoveryPolicyHealth`) |
| `computeLeadRecoveryPolicyHealth` (2nd call in enrichment) | **~4008** |
| `evaluateMctbAiBookingReadiness` (3rd call in enrichment) | **~3933** |
| **Nested inside `evaluateMctbAiBookingReadiness`** (standalone sample, provider `microsoft`): | |
| → `ensureMctbMicrosoftConnectionPointer` | ~938 |
| → `auditMctbAiBookingProvider` | ~928 |
| → `getBookingContext` | ~1609 |
| `loadMctbLineInboundConfig` | ~258 |
| `resolveInboundHandlingDecision` | ~460 |

**~8+ seconds** sit in **lead recovery config + policy health + AI booking readiness**, with **duplicate calls**. Inbound is **under ~1 s** combined.

**Related context (already fixed for blocking TTFB):** `loadMctbOverviewCore` ~392 ms — Tier-1 dashboard no longer waits on enrichment.

---

## Enrichment call graph (current code)

```
GET /api/mctb/overview-enrichment
  → loadMctbOverviewEnrichment()
      → loadLeadRecoveryConfig()
            → loadMctbAiBookingConfig()
            → build config from workspace customFields
            → computeLeadRecoveryPolicyHealth()  ← 1st time
                  → evaluateMctbAiBookingReadiness()  ← inside policy health
                  → Stripe caps, link counts, etc.
      → Promise.all([
            computeLeadRecoveryPolicyHealth()  ← 2nd time
            evaluateMctbAiBookingReadiness()   ← 3rd time
         ])
      → loadMctbLineInboundConfig()
      → resolveInboundHandlingDecision()  ← return value not used on Opus Overview UI
```

---

## UI consumers (Stage 2 Opus vs legacy)

| Payload field | Opus `/mctb` (`NewUiMctbOverviewPage`) | Legacy (`mctb-home-sections`) |
|---------------|----------------------------------------|-------------------------------|
| `leadRecovery.enabled` | AI Recovery card pill On/Off | — |
| `leadRecovery.policySummary` | Card subtitle | — |
| `leadRecovery.status` | “Nothing needs attention” banner gate | — |
| `leadRecovery.attentionReason` | Can cite Microsoft disconnect → `/integrations?provider=microsoft` | — |
| `callHandling.*` | **Not rendered** | “Call recovery” setup health row |

---

## Product rules verified against implementation

| Rule | Implementation finding |
|------|-------------------------|
| MCTB is NOT doing direct Microsoft/Calendly appointment booking for V1 launch flow | **Send link path does not use calendar readiness** |
| Appointment-related V1 behavior is Send Booking Link | **`SEND_BOOKING_LINK` action + `resolveBookingUrl`** |
| Do not assume AI Booking-over-SMS is required because code exists | **`AI_BOOK`, `evaluateMctbAiBookingReadiness`, `/api/mctb/ai-booking/*` still present** |
| AI Recovery loads config on interaction | **Conversation runtime uses policies; dashboard health is separate** |
| Runtime inbound decision ≠ dashboard requirement | **`resolveInboundHandlingDecision` in enrichment with no Opus UI consumer** |

---

## Conclusion (trace only — no recommended code changes in this doc)

1. **MCTB Overview enrichment is not justified at current depth for V1 Send-Link** — especially **`evaluateMctbAiBookingReadiness`** (Microsoft/Calendly direct booking machinery).
2. **Policy health** can be legitimate for “missing link / missing configuration” but **today also treats `AI_BOOK` + Microsoft as required**, which is **stale for narrowed launch**.
3. **`callHandling` + inbound decision** in enrichment are **not consumed by Stage 2 Opus Overview**.
4. The right direction when changing scope is **remove obsolete booking machinery from the MCTB dashboard path**, not “make 9 seconds faster,” while leaving Send Link and call runtime paths that still need them.

---

## Key source files

| Area | Path |
|------|------|
| Enrichment entry | `src/lib/mctb/overview.ts` — `loadMctbOverviewEnrichment` |
| Enrichment API | `src/app/api/mctb/overview-enrichment/route.ts` |
| Lead recovery config + embedded health | `src/lib/mctb/lead-recovery/config.ts` |
| Policy health | `src/lib/mctb/lead-recovery/policy-health.ts` |
| AI booking readiness | `src/lib/mctb/ai-booking/readiness.ts` |
| Send booking link runtime | `src/lib/mctb/lead-recovery/action-runtime.ts` |
| Inbound line + router | `src/lib/mctb/inbound-handling/line-config.ts`, `router.ts` |
| Opus Overview UI | `src/newui-transplant/connected/mctb/overview-page.tsx` |
| Performance pass (blocking fix) | `docs/MCTB-CRITICAL-PATH-PERFORMANCE-PASS.md` |

---

*Document generated from read-only trace. No product behavior changed for this file.*
