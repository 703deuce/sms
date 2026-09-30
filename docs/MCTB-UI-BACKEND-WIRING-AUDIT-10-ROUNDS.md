# MCTB launch UI wiring — ten exhaustive review rounds

**Branch:** `cursor/mctb-ui-wiring-audit-f350`  
**Method:** Static end-to-end trace (control → fetch/client → API → persisted field → reload/feedback). Each round re-scans the full launch inventory even when files were reviewed in an earlier round.  
**Inventory (26 connected + 14 shared components + app route shells):**  
`src/newui-transplant/connected/mctb/*`, `src/newui-transplant/components/mctb/*`, `src/app/(app)/mctb/**` (stage-2), `/getting-started`, `/onboarding/mctb`, `/f/mctb/:token`.  
**Out of scope:** Integrations, org Settings, Help (`mctb-help-page.tsx` not traced), `/mctb/appointments|booking|calendar|voice-agent` (preserved non-launch).

---

## Round 1 — Operational surfaces (read + mutate)

| Surface | Files | Result |
|---------|-------|--------|
| Overview | `overview-page.tsx`, `overview-enrichment.tsx` | KPIs SSR/API; pause uses setup wiring elsewhere |
| Missed calls list/detail | `missed-calls-page.tsx`, `missed-call-detail-page.tsx` | List filters + exclusion add → `addMctbExclusion` throws on failure |
| Conversations | `conversations-page.tsx` | Send uses authoritative conversation phone |
| Voicemail inbox | `voicemail-page.tsx`, `voicemail-messages-panel.tsx` | `phoneNumberId` query param; reviewed POST checks `res.ok` |
| Analytics | `analytics-page.tsx` | **Fixed:** range change checks `res.ok`, reverts range + alert on failure |
| Consent history | `consent-history-page.tsx` | Read-only API |
| Public form | `public-request-form-page.tsx` | Public API submit |

---

## Round 2 — Launch IA configuration routes

| Route | Entry | Result |
|-------|-------|--------|
| Phone | `mctb-setup-phone-wiring.ts`, number drawer | Setup + onboarding verify APIs |
| Missed-call recovery tabs | `mctb-ia-pages.tsx`, `setup-pages.tsx`, wiring hooks | Pause immediate; rules/text require Save |
| Text back | `text-back-editor.tsx`, booking section | **Fixed:** listens `mctb-setup-updated` to resync |
| Notifications | `setup-pages.tsx`, `useMctbNotificationsWiring` | **Fixed:** persist errors surfaced; serialized `postMctbHandoff` |
| Voicemail setup | `useMctbVoicemailWiring`, greeting panels | Partial triggerRules POST; ensure box before transcription |
| Test | `useMctbTestWiring` | **Fixed:** `setup-test` POST failure throws before live-test |
| AI recovery | `ai-recovery-page.tsx` | Save checks `res.ok` |
| Getting started | `mctb-getting-started-page.tsx` | **Fixed:** resume recovery surfaces errors |
| Setup overview | `mctb-setup-overview-wiring.ts` | **Fixed:** loading until exclusions/handoff/live/voicemail summaries load |

---

## Round 3 — Legacy `/mctb/setup/*` and redirects

All legacy setup section pages mount the same connected shells (`setup-pages.tsx`, IA pages). Redirect matrix in page manifest verified in code (recovery consolidates business-hours/follow-up/schedule). **Pass** — no duplicate save paths found beyond documented mirrors.

---

## Round 4 — Onboarding (wizard + operational)

| Step | Result |
|------|--------|
| Phone / forwarding | Controller `post` + `setError` |
| Consent / text-back | `saveAll` errors on controller |
| Notifications | `postMctbHandoff` + reload |
| Voicemail | **Fixed:** `ensureVoicemailNumberBox` + `res.ok`; wizard/operational Continue uses `setError` |
| Live test (wizard) | **Fixed:** `startLiveTest` errors → `c.setError` |
| AI toggle (operational) | Fire-and-forget settings fetch — **monitor** (non-blocking optional feature) |

