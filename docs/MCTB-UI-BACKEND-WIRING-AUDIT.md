# MCTB UI → backend wiring audit (code review)

**Date:** 2026-09-30  
**Method:** Static trace from `src/newui-transplant/connected/mctb/*` and shared MCTB components to `src/app/api/mctb/*` and runtime libs. **Ten exhaustive review rounds** (see `docs/MCTB-UI-BACKEND-WIRING-AUDIT-10-ROUNDS.md`) plus earlier passes (surface → races/cache → E2E). **No browser certification** unless separately requested.  
**Out of scope (per request):** Integrations, org Settings, Help, generic billing.

---

## Summary

| Verdict | Count |
|--------|--------|
| Wired end-to-end (control → API → persisted/runtime) | Most launch surfaces |
| Fixed in review passes (stale state / silent failure / race / cache) | 10+ items |
| Requires explicit Save (by design) | Recovery timing, missed-call rules, text-back opener, consent mode |
| Read-only / navigational | Overview KPIs, analytics, consent history, missed-call list/detail |

---

## Operational pages

| Route | Primary UI | Backend | Runtime effect |
|-------|------------|---------|----------------|
| `/mctb` | `overview-page.tsx` | SSR `MctbOverviewPayload` + `fetchMctbSetup` for pause | Pause/resume via `saveMctbSetup` → schedule/runtime; KPIs from overview API |
| `/mctb/missed-calls` | `missed-calls-page.tsx` | `GET /api/mctb/missed-calls` | List only; row exclusion uses `addMctbExclusion` → suppression store |
| `/mctb/missed-calls/:id` | `missed-call-detail-page.tsx` | `GET /api/mctb/missed-calls/:id` | Read-only lifecycle |
| `/mctb/conversations` | `conversations-page.tsx` | Shared inbox + `fetchMctbSetup` context | Replies via canonical conversations stack (not duplicated MCTB composer) |
| `/mctb/voicemail` | `voicemail-page.tsx`, `voicemail-messages-panel.tsx` | `GET/POST /api/phone/voicemail` | Mark reviewed / playback; greeting on setup tab |
| `/mctb/analytics` | `analytics-page.tsx` | `GET /api/mctb/analytics?range=` | Read-only metrics |
| `/mctb/compliance/consent` | `consent-history-page.tsx` | `GET /api/mctb/consent-log` | Audit read |

---

## Launch IA configuration (canonical routes)

| Route | Connected entry | Save / action path | Runtime |
|-------|-----------------|-------------------|---------|
| `/getting-started` | `mctb-getting-started-page.tsx` | `GET /api/mctb/getting-started`; resume → `saveMctbSetup({ enabled, pauseUntil: null })` | Onboarding readiness + pause |
| `/mctb/phone` | `mctb-setup-phone-wiring.ts` + drawer | `POST /api/mctb/setup`, `POST /api/mctb/onboarding` (verify steps) | Forwarding, ingress, business line |
| `/mctb/missed-call-recovery` | `mctb-ia-pages.tsx` tabs | See sub-rows below | Recovery domain |
| ↳ General | `NewUiMctbSetupRecoveryPage` | `useMctbRecoveryWiring`: pause presets / resume → `saveMctbSetup`; **Save** → delay/cooldown/max | `loadMctbScheduleSettings`, runtime triggers |
| ↳ Rules | `NewUiMctbSetupMissedCallRulesPage` | Checkbox → local state; **Save rules** → `saveTriggerRulesOnly` → `POST /api/mctb/setup` `triggerRules` | Missed-call classification |
| ↳ Consent | `ConsentEditor` | **Save** → `saveMctbSetup` `consentMode` + attestation; prompt panel → `/api/mctb/consent-prompt` | TeXML mode, consent pipeline |
| ↳ Exclusions | `ExclusionsTable` | `POST/DELETE /api/mctb/exclusions` | Eligibility / suppression |
| `/mctb/text-back` | `TextBackEditor` + `MctbBookingLinkSection` | **Save** → `saveMctbSetup` (`messageTemplate`, `recoveryGoal`); booking → `/api/mctb/booking-links` + `defaultLinkUrl` | SMS opener + `{{booking_link}}` |
| `/mctb/notifications` | `NewUiMctbSetupNotificationsPage` | `POST /api/mctb/handoff` (recipients, routing matrix, urgent rules) | Team notifications + urgent classifier config |
| `/mctb/voicemail` (setup tab) | `useMctbVoicemailWiring` | `/api/phone/voicemail` + `saveMctbSetup` for send-after-VM | Greeting audio + MCTB trigger flag |
| `/mctb/setup/test` | `useMctbTestWiring` | `POST /api/mctb/live-test`, `POST /api/mctb/setup-test` | Verification only (no fake pass) |
| `/mctb/ai-recovery` | `ai-recovery-page.tsx` | `POST /api/mctb/ai-recovery/settings`, `POST /api/mctb/lead-recovery/config` | Lead recovery policies |
| `/onboarding/mctb` | `mctb-onboarding-*` | Same setup/onboarding/handoff/voicemail APIs as above | Wizard persistence |
| `/f/mctb/:token` | `public-request-form-page.tsx` | Public request form API | Customer form submit |

