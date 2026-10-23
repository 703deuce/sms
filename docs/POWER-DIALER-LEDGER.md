# Power Dialer — completion ledger

Statuses: **Not started** | **In progress** | **Implemented** | **Tested** | **Deployed** | **Browser verified** | **Blocked**

Last updated: Phase 2 (core engine — backend enforcement + dialer UI). Rows stay **In progress** until Grok browser-verifies after deploy.

## Phase 2 engine notes (implementation)

| Topic | Choice / status |
|-------|-----------------|
| Authoritative eligibility | `evaluateContactEligibility` in `new-app/lib/server/phone/power-dialer/eligibility.ts` — used by `createAttemptForSession` and `buildEligibilityBreakdown` (manual + auto progression). |
| Campaign rules | Persisted columns on `PowerDialerCampaign` + Zod `parseCampaignConfigPatch` / `resolveCampaignRules`. Migration `20261023130000_power_dialer_engine_phase2`. |
| Auto progression | Power mode: `progressionPhase` + `nextCallAt` + client `autoDialReady`; preview = manual Call. Pause/End stop progression; `endSessionHard` cancels live attempts. |
| Session recovery | `GET /api/phone/power-dialer/sessions/:id` returns runtime (progression, counts, current attempt, countdown). Idempotency: `idempotencyKey` unique + `(sessionId, sequenceNumber)` unique. |
| Ring timeout | **WebRTC outbound** — no Telnyx `timeout_secs` on browser leg. Server sets `ringTimeoutAt` on attempt; `sweepPowerDialerTimeouts` on session GET; client hangs up via `ringTimeoutHangup` + `endCall()`. **Not live-call verified.** |
| Disposition gate | `createAttemptForSession` throws if prior attempt ended without disposition when `requireDispositionBeforeNext`. |
| Hangup idempotency | `onPowerDialerCallEnded` skips duplicate progression when attempt already in terminal status; billable seconds backfilled on retry. |
| Telnyx webhook dedup | `TelnyxWebhookDedup` on `/api/telnyx/phone` (pre-existing). |
| Human conversation KPIs | `isHumanConversation(disposition, answerClassification)` — voicemail/uncertain non-human not counted as human conversations. |

## Telnyx detection research (AMD / screening — not built)

| Capability | Telnyx surface | Events / timing | Cost / notes |
|------------|----------------|-----------------|--------------|
| Answering Machine Detection (AMD) | Call Control `dial` / `transfer` with `answering_machine_detection` (`detect`, `detect_beep`, `detect_words`, `greeting_end`, etc.) | `call.machine.detection.ended` with `result`: `human`, `machine`, `not_sure`, `fax`, etc.; optional `call.machine.premium.detection.ended` on premium tiers | Per-minute / per-detection billing per Telnyx voice pricing; adds post-answer analysis latency (often 1–3s+). WebRTC browser outbound today does not pass AMD flags on origination. |
| Premium / iOS screening hints | Telnyx “premium” AMD / screening-oriented detection (marketing: better mobile screening & voicemail discrimination) | Same machine-detection event family; `not_sure` / `machine` more common on screened calls | Higher per-call cost vs standard AMD; needs explicit product enablement on connection/app. |
| Recommended Phase 3+ | Bridge power-dialer PSTN leg to Call Control with AMD enabled **or** fork WebRTC to record classification from rep disposition only | Until then: `answerClassification` stays `uncertain` on connect; rep disposition drives metrics | Screening-specific auto workflows (leave VM, skip) **not implemented** in Phase 2. |

## Teardown reconciliation (formerly “unverified”)

| Item | Finding in repo (Phase 2) |
|------|---------------------------|
| Ring timeout | **Implemented (server + client)** — not PSTN `timeout_secs`; not live-verified. |
| Require disposition before next dial | **Backend enforced** when campaign `requireDispositionBeforeNext` true. |
| Do not call → BLOCKED | **Implemented** — disposition effects idempotent via `dispositionEffectsAt`. |
| Webhooks / public API | **Not started** — no power-dialer webhook routes or PAT APIs in `new-app`. |
| Campaign contacts reason codes | **Partial** — session breakdown counts; no per-contact campaign subpage API yet. |
| Session summary metrics | **Partial** — basic session log panel; not full spec rollup UI. |

