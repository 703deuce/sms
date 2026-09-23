# Voice + MCTB UI closure pass — final report

**Starting SHA:** `ccfa2d3e1d0effb9fea39f86dcf146bfd915f14b` (`master`)  
**Branch:** `cursor/voice-ui-closure-2304`  
**Production deploy:** NOT performed (per instructions).

---

## Google discrepancy (V3-R11) — determination **B**

**Answer: B** — Google V3 scheduling was implemented on a feature branch but is **not merged into current `master`**.

| Item | Detail |
|------|--------|
| Branch | `cursor/voice-v3-google-calendar-2304` (remote: `origin/cursor/voice-v3-google-calendar-2304`) |
| Tip commit | `02fc3415` — `feat(voice-v3): wire Google Calendar to V3 scheduling provider boundary` |
| Earlier commits | `2c6599e6`, `965702b4` (provider end-to-end + date/time boundary) |
| On `master`? | **No** — `git merge-base --is-ancestor 02fc3415 master` → NOT ancestor |

**Files present on `02fc3415` but absent on `ccfa2d3e` `master` (examples):**

- `src/lib/voice-v3/calendar/google/google-create-booking.ts`
- `src/lib/voice-v3/calendar/google/google-find-availability.ts`
- `src/lib/voice-v3/calendar/google/google-update-booking.ts`
- `src/lib/voice-v3/calendar/google/google-cancel-booking.ts`
- `src/lib/voice-v3/calendar/google/resolve-voice-v3-google-calendar.ts`
- `src/lib/voice-v3/calendar/fetch-v3-provider-busy.ts`
- Provider-neutral refactors in `book-dispatch.ts`, `find-dispatch.ts`, `reschedule-dispatch.ts`, `cancel-dispatch.ts`
- `scripts/test-voice-v3-google-calendar-provider.ts`

**On `master` today:** only type references to `"google"` in `booking-types.ts` / `persist-booking-after-confirmation.ts`; `book-dispatch.ts` still hardcodes Microsoft execution paths.

**Implication:** This is **merge-loss / not merged**, not a UI task. PSTN Google booking cert remains separate from this UI pass. **No Google runtime code was added in this PR.**

---

## Voice UI

| Area | Result |
|------|--------|
| Fake activity / cost / provider / tags | Removed for real calls; demo IDs still use demo fixtures |
| Activity Feed | `buildCustomerActivityFeed()` from API events, transfers, sanitized tool outcomes, call timestamps |
| Cost | Shown only when `call.costCents > 0` |
| Provider | Shown only when recording row includes `provider` (e.g. Telnyx) |
| Tags / lead status | Removed (no durable CRM wire on this page) |
| Contact card | Name, phone, email when known — no fake “last contact” |
| Terminology | Breadcrumb → AI After Hours |
| Recording / transcript / summary | Explicit processing / unavailable states; partial failure does not break page |
| API | `toolExecutions` include `toolType` via `tool` relation (minimal shape for UI) |

---

## Knowledge crawl UI

| Surface | Behavior |
|---------|----------|
| `/voice/knowledge` | “Scan website” → `scan_website` → poll `/api/voice/knowledge/crawl/[jobId]` |
| Wizard `information-step.tsx` | Same poll; knowledge items update on terminal crawl state (not on enqueue-only) |
| Customer copy | Queued / scanning / preparing / ready / failed — no internal IDs |

---

## Voice testing

| Entry | Change |
|-------|--------|
| `/voice/agents/[id]/voice-test` | `VoiceTestStep` uses **`VoiceV3BrowserCall`** (was `LiveKitBrowserCall`) |
| Labeling | “Test Amy”, “AI After Hours” on mockup |
| Legacy | `AgentBrowserCall` / `LiveKitBrowserCall` components retained for other routes |

---

## MCTB

| Item | Result |
|------|--------|
| Nav cleanup | **AI Lead Recovery** and **Voice Agent** removed from primary `buildMctbV1Nav` (routes preserved) |
| Browser cert | `npm run cert:appointments-mctb-browser:preflight` → **OK** (local HEAD `ccfa2d3e` matches `/api/health`) |
| Full CERT-MCTB re-run | **Not executed here** — runner targets Coolify preview URL + `CERT_BROWSER_PASSWORD`, not localhost-only smoke |

**Code verification (stale Sept failures):**

| ID | Sept 8 | Current code expectation |
|----|--------|---------------------------|
| MCTB-13 links 404 | FAIL | **STALE** — `/mctb/setup/links` route exists |
| MCTB-20 recovery redirect | FAIL | **STALE** — `business-hours` → `setupRecovery` redirect |
| MCTB-05 / 09 / 10 | FAIL | **Re-cert required** on preview — no code change in this pass until fresh FAIL |

**R-05 (7-day no forwarded calls):** **BLOCKED** — no authoritative “zero forwarded calls in 7 days” signal found without new backend aggregation; not implemented.

---

## Tests

| Command | Result |
|---------|--------|
| `npx tsx src/lib/voice/calls/customer-activity-feed.test.ts` | **PASS** |
| `npm run cert:appointments-mctb-browser:preflight` | **PASS** |

---

## Architecture confirmation

**Voice V3 runtime architecture unchanged** — no edits to GPT-Live, Sol/delegation, book-dispatch Microsoft commit, transfer, recording, or crawl worker logic (UI + minimal call detail API enrichment only).

---

## Changed files (this pass)

- `src/lib/voice/calls/customer-activity-feed.ts` (+ test)
- `src/lib/voice/knowledge/crawl-job-ui.ts`
- `src/components/voice/use-voice-website-crawl-poll.ts`
- `src/components/voice/voice-website-crawl-progress.tsx`
- `src/app/(app)/voice/calls/[id]/page.tsx`
- `src/app/api/voice/calls/[id]/route.ts`
- `src/app/(app)/voice/knowledge/page.tsx`
- `src/components/solutions/appointment-receptionist/steps/information-step.tsx`
- `src/components/receptionist/steps/voice-test-step.tsx`
- `src/lib/products/mctb-nav.ts`
- `docs/VOICE-UI-CLOSURE-PASS-REPORT-2026-09-22.md`

---

## Remaining blockers (genuine)

1. **Merge Google V3 branch** (`02fc3415`) or cherry-pick provider-neutral dispatch before PSTN Google cert.
2. **Full MCTB browser cert** on preview after this candidate merges — fix only rows that still FAIL.
3. **One PSTN smoke** on final candidate SHA after merge (recording + call detail truth).