Legacy `/mctb/setup/*` routes redirect into the IA routes above; wired components are reused (`setup-pages.tsx`).

---

## Bugs found and disposition

### Fixed (this pass)

1. **Notifications — add/edit recipient (fixed earlier on `master`)**  
   `setRecipients(next)` then `save()` posted **stale** `recipients`. **Fix:** `save(recipientsOverride)`.

2. **Notifications — urgent instructions on blur**  
   `onInstructionsBlur` posted `n.config` from a stale closure, dropping typed `emergencyCriteria`. **Fix:** `handoffConfigRef` + persist latest config on blur; routing toggles merge from ref.

3. **AI Recovery — save**  
   `onSave` ignored HTTP failures. **Fix:** check `res.ok` and throw with API error body (SaveBar can surface).

4. **Notifications — recipient save vs routing matrix race**  
   `save(recipients)` used React `config` from closure; a routing toggle could interleave with add/edit recipient. **Fix:** `configRef` + `recipientsRef`; serialized `postMctbHandoff()`.

5. **Notifications — config-only POST included `recipients`**  
   Every routing/urgent toggle re-saved the full recipient list from a possibly stale render, racing add/edit. **Fix:** `persistConfig()` posts `{ config }` only (API preserves recipients when omitted).

6. **Voicemail — “text after voicemail” toggle**  
   `saveRecoveryToggle` re-read `triggerRules` from `fetchMctbSetup()` (8s client cache) and could revert rule changes made on Missed-call Rules. **Fix:** POST partial `triggerRules: { voicemail }` only.

7. **Voicemail — transcription toggle before box exists**  
   `saveTranscription` returned early when `voicemailBoxId` was null after optimistic UI update. **Fix:** `ensureVoicemailBoxId()` before POST.

8. **Setup hooks — stale setup cache on reload**  
   Recovery / voicemail / links `reload()` used cached setup. **Fix:** `fetchMctbSetup({ force: true })` in those hooks.

9. **Conversations — send used list closure phone**  
   `onSendMessage` used `conversations.find` phone; could be stale after contact merge. **Fix:** `fetchConversation(id)` for authoritative `phone` before send.

10. **Live test polling — out-of-order reload**  
    Interval `reload()` could apply older poll after newer. **Fix:** `reloadGeneration` guard + forced setup fetch in test wiring.

11. **Handoff writes — concurrent POSTs**  
    Fire-and-forget `fetch` on toggles vs awaited `save()`. **Fix:** `postMctbHandoff` serializes writes in client.

### E2E flow audit (round 2 — UI → API → persistence → UI feedback)

| Flow | Break found | Fix |
|------|-------------|-----|
| Voicemail inbox `?numberId=` deep link | Client sent `numberId` query; API only filters on `phoneNumberId` → wrong/all messages | `mctbVoicemailInboxUrl()` maps to `phoneNumberId` |
| Mark voicemail reviewed | POST errors ignored; list refreshed anyway | `markVoicemailMessageReviewed()` checks `res.ok` |
| Text Back page KPI strip | Header stats fetched once; Save did not refresh strip | Listen for `mctb-setup-updated` after `saveMctbSetup` |
| Notifications page KPI strip | Recipient/urgent counts stale after edits | Listen for `mctb-handoff-updated` after `postMctbHandoff` |
| Onboarding text-back Continue | `saveAll()` failure did not surface; wizard could feel stuck | `setError` on controller + try/catch on step |
| Onboarding notifications save | Raw `fetch` bypassed serialized handoff queue | `postMctbHandoff` + `reload()` |

### Pass log (what each pass targeted)

| Pass | Focus | Examples found |
|------|--------|----------------|
| 1 | Control → API → persistence | Missing error checks, Save vs immediate-action, mirror `wired` props |
| 2 | Races & cache | Handoff recipient+config races, setup cache on recovery toggle, serialized handoff POST |
| 3 | Async / edge | Test poll ordering, conversation send phone authority, transcription without box |
| 4–6 | Full round-trip | Voicemail filter param, reviewed state, header refresh events, onboarding error path |
| 7–10 | Full inventory re-scan | See `MCTB-UI-BACKEND-WIRING-AUDIT-10-ROUNDS.md` |

### Fixed (ten-round pass)

12. **Setup overview — premature `loading: false`** — Summary rows showed “Not loaded” until secondary fetches finished. **Fix:** single `setLoading(false)` in `finally` after exclusions/handoff/live-test/voicemail summaries.

13. **Analytics — silent range failure** — Failed fetch left UI on new range with old data. **Fix:** `res.ok` check, revert range, `role="alert"` message.

