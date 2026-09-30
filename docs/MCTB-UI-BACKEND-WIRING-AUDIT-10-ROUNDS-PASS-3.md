# MCTB launch UI wiring — ten review rounds (pass 3)

**Branch:** `cursor/mctb-ui-wiring-audit-f350`  
**Follows:** pass 1 (`…-10-ROUNDS.md`) + pass 2 (`…-PASS-2.md`)  
**Cumulative:** rounds **21–30**

---

## Round 21 — API client correctness

| Item | Finding | Fix |
|------|---------|-----|
| `fetchMctbExclusions()` | Returned `[]` on HTTP error → false empty exclusions table | Throw with API error message |

## Round 22 — Phone & forwarding load integrity

| Item | Finding | Fix |
|------|---------|-----|
| `useMctbSetupPhoneWiring` | Failed setup fetch still rendered empty wired form | `loadError`; `wired` undefined when error; Retry on phone page |

## Round 23 — Setup overview load integrity

| Item | Finding | Fix |
|------|---------|-----|
| `useMctbSetupOverviewWiring` | Generic failure copy only | `loadError` from API; Retry on setup overview page |

## Round 24 — Overview pause control

| Item | Finding | Fix |
|------|---------|-----|
| `MctbRecoveryPauseOpus` | Pause/resume failures silent | `actionError` + resync via `onUpdated` on failure |

## Round 25 — Conversations list

| Item | Finding | Fix |
|------|---------|-----|
| `conversations-page.tsx` | Inbox list failures showed empty inbox | `listError` + Retry |

## Round 26 — Notifications handoff load

| Item | Finding | Fix |
|------|---------|-----|
| `useMctbNotificationsWiring` | `!res.ok` left stale/partial state | Throw; `loadError`; empty state; Retry shell |
| IA notifications header | Meta fetch silent on failure | `handoffMetaError` banner |

## Round 27 — Missed call detail

| Item | Finding | Fix |
|------|---------|-----|
| `missed-call-detail-page.tsx` | Error state without recovery action | Retry button re-fetches detail |

## Round 28 — Links wiring hook

| Item | Finding | Fix |
|------|---------|-----|
| `useMctbLinksWiring` | `fetchMctbSetup` failure unhandled | `loadError` on hook (legacy links route) |

## Round 29 — Re-verify pass 1–2 surfaces

Re-traced: voicemail inbox, analytics range, exclusions table, onboarding voicemail/AI, booking editors, text-back/consent editors, live test start, wizard test step. **No new regressions**; prior fixes held.

## Round 30 — Regression grep

Searched `connected/mctb` + `components/mctb` + `mctb-setup-client` for silent empty returns on mutations/loads. Remaining quiet failures limited to optional enrichment (`overview-enrichment`) and browser `audio.play()` — documented in master audit.

---

## Verdict (pass 3)

**30 cumulative static rounds.** Critical fix: exclusions list no longer masquerades as empty on API failure. Load paths for phone, setup overview, notifications, and conversations now fail visibly with retry where appropriate.