## Main nav & shell

| Requirement | Reused | Backend | Frontend | Tests | Deploy | Browser | Acceptance |
|-------------|--------|---------|----------|-------|--------|---------|------------|
| Power Dialer in main product nav | `lib/nav.ts`, `app-header` PRODUCTS | N/A | Implemented | VM engine | Pending | Pending | In progress |
| Remove from Phone contextual nav | Phone `nav.ts` items | N/A | Implemented | — | Pending | Pending | In progress |
| Redirect `/app/phone/power-dialer` | Next redirect page | N/A | Implemented | — | Pending | Pending | In progress |
| 10 sidebar routes under `/app/power-dialer` | MCTB/Phone pattern | Mixed | Implemented | — | Pending | Pending | In progress |
| Workspace product settings | `workspace_limits.limits.powerDialer` | Implemented API | Settings tabs (General/Dialing) | — | Pending | Pending | In progress |

## P1 Overview

| Requirement | Reused | Backend | Frontend | Tests | Deploy | Browser | Acceptance |
|-------------|--------|---------|----------|-------|--------|---------|------------|
| KPI strip (today) | `getPowerDialerOverview` | Implemented | Overview page | VM engine | Pending | Pending | In progress |
| Setup checklist | Lists/campaigns counts | Implemented | Overview panel | — | Pending | Pending | In progress |
| Campaign performance strip | `listCampaigns` data | Implemented | Overview list | — | Pending | Pending | In progress |
| Recent activity | `PowerDialerAttempt` | Implemented | Overview list | — | Pending | Pending | In progress |
| Attention required (full) | `attentionRequired` API | Implemented | Overview banners (lists/campaigns/eligible) | — | Pending | Pending | In progress |
| Start dialing CTA | Dialer route | N/A | Implemented | — | Pending | Pending | In progress |

## P2 Dialer

| Requirement | Reused | Backend | Frontend | Tests | Deploy | Browser | Acceptance |
|-------------|--------|---------|----------|-------|--------|---------|------------|
| Session setup (campaign, list, caller ID) | `power-dialer-session.tsx` | Sessions API | `/dialer` | — | Pending | Pending | In progress |
| Manual dial + dispositions | WebRTC `power_dialer` source | Implemented | Preview mode Call + disposition | — | Pending | Pending | In progress |
| Auto sequential dialing | `session-runtime` progression | Implemented | Power mode auto-dial + countdown | VM engine | Pending | Pending | In progress |
| Session persistence / refresh | DB sessions + GET runtime | Implemented | Poll + idempotent create_attempt | — | Pending | Pending | In progress |
| Session summary | — | Partial | Basic end panel | — | Pending | Pending | In progress |
| Voicemail drop / screening / transfer | Phone stack | Deferred | Not in dialer UI | — | — | — | Not started |

## P3 Campaigns

| Requirement | Reused | Backend | Frontend | Tests | Deploy | Browser | Acceptance |
|-------------|--------|---------|----------|-------|--------|---------|------------|
| Campaign list + create | `PowerDialerCampaign` | Implemented | `/campaigns` tab | — | Pending | Pending | In progress |
| Full create/edit wizard sections | Rule columns + `configJson` | Partial | Minimal form | — | — | — | In progress |
| Campaign contacts subpage | — | Not started | Not started | — | — | — | Not started |
| Backend rule enforcement | `eligibility.ts` + caps | Implemented | — | VM engine | Pending | Pending | In progress |

## P4–P10

Unchanged from Phase 1 scope — still **In progress** or **Not started** per row in prior inventory; no Phase 2 scope expansion except engine dependencies above.

## Status summary (Phase 2)

| Status | Count (approx.) |
|--------|-----------------|
| Not started | 16 |
| In progress | 34+ |
| Tested (VM only) | `pnpm run test:power-dialer-engine` |
| Deployed / Browser verified | 0 (awaiting Grok) |

_Update counts when moving rows to Deployed/Browser verified._
