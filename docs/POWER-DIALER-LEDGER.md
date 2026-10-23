# Power Dialer — completion ledger

Statuses: **Not started** | **In progress** | **Implemented** | **Tested** | **Deployed** | **Browser verified** | **Blocked**

Last updated: Phase 1 (product structure & foundations).

## Teardown reconciliation (formerly “unverified”)

| Item | Finding in repo (Phase 1 audit) |
|------|----------------------------------|
| Ring timeout | **Not enforced** for power dialer outbound; `configJson` has no runtime ring hangup; Phone inbound has `ringTimeoutAt` only. Settings store `defaultRingTimeoutSec` (not applied to dial yet). |
| Require disposition before next dial | **Partial** — UI blocks “Save & next” without disposition; user can dial again without saving; no backend gate; `requireDispositionBeforeNext` in workspace settings only. |
| Do not call → BLOCKED | **Implemented (Phase 1)** — `saveAttemptOutcome` sets `contact.status = BLOCKED` when disposition matches DNC. Eligibility already skips BLOCKED/UNSUBSCRIBED. |
| Webhooks / public API | **Not started** — no power-dialer webhook routes or PAT APIs in `new-app`. |
| Inbound routing for outbound caller IDs | **Partial** — numbers use shared Phone/Telnyx infra; no dialer-specific callback routing map. |
| AI transcripts on dialer calls | **Partial** — `HumanCall` supports `transcriptText` / recording via shared phone pipeline when recording runs; no dialer-specific transcript UI beyond call detail. |

## Main nav & shell

| Requirement | Reused | Backend | Frontend | Tests | Deploy | Browser | Acceptance |
|-------------|--------|---------|----------|-------|--------|---------|------------|
| Power Dialer in main product nav | `lib/nav.ts`, `app-header` PRODUCTS | N/A | Implemented | Pending | Pending | Pending | In progress |
| Remove from Phone contextual nav | Phone `nav.ts` items | N/A | Implemented | Pending | Pending | Pending | In progress |
| Redirect `/app/phone/power-dialer` | Next redirect page | N/A | Implemented | Pending | Pending | Pending | In progress |
| 10 sidebar routes under `/app/power-dialer` | MCTB/Phone pattern | Mixed | Implemented | Pending | Pending | Pending | In progress |
| Workspace product settings | `workspace.settingsJson.powerDialer` | Implemented API | Settings tabs (General/Dialing) | Pending | Pending | Pending | In progress |

## P1 Overview

| Requirement | Reused | Backend | Frontend | Tests | Deploy | Browser | Acceptance |
|-------------|--------|---------|----------|-------|--------|---------|------------|
| KPI strip (today) | `getPowerDialerOverview` | Implemented | Overview page | Pending | Pending | Pending | In progress |
| Setup checklist | Lists/campaigns counts | Implemented | Overview panel | Pending | Pending | Pending | In progress |
| Campaign performance strip | `listCampaigns` data | Implemented | Overview list | Pending | Pending | Pending | In progress |
| Recent activity | `PowerDialerAttempt` | Implemented | Overview list | Pending | Pending | Pending | In progress |
| Attention required (full) | — | In progress | Partial copy only | Not started | Pending | Pending | In progress |
| Start dialing CTA | Dialer route | N/A | Implemented | Pending | Pending | Pending | In progress |

## P2 Dialer

| Requirement | Reused | Backend | Frontend | Tests | Deploy | Browser | Acceptance |
|-------------|--------|---------|----------|-------|--------|---------|------------|
| Session setup (campaign, list, caller ID) | `power-dialer.tsx` Session | Existing sessions API | `/dialer` | Pending | Pending | Pending | In progress |
| Manual dial + dispositions | WebRTC `power_dialer` source | Existing | Existing | Pending | Pending | Pending | In progress |
| Auto sequential dialing | — | Not started | Not started | Not started | — | — | Not started |
| Session persistence / refresh | DB sessions | Partial | Client state only | Not started | — | — | In progress |
| Session summary | — | Not started | Not started | Not started | — | — | Not started |
| Voicemail drop / screening / transfer | Phone stack | Partial / deferred | Not in dialer UI | Not started | — | — | Not started |

## P3 Campaigns