14. **`useMctbSetupApi.reload`** — Used 8s cached setup after saves. **Fix:** `fetchMctbSetup({ force: true })`.

15. **Getting started — resume recovery** — Failed POST with no feedback. **Fix:** `resumeError` state.

16. **Setup overview pause toggle** — Failed save still implied success. **Fix:** `load()` on catch to resync.

17. **Live test — setup-test POST** — Errors swallowed; live-test ran anyway. **Fix:** throw before live-test POST.

18. **Links editor — set default** — Could POST with null `phoneNumberId`. **Fix:** guard + throw.

19. **Onboarding voicemail — ensure_number_box** — Ignored HTTP failures. **Fix:** `ensureVoicemailNumberBox()` + `setError` on Continue.

20. **Exclusions table** — Add/delete failures uncaught. **Fix:** inline errors.

21. **Notifications — persistConfig** — Swallowed errors. **Fix:** `handoffPersistError` banner.

22. **Text-back / consent editors** — Stale after external setup save. **Fix:** `mctb-setup-updated` listener.

23. **Wizard test step** — `startLiveTest` errors hidden. **Fix:** `c.setError`.

### By design (not bugs)

- **Recovery delay/cooldown/max** and **missed-call rule checkboxes** update React state until user clicks **Save** / **Save rules** — then `POST /api/mctb/setup`.
- **Text-back opener** and **consent mode** require **Save** (explicit `saveMctbSetup`).
- **Pause presets** on recovery apply immediately via `saveMctbSetup` (no extra Save).

### Low risk / monitor

- **Recovery IA usage stat** (`mctb-ia-pages.tsx`): optional monthly cap fetch failure hides stat only.
- **Onboarding AI recovery toggle** (`mctb-onboarding-operational-steps.tsx`): settings POST errors not surfaced (optional path).
- **setup client cache** (`fetchMctbSetup` 8s TTL): pages that need fresh state after save call `reload()` or `{ force: true }` (overview does).
- **AI Recovery** disabled path: lead-recovery config POST skipped when `enabled` false — intentional; `POST /api/mctb/ai-recovery/settings` with `enabled: false` disables via `applyLaunchAiRepliesSetting`.
- **Onboarding AI toggle** (`mctb-onboarding-operational-steps.tsx`): `void fetch` on settings without surfacing errors — same class as handoff fire-and-forget.
- **Missed-call recovery tabs:** General vs Rules each mount their own `useMctbRecoveryWiring()`; switching tabs reloads from API (no shared dirty state across tabs — acceptable).
- **Legacy routes:** `/mctb/numbers` → phone drawer; `/mctb/ai-lead-recovery` → `/mctb/ai-recovery`; `/mctb/reminders` and scheduling stubs redirect per `removed-scheduling-routes`.
- **Out-of-launch surfaces preserved:** `/mctb/appointments`, `/mctb/booking`, `/mctb/calendar`, `/mctb/voice-agent` — not in V1 launch IA; audit focused on connected `newui-transplant/connected/mctb` launch routes above.

---

## Conversations composer (runtime)

| Control | Path |
|---------|------|
| Send reply | `sendNewMessage({ mctbCompose: true })` via `kimi-inbox-adapter` → shared SMS pipeline |
| Close thread | `patchConversation` |
| Composer disabled | `manualTwoWay` from setup capabilities — platform sender gate (`MCTB_PLATFORM_SENDER_MANUAL_REPLY_MESSAGE`) |

---

## API map (MCTB customer surfaces)

| API | Used by |
|-----|---------|
| `GET/POST /api/mctb/setup` | Recovery, rules, text-back, consent, phone, voicemail flags, pause, getting-started resume |
| `GET/POST /api/mctb/handoff` | Notifications, team routing, urgent test |
| `GET/POST/PATCH/DELETE /api/mctb/exclusions` | Exclusions table |
| `GET/POST /api/mctb/consent-prompt` | Consent editor (Press-1 script/audio) |
| `GET/POST /api/mctb/booking-links` | Booking link section, links editor |
| `GET/POST /api/mctb/live-test`, `setup-test` | Setup test page |
| `GET /api/mctb/missed-calls`, `/:id` | Operational lists |
| `GET /api/mctb/analytics` | Analytics |
| `GET /api/mctb/consent-log` | Consent history |
| `GET/POST /api/mctb/ai-recovery/*`, `lead-recovery/config` | AI Recovery |
| `GET /api/mctb/getting-started` | Getting started checklist |
| `GET /api/mctb/overview-enrichment` | Overview enrichment strip |
| `GET/POST /api/phone/voicemail` | Voicemail greeting + inbox |

---

## Governing rule

Every control must either (a) call a documented API that mutates workspace/MCTB state used by the eligibility/send pipeline, or (b) be labeled read-only / unavailable. Mirror-only components under `mirror/routes/mctb/**` are not authoritative until mounted with a `wired` prop from `connected/mctb`.
