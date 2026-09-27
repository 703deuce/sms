# MCTB critical-path performance pass (no merge)

Measured on workspace `ws_1` via `npx tsx scripts/mctb-critical-path-timings.ts` (server loaders, DB). No browser paint timings.

## Timings summary

| Step | Before (ms) | After (ms) | Notes |
|------|------------:|-----------:|-------|
| `loadMctbOverview` (blocking RSC `/mctb`) | 8589 | **392** (`loadMctbOverviewCore`) | Tier 2 moved to client `/api/mctb/overview-enrichment` (~9174 ms, non-blocking) |
| `GET /api/mctb/setup` parallel bundle | 314 | 394 | Deduped `loadPhoneNumbers` inside compliance |
| `shell-context` | 100 | 95 | Unchanged |
| Conversations list (server) | 358 | 377 | Unchanged |
| 5× sequential full-thread hydrate (old client gate) | 1266 | N/A | **Removed from list gate**; 1 thread on select (~250 ms each) |

---

## 1. BEFORE — old critical paths

### `/mctb` Overview
`auth → loadMctbOverview (batch + lead recovery + AI booking + inbound) → HTML`

Primary unnecessary gates: `loadLeadRecoveryConfig`, `computeLeadRecoveryPolicyHealth`, `evaluateMctbAiBookingReadiness`, inbound config/decision.

### `/mctb/conversations`
`shell-context ∥ (setup GET + inbox list + up to 40× fetchConversation) → show inbox`

Primary unnecessary gates: full setup; N+1 thread hydration before list.

### `/mctb/missed-calls/[id]`
`missed-call API + full setup GET → show detail`

Primary unnecessary gate: entire setup for sender label.

### `/mctb/setup`
`setup + onboarding → show → background full /api/mctb/overview`

Primary unnecessary gate: full overview loader for forwarding label already on onboarding.

---

## 2. AFTER — new critical paths

### `/mctb`
`auth → loadMctbOverviewCore → dashboard visible`  
After visible: `GET /api/mctb/overview-enrichment` (AI Recovery card, healthy banner when enrichment ready).

### `/mctb/conversations`
`shell-context ∥ inbox list → show list`  
After visible: hydrate **selected** thread only (`onSelectionChange` / initial deep link).

### `/mctb/missed-calls/[id]`
`missed-call API (+ shell sender when available) → show detail`  
No setup GET.

### `/mctb/setup`
`setup + onboarding → show`  
Background: exclusions, handoff, live-test, voicemail — **no** `/api/mctb/overview`.

---

## 3. REMOVED FROM CRITICAL PATH

| Function / request | Was blocking |
|--------------------|--------------|
| `loadLeadRecoveryConfig` | `/mctb` RSC |
| `computeLeadRecoveryPolicyHealth` | `/mctb` RSC |
| `evaluateMctbAiBookingReadiness` | `/mctb` RSC |
| `loadMctbLineInboundConfig` / `resolveInboundHandlingDecision` | `/mctb` RSC |
| `GET /api/mctb/setup` | Conversations, missed-call detail |
| Up to 40× `fetchConversation` before list | Conversations |
| `GET /api/mctb/overview` | Setup home background |

---

## 4. ELIMINATED / REDUCED REQUESTS

- Conversations: **no** setup GET; **no** bulk thread prefetch.
- Missed-call detail: **no** setup GET.
- Setup home: **no** overview GET.
- Setup GET + overview core batch: **one** `loadPhoneNumbers` per request (compliance reuses cached numbers).

---

## 5. CONVERSATIONS

**Before:** 1 list + up to 40 full-thread fetches before removing loading (5 threads ≈ 1266 ms sequential in sample workspace).

**After:** 1 list → usable list; 1 thread fetch when row selected or deep-linked (≈ 250 ms per thread in sample).

---

## 6. OVERVIEW

Previously blocked on lead recovery + AI booking + inbound (~8+ s on `ws_1`). Now resolves after dashboard paint via `/api/mctb/overview-enrichment`. KPIs, recent missed calls, recent conversations, setup health remain on Tier 1.

---

## 7. SETUP

Forwarding verified state comes from onboarding response only. Overview loader removed from setup initialization.

---

## 8. SMALLEST CHANGE MAP (proposals not yet done — editors)

| Editor | Tier 1 (suggested) | Still uses full setup GET |
|--------|-------------------|---------------------------|
| Phone / consent / text-back / recovery | Domain fields for that section | Yes — legitimate editors |
| Notifications | Handoff API only | Could narrow in a follow-up |

---

## 9. FUNCTIONAL PARITY

- AI Recovery card and “nothing needs attention” banner wait for enrichment (brief “Loading…” policy summary until ready).
- Inbox thread messages load when conversation selected (empty thread pane until hydrated).
- Sender on missed-call detail uses shell-context sender label when loaded.

---

## 10. REGRESSION GATE

```
MCTB_STAGE2_LEGACY_PRESENTATION_IMPORTS: 0
MCTB_STAGE2_LEGACY_COMPONENTS_RENDERED: 0
MCTB_STAGE2_LEGACY_CSS_LOADED: 0
MCTB_CUSTOMER_VISIBLE_DEMO_STATE: 0
MCTB_STAGE2_FRONTEND: PURE_OPUS
```

---

## Files touched

- `src/lib/mctb/overview.ts` — core vs enrichment split
- `src/app/api/mctb/overview-enrichment/route.ts`
- `src/app/(app)/mctb/page.tsx`
- `src/newui-transplant/connected/mctb/overview-page.tsx`, `overview-enrichment.tsx`
- `src/newui-transplant/connected/mctb/conversations-page.tsx`
- `src/newui-transplant/components/mctb/inbox.tsx`
- `src/newui-transplant/connected/mctb/missed-call-detail-page.tsx`
- `src/newui-transplant/connected/mctb/mctb-setup-overview-wiring.ts`
- `src/lib/newui-transplant/adapters/mctb-conversations.ts`
- `src/lib/workspace-data.ts`, `src/app/api/mctb/setup/route.ts`
- `scripts/mctb-critical-path-timings.ts`

**Not merged or deployed per instruction.**

## Enrichment follow-up (non-blocking, `ws_1` sample)

`loadMctbOverviewEnrichment` ~9174 ms total. Existing script sub-steps on the same workspace (not re-run for this verification):

| Sub-step | ~ms | Note |
|----------|-----|------|
| `loadLeadRecoveryConfig` | 4878 | Largest single call |
| `computeLeadRecoveryPolicyHealth` | 9891 | Includes second config load in script’s isolated timing |
| `evaluateMctbAiBookingReadiness` | 3925 | Microsoft/Calendly audit + connection heal |
| Inbound config + decision | ~560 | Minor |

**Observation:** Lead-recovery policy health + AI booking readiness dominate; consider persisted/event-driven status later—not launch-blocking.

## Verification pass (approved stage)

- Overview split: core SSR + client enrichment; enrichment failure is caught and does not blank dashboard.
- Conversations: list-first; thread-pane shows “Loading messages…” during hydrate; hydration token ignores superseded fetches.
- Missed-call detail: detail fetch independent of shell-context; sender patched when shell arrives (`—` fallback).
