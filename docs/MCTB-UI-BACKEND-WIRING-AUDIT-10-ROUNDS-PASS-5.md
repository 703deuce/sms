# MCTB UI wiring audit — Pass 5 (rounds 41–50, user journeys)

**Date:** 2026-09-30  
**Focus:** Front-end → back-end journeys a real customer runs during setup and daily ops.

---

## Round 41 — Overview pause after failed save

**Journey:** User pauses recovery on Overview; API fails.  
**Bug:** `MctbRecoveryPauseOpus` called `onUpdated()` in the `catch` block, reloading setup and showing the old pause state as if save succeeded.  
**Fix:** Only call `onUpdated` on successful `saveMctbSetup`.

## Round 42 — Overview / Getting started stale after setup elsewhere

**Journey:** User saves recovery on Missed-call Recovery, returns to Overview or Getting started.  
**Bug:** Pause strip and checklist did not refresh until full navigation remount.  
**Fix:** Listen for `mctb-setup-updated` and reload setup / getting-started payload.

## Round 43 — KPI “Needs reply” wrong inbox filter

**Journey:** User clicks Needs reply on Overview.  
**Bug:** Link went to `/mctb/conversations` (all threads), not the Needs reply workspace.  
**Fix:** `?filter=needs_reply` (matches conversations route parser).

## Round 44 — Analytics drilldowns ignored date + wrong query keys

**Journey:** User views 30d analytics → clicks Missed calls or Suppressed count.  
**Bug:** Used `?range=` (not parsed by missed-calls list) and `?recovery=suppressed` instead of `status=suppressed`; client list also reset filters to defaults after SSR.  
**Fix:** Drilldown URLs use `date=` + `status=`; `parseMissedCallsListQuery` accepts legacy `range` / `recovery`; SSR passes `initialQuery` via `missedCallsListQueryToUi`.

## Round 45 — Missed calls deep link vs client state

**Journey:** User opens shared link `/mctb/missed-calls?status=suppressed&date=7d`.  
**Bug:** Server rendered filtered data, but `NewUiMctbMissedCallsPage` initialized `query` from hardcoded defaults and refetched unfiltered list on first effect.  
**Fix:** `missedCallsListQueryToUi(query)` from `page.tsx` into `initialQuery`.

## Round 46 — Exclusions list silent failure

**Journey:** User opens Exclusions during outage or auth glitch.  
**Bug:** `fetchMctbExclusions` throw was caught and shown as empty list (looked like “no exclusions”).  
**Fix:** `loadError` state + alert (add/remove errors unchanged).

## Round 47 — Booking link / request form without phone first

**Journey:** User configures booking URL before forwarding number is assigned.  
**Bug:** `saveMctbSetup` was skipped when `phoneNumberId` was null, so `defaultLinkUrl` never persisted.  
**Fix:** POST `defaultLinkUrl` without `phoneNumberId` when needed; booking section listens for `mctb-setup-updated`.

## Round 48 — Links editor same phoneNumberId gate

**Journey:** Setup → Links (legacy) with partial phone setup.  
**Fix:** `useMctbLinksWiring.save` omits `phoneNumberId` when null; reload on `mctb-setup-updated`.

## Round 49 — Cross-page setup refresh (phone, voicemail, test)

**Journey:** User changes sender on Phone, switches to Test or Voicemail tab.  
**Bug:** Those hooks only loaded on mount; showed stale sender / opener flags.  
**Fix:** `mctb-setup-updated` → `reload()` on phone wiring, voicemail wiring, test wiring.

## Round 50 — Missed calls list error recovery

**Journey:** Transient API failure on Missed Calls list.  
**Bug:** Error message with no Retry (user stuck until hard refresh).  
**Fix:** Retry button calling `load()`.

---

## Fix IDs (master log)

47. Pause control false refresh on error.  
48. Overview + Getting started setup-updated sync.  
49. Overview Needs reply deep link.  
50. Analytics → missed calls drilldown query contract + SSR/client filter parity.  
51. Exclusions load error vs empty list.  
52. Booking link / links save without phoneNumberId.  
53. Phone / voicemail / test setup-updated reload.  
54. Missed calls list Retry on error.