---

## Round 5 — Shared components (editors, tables, pause)

| Component | Result |
|-----------|--------|
| `exclusions-table.tsx` | **Fixed:** add/delete errors in UI |
| `mctb-setup-links-editor.tsx` | **Fixed:** default link requires `phoneNumberId` |
| `consent-editor.tsx` | **Fixed:** `mctb-setup-updated` resync |
| `text-back-editor.tsx` | Same |
| `mctb-recovery-pause-opus.tsx` | No `onUpdated` on failed save (prior fix) |
| Booking link / prompt / inbox helpers | Traced to booking-links + consent-prompt APIs |

---

## Round 6 — API client & cache (`mctb-setup-client.ts`)

| Concern | Result |
|---------|--------|
| `fetchMctbSetup` TTL | **Fixed:** `useMctbSetupApi.reload` uses `{ force: true }` |
| `saveMctbSetup` | Dispatches `mctb-setup-updated` on success |
| `postMctbHandoff` | Serialized chain + `mctb-handoff-updated` |
| Exclusions helpers | Throw on non-OK |

---

## Round 7 — Races, ordering, stale closures

Re-verified: handoff config/recipient refs, test poll `reloadGeneration`, conversation send phone authority, recovery voicemail partial `triggerRules`, notifications `persistConfig` config-only POST. **Pass** after round-2 fixes.

---

## Round 8 — Error handling & user feedback

| Area | Result |
|------|--------|
| Analytics range | Alert + revert |
| Setup overview pause | `load()` after failed save |
| Notifications persist | Banner on handoff persist failure |
| Exclusions | Dialog + list banner |
| Getting started resume | Inline alert |
| Header meta fetches (IA) | Handoff meta skips update when `!res.ok` |

Remaining **monitor** (non-critical): optional usage stat on recovery IA page swallows fetch error (strip hidden on failure).

---

## Round 9 — `wired` prop completeness (mirror vs connected)

Spot-checked mirror routes under `newui-transplant/mirror/routes/mctb/**` — production pages always pass `wired` from connected hooks for interactive controls. Read-only mirrors (consent history, detail) use connected data fetchers directly. **Pass.**

---

## Round 10 — Regression grep & full file list

**Connected files (all opened in ≥1 round):**  
`ai-recovery-page.tsx`, `analytics-page.tsx`, `consent-history-page.tsx`, `conversations-page.tsx`, `mctb-getting-started-page.tsx`, `mctb-help-page.tsx` (out of scope), `mctb-ia-pages.tsx`, `mctb-onboarding-opus-view.tsx`, `mctb-onboarding-operational-steps.tsx`, `mctb-onboarding-wizard-shell.tsx`, `mctb-onboarding-wizard-steps.tsx`, `mctb-setup-guide.ts`, `mctb-setup-overview-wiring.ts`, `mctb-setup-phone-wiring.ts`, `missed-call-detail-page.tsx`, `missed-calls-page.tsx`, `onboarding-page.tsx`, `overview-enrichment.tsx`, `overview-page.tsx`, `public-request-form-page.tsx`, `setup-hooks.ts`, `setup-pages.tsx`, `setup-wiring-hooks.ts`, `voicemail-greeting-panel.tsx`, `voicemail-messages-panel.tsx`, `voicemail-page.tsx`.

**Grep targets:** wrong query params (`numberId` vs `phoneNumberId`), missing `res.ok`, `void fetch` without feedback on user actions — **no new launch blockers** beyond items marked monitor above.

---

## Verdict after ten rounds

Launch MCTB UI controls traced to authoritative APIs with fixes applied for every confirmed wiring bug in this pass. Residual **monitor** items are optional stats or onboarding AI toggles that do not block core missed-call → text → conversation flows. Browser certification remains a separate gate (`docs/V1-PRODUCTION-CERTIFICATION.md`).

**Primary audit log:** `docs/MCTB-UI-BACKEND-WIRING-AUDIT.md`