| Requirement | Reused | Backend | Frontend | Tests | Deploy | Browser | Acceptance |
|-------------|--------|---------|----------|-------|--------|---------|------------|
| Campaign list + create | `PowerDialerCampaign` | Implemented | `/campaigns` tab | Pending | Pending | Pending | In progress |
| Full create/edit wizard sections | — | Partial `configJson` | Minimal form only | Not started | — | — | In progress |
| Campaign contacts subpage | — | Not started | Not started | Not started | — | — | Not started |
| Campaign history / analytics subpages | — | Partial rollups | Analytics page lists campaigns | Not started | — | — | In progress |
| Backend rule enforcement | — | Partial (maxAttempts, DNC skip) | — | Not started | — | — | In progress |

## P4 Calling lists

| Requirement | Reused | Backend | Frontend | Tests | Deploy | Browser | Acceptance |
|-------------|--------|---------|----------|-------|--------|---------|------------|
| List CRUD | ContactList | Implemented | `/calling-lists` tab | Pending | Pending | Pending | In progress |
| CSV paste import | `lists/import` | Implemented | Lists tab | Pending | Pending | Pending | In progress |
| Column mapping / dedupe UI | — | Partial server | Paste only | In progress | — | — | In progress |
| List detail / filters / bulk | — | Not started | Not started | Not started | — | — | Not started |

## P5 Callbacks

| Requirement | Reused | Backend | Frontend | Tests | Deploy | Browser | Acceptance |
|-------------|--------|---------|----------|-------|--------|---------|------------|
| Callback queues (tabs) | `callbackAt` on attempts | Implemented API | `/callbacks` | Pending | Pending | Pending | In progress |
| Auto callback dial | — | Not started | Not started | Not started | — | — | Not started |

## P6 Call history

| Requirement | Reused | Backend | Frontend | Tests | Deploy | Browser | Acceptance |
|-------------|--------|---------|----------|-------|--------|---------|------------|
| Filtered call list | `HumanCall` + `source` filter | Implemented | `/call-history` | Pending | Pending | Pending | In progress |
| Call detail + recording | `CallDetail` | Existing | `/call-history/[id]` | Pending | Pending | Pending | In progress |
| Session history subpage | — | Not started | Not started | Not started | — | — | Not started |

## P7 Number health

| Requirement | Reused | Backend | Frontend | Tests | Deploy | Browser | Acceptance |
|-------------|--------|---------|----------|-------|--------|---------|------------|
| Number list + status | Numbers provider | Existing numbers API | `/number-health` | Pending | Pending | Pending | In progress |
| Per-number metrics | — | Not started | Not started | Not started | — | — | Not started |
| Free reputation links | External URLs | N/A | Implemented | N/A | Pending | Pending | In progress |
| Premium Telnyx reputation | — | Not started | Not started | Not started | — | — | Not started |

## P8 Analytics

| Requirement | Reused | Backend | Frontend | Tests | Deploy | Browser | Acceptance |
|-------------|--------|---------|----------|-------|--------|---------|------------|
| Dashboard + campaign rollups | `getPhoneAnalytics` | Shared phone analytics | `/analytics` | Pending | Pending | Pending | In progress |
| Rep / screening / minutes subpages | — | Not started | Not started | Not started | — | — | Not started |

## P9 Integrations

| Requirement | Reused | Backend | Frontend | Tests | Deploy | Browser | Acceptance |
|-------------|--------|---------|----------|-------|--------|---------|------------|
| Integration catalog | `IntegrationsCatalog` | Workspace integrations | `/integrations` | Pending | Pending | Pending | In progress |
| CRM list import / writeback | — | Not started | Not started | Not started | — | — | Not started |

## P10 Settings (full spec tabs)

| Requirement | Reused | Backend | Frontend | Tests | Deploy | Browser | Acceptance |
|-------------|--------|---------|----------|-------|--------|---------|------------|
| General + Dialing defaults | `settingsJson` | PATCH settings API | Partial tabs | Pending | Pending | Pending | In progress |
| Dispositions / scripts / VM / screening / compliance / team / billing tabs | — | Not started | Not started | Not started | — | — | Not started |

## Status summary (Phase 1)

| Status | Count (line items above) |
|--------|--------------------------|
| Not started | 18 |
| In progress | 32 |
| Implemented | 0 (ledger uses In progress until test/deploy) |
| Tested / Deployed / Browser verified | 0 |

_Update counts when moving rows to Tested/Deployed/Browser verified._
