# New-app Phone product audit (2026-10-19)

**App:** `new-app` on `https://transovo.ai`  
**Supersedes (partially stale):** `docs/NEW-APP-PHONE-WIRING-AUDIT.md` — that doc still says “no Phone APIs”; this audit reflects current code.

**Status legend**

| Status | Meaning |
|--------|---------|
| **PASS (prod)** | Verified on production or confirmed in prod Telnyx/logs this sprint |
| **PASS (code)** | Wired end-to-end in code; not re-smoked on prod in this pass |
| **PARTIAL** | Real backend exists but UI/runtime gap, mock enrichment, or narrow path only |
| **UNTESTED** | Implemented but no evidence in this audit |
| **NOT BUILT** | Missing or placeholder only |

**Production snapshot:** `GET /api/health` → `commitSha` **`92d458de`** (2026-10-19). Phone APIs return **200** (`/api/phone/readiness`, `/api/phone/calls`). Newer recording-stream fixes may be on `master` but not yet deployed — confirm `commitSha` after deploy.

---

## 1. Phone surface map

| Nav | Route | Primary stack |
|-----|-------|----------------|
| Overview | `/app/phone` | Server: `analytics`, `listCalls`, `getPhoneReadiness`, `loadOwnedNumbers`, `listCampaigns` |
| Dialer | `/app/phone/dialer` | `Dialer` + `WorkspaceProvider.startCall` (Telnyx WebRTC) |
| Power Dialer | `/app/phone/power-dialer` | `PowerDialer` + `/api/phone/power-dialer/*` |
| Calls | `/app/phone/calls` | `CallsTable` variant `phone` → `fetchCalls` |
| Call detail | `/app/phone/calls/[id]` | `getCallDetail` → `CallDetail` |
| Call Handling | `/app/phone/call-handling` | `PhoneRoutingEditor` → `saveRouting` |
| Analytics | `/app/phone/analytics` | `fetchPhoneAnalytics` |
| Numbers | `/app/phone/numbers` | Redirect → `/app/numbers` |

**Global shell (Phone):** `IncomingCallBar`, `ActiveCallBar`, header link to dialer — `WorkspaceProvider`.

**HTTP APIs (19 routes):** `new-app/app/api/phone/*` + `POST /api/telnyx/phone` webhook.

**Smoke script:** `new-app/scripts/test-phone-greenfield.mjs` (readiness, settings, calls, routing, analytics, power campaigns).

---

## 2. Core calling (WebRTC + Call Control)

| Feature | Status | Evidence / notes |
|---------|--------|------------------|
| Browser WebRTC register | **PASS (prod)** | `fetchWebRtcToken`, `reportWebRtcPresence`, TelnyxRTC singleton |
| Outbound PSTN | **PASS (prod)** | User confirmed; `registerOutboundCall` + `client.newCall` + `linkCallControl` |
| Inbound ring UI | **PASS (prod)** | SDK `telnyx.notification` + `fetchRingingInbound` fallback |
| Answer inbound | **PASS (prod)** | `answerInboundSdkCall`; bridge on Telnyx `call.answered` / `call.bridged` (not UI-only bridge) |
| Decline inbound | **PASS (code)** | `registerInboundReject` |
| Hang up | **PASS (code)** | `endCall` → SDK `hangup` |
| Mute / unmute | **PASS (code)** | SDK `muteAudio` / `unmuteAudio` — **UNTESTED** on prod PSTN in this pass |
| Hold / resume | **PASS (code)** | SDK `hold` / `unhold` — **UNTESTED** on prod |
| In-call transfer (UI) | **NOT BUILT** | No transfer control in `ActiveCallBar` |
| Server inbound transfer | **PARTIAL** | `inbound-runtime` can `transfer` when route `external` + `PHONE_INBOUND_EXTERNAL_FORWARD` |
| Multi-tab / duplicate SDK | **PASS (code)** | `telnyx-webrtc-session.ts` singleton |
| Client trace | **PASS (code)** | `POST /api/phone/webrtc/trace` |

---

## 3. Call history & detail

| Feature | Status | Evidence / notes |
|---------|--------|------------------|
| Calls list (DB) | **PASS (prod)** | `fetchCalls` → `listCalls` on `humanCall` |
| Filters (inbound/outbound/missed/voicemail/follow-up) | **PASS (code)** | API `filter` param |
| Call detail load | **PASS (prod)** | Example `cmvf8iljt002kl30kaxntx9hj` |
| Mark handled / reopen | **PASS (code)** | `patchCall({ handled })` |
| Call back from detail | **PASS (code)** | `startCall` from `CallActions` |
| Internal notes (save) | **PARTIAL** | `patchCall({ note })` persists `HumanCallNote`; **UI does not load existing notes** (`CallNotes` `initial=[]` only) |
| Contact card on detail | **PARTIAL** | Uses `getContact(call.contactId)` from **`lib/data.ts` fixtures**, not live CRM row |
| Line label on detail | **PARTIAL** | `getNumber(call.numberId)` from fixtures if id not in mock set |
| Activity timeline copy | **PARTIAL** | Some routing/AI/MCTB blocks are template/demo when DTO lacks those legs |
| Recording stored | **PASS (prod)** | `call.recording.saved` webhook → `recordingUrl` + `telnyxRecordingId` metadata |
| Recording playback | **PARTIAL** | Stream via `/api/phone/calls/:id/recording/stream` + URL refresh in `resolve-recording-url.ts`; prod on **`92d458de`** — retest after deploy if player still errors |
| Voicemail on detail | **PARTIAL** | Shows transcript text when DTO has `voicemail`; no dedicated voicemail inbox under Phone nav |
| AI / MCTB panels on Phone detail | **PARTIAL** | Renders when mapped on DTO; typical human Phone calls omit |

---

## 4. Overview & analytics

| Feature | Status | Evidence / notes |
|---------|--------|------------------|
| KPI strip (7d) | **PASS (code)** | `getOverviewMetrics` from DB |
| Recent calls | **PASS (code)** | `listCalls` limit 7 |
| Needs follow-up strip | **PASS (code)** | Filter on recent rows |
| Numbers panel | **PASS (code)** | `loadOwnedNumbers` |
| Power dialer teaser | **PASS (code)** | `listCampaigns` |
| Routing summary | **PASS (code)** | `WorkspaceProvider.routePolicy` loaded from `fetchRouting` |
| Analytics page | **PASS (code)** | `fetchPhoneAnalytics` — totals, trend, hourly, campaign stats from DB |
| Analytics accuracy vs Telnyx CDR | **UNTESTED** | Assumes `humanCall` disposition/status mapping in `map-call.ts` |

---

## 5. Dialer & contacts

| Feature | Status | Evidence / notes |
|---------|--------|------------------|
| Keypad + caller ID | **PASS (prod)** | Owned numbers from `NumbersProvider` |
| `?to=` deep link | **PASS (code)** | `initialTo` prop |
| Contact search | **PASS (code)** | `GET /api/contacts/search` |
| Blocked contact guard | **PARTIAL** | API returns `status`; dialer should block — verify UX |
| Recent outbound on dialer | **PASS (code)** | `fetchCalls` outbound |

---

## 6. Call handling (routing)

| Feature | Status | Evidence / notes |
|---------|--------|------------------|
| Load policy | **PASS (code)** | `GET /api/phone/routing` |
| Save policy | **PASS (code)** | `PATCH` + `PhoneRoutingEditor.saveRouting` |
| Runtime uses policy | **PASS (code)** | `decideInboundRoute` — ring browser vs voicemail vs external transfer |
| Ring group / sequential / AI-first options | **PARTIAL** | UI exposes rich options; inbound runtime primarily **ring_browser** vs voicemail vs external — not full multi-user ring group |
| Business hours | **PARTIAL** | `BusinessHours` component still uses **`BUSINESS` fixture**; server `isBusinessOpenNow` uses workspace settings — confirm editor persists same store |
| Voicemail greeting in editor | **PARTIAL** | Greeting sent on `saveRouting`; runtime `voicemail-runtime` uses boxes + Telnyx `record_start` |
| No-answer timeout → voicemail | **PASS (code)** | `inbound-agent-no-answer.ts` + `ringTimeoutAt` metadata |

---

## 7. Power dialer

| Feature | Status | Evidence / notes |
|---------|--------|------------------|
| Lists CRUD + CSV import | **PASS (code)** | APIs + UI |
| Campaigns CRUD | **PASS (code)** | APIs + UI |
| Session start / pause / end | **PASS (code)** | Session APIs |
| Dispositions + notes per attempt | **PASS (code)** | `savePowerAttemptOutcome` |
| Progressive dial via WebRTC | **PASS (code)** | Session tab calls `startCall` with `powerDialerAttemptId` |
| Compliance (DNC, timezone, consent) | **UNTESTED** | Eligibility logic in `power-dialer.ts` — needs dedicated smoke |
| **E2E prod campaign** | **UNTESTED** | Not certified in this pass |

---

## 8. Settings & readiness

| Feature | Status | Evidence / notes |
|---------|--------|------------------|
| Readiness banner | **PASS (code)** | `getPhoneReadiness` — Telnyx env, credential id, active lines |
| Phone settings API | **PASS (code)** | `defaultCallerIdNumber`, `recordCalls`, `transcribeVoicemail`, `noiseSuppression` |
| Settings UI in Phone nav | **NOT BUILT** | No dedicated `/app/phone/settings`; may live under global Settings |
| Call recording enable | **PASS (code)** | `recording-runtime` on answer when `recordCalls` |

---

## 9. What is *not* on Phone (by design or gap)

- Dedicated **voicemail inbox** route (MCTB has `/mctb/voicemail`; Phone uses call detail only).
- **Warm transfer** from active call bar.
- **SMS** from Phone (Conversations product).
- **Contacts** list/detail still largely **fixture-driven** outside search.
- **Global search** still indexes mock `CALLS` / `CONTACTS` in `global-search.tsx`.

---

## 10. Recommended verification checklist (manual)

1. **Deploy:** `commitSha` ≥ recording-stream fix; retest [Anthony Johnson call](https://transovo.ai/app/phone/calls/cmvf8iljt002kl30kaxntx9hj) playback.
2. **Inbound:** unanswered → voicemail leaves row + transcript (if STT enabled).
3. **Mute/hold** on a live call (30s each).
4. **Call handling:** set after-hours → voicemail, call after hours, confirm route.
5. **Power dialer:** import 2 numbers, one session, disposition saved and visible in analytics campaign row.
6. **Notes:** add note on call detail, hard refresh — **expect gap** until `CallNotes` loads `callNotes` from DTO.
7. **API smoke:** `PHONE_TEST_BASE_URL=https://transovo.ai node new-app/scripts/test-phone-greenfield.mjs` (with session cookie if auth required).

---

## 11. Summary for stakeholders

**Working for commercial Phone MVP:** inbound/outbound WebRTC, call list/detail, CDR persistence, recording capture, overview + analytics from DB, routing save/load, power dialer backend + UI wiring.

**Verify or finish before “everything works” claim:** recording player on current deploy SHA, mute/hold PSTN, power dialer E2E, call notes hydration, contact/number enrichment on detail, business hours UI ↔ server parity, external-forward env, voicemail no-answer path.

**Doc maintenance:** Update `NEW-APP-PHONE-WIRING-AUDIT.md` section 1 or replace with this file as the active audit.
