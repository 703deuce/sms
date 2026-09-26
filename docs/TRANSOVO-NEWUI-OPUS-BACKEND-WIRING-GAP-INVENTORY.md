# Opus (New UI Stage 2) — Backend wiring gap inventory

**Generated:** 2026-09-26  
**Scope:** Routes in `src/newui-transplant/mirror/MANIFEST.json` (26 routes) + shared Opus chrome.  
**Stage 2 gate:** `isNewUiStage2Enabled()` (see `src/lib/newui-transplant/stage2-enabled.ts`).

**How to read “not connected”:** decorative UI, client-only behavior, demo/sandbox copy, or no call to the production API that owns that behavior.

**Related:** `docs/TRANSOVO-NEWUI-PHASE-2-WIRING-EXCEPTIONS.md` (known exceptions from the wiring pass).

---

## Global chrome (every Opus page)

| Item | Status |
|------|--------|
| Top bar **Search** (+ ⌘K) | No search API / command palette |
| **Help** button | No action |
| **Notifications** bell + dot | No notification feed |
| **Avatar** | Display only (no account menu) |
| Sidebar **workspace switcher** | Button only; no workspace list |
| Sidebar badges (**Knowledge “3”**, **Inbox “4”**) | Hardcoded in `src/newui-transplant/lib/nav.ts`, not live counts |
| Sidebar **AI minutes** meter (1,284 / 2,000) | Static demo |
| Product switcher (if shown in shell) | Not part of transplant manifest; legacy shell may differ |

**Code refs:** `src/newui-transplant/components/app/topbar.tsx`, `src/newui-transplant/components/app/app-sidebar.tsx`, `src/newui-transplant/lib/nav.ts`

---

## AI Receptionist

### `/voice/overview` — mostly wired

- **Wired:** Server-loaded overview (`NewUiVoiceOverviewPage` + `VoiceOverviewSummaryResult`).
- **Not connected / weak:**
  - No client refresh control (SSR snapshot until navigation).

**Code:** `src/newui-transplant/connected/voice/overview-page.tsx`

---

### `/voice/calls` — partial

- **Wired:** List + KPI strip via `GET /api/voice/calls` (`limit=100`, `dateRange=7d` fixed on load).
- **Not connected:**
  - **Date range** in `CallsBrowser` does not refetch; filters already-loaded rows only.
  - **Pagination** UI is cosmetic (no server paging).
  - Outcome / “Needs attention” filters are client-only on that single fetch.

**Code:** `src/newui-transplant/connected/voice/calls-page.tsx`, `src/newui-transplant/components/voice/calls-browser.tsx`

---

### `/voice/calls/[id]` — mostly wired

- **Wired:** `GET /api/voice/calls/:id`; **Mark handled** → `PATCH /api/voice/calls/:id`.
- **Gaps:** Fields not mapped in `buildVoiceCallDetailWired` (e.g. recording URL, full transcript) may be absent in UI even if API returns them.

**Code:** `src/newui-transplant/connected/voice/call-detail-page.tsx`, `src/lib/newui-transplant/adapters/voice-call-detail.ts`

---

### `/voice/receptionist` — mostly display-only

- **Wired (read-only):** Name, voice label, publish-ish status, version label from `GET /api/voice/overview`.
- **Not connected:**
  - **Greeting** body (defaults in mirror unless `greeting` added to wired props).
  - **Capabilities** grid (six static cards with demo detail).
  - **Language** / **Speaking speed** rows (static).
  - Header **Continue setup** / **Open setup editor** both link to `/voice/receptionist` (no wizard/editor route).
  - After-hours greeting add-on sentence (static copy).

**Code:** `src/newui-transplant/connected/voice/receptionist-page.tsx`, `src/newui-transplant/mirror/routes/voice/receptionist/page.tsx`

---

### `/voice/knowledge` — partial

- **Wired:** Gaps, sources/crawl, save core fields (wizard), recrawl, upload, add FAQ, dismiss/resolve gaps, hours display from wizard.
- **Not connected / indirect:**
  - **Edit hours** → navigates to `/voice/setup`, not inline on Opus page.
  - FAQ **edit/delete** in list (add only).
  - Gap resolve UX uses `window.prompt()` (still hits API).

**Code:** `src/newui-transplant/connected/voice/knowledge-page.tsx`

---

### `/voice/call-handling` — partial

- **Wired:** Appointment receptionist wizard load/save, many switches, `GET /api/voice/call-handling/recent-transfers`, transfer list from wizard state.
- **Not connected:**
  - **Add target** (no transfer CRUD on this page; wizard only on Save).
  - **Edit** on-call rotation.
  - **+ Add** emergency keyword.
  - **Retention → Change** (recording retention).
  - **Text summary to teammate:** shown from state but `onSwitchChange` in `call-handling-page.tsx` does **not** handle `textSummary` (toggle won’t persist).
  - Decorative copy (e.g. “142 calls blocked this month”).

**Code:** `src/newui-transplant/connected/voice/call-handling-page.tsx`, `src/newui-transplant/mirror/routes/voice/call-handling/page.tsx`

---

### `/voice/analytics` — wired (custom page, not mirror)

- **Wired:** `GET /api/voice/analytics?days=…` in `NewUiVoiceAnalyticsPage` (not `TransplantVoiceAnalyticsPage`).
- **Not connected:**
  - No daily **“Booked”** series on chart (API has aggregate `appointmentsBooked`, not daily booked series).
  - Mirror-only blocks (usage meters, latency/p95) not present on connected page.

**Code:** `src/newui-transplant/connected/voice/analytics-page.tsx`, `src/newui-transplant/mirror/routes/voice/analytics/page.tsx` (sandbox mirror unused in prod path)

---

### `/voice/numbers` — partial

- **Wired:** `GET /api/mctb/numbers`, refresh, table mapping.
- **Not connected:**
  - Row click / deep link to number detail.
  - **Add number** goes to `/voice/numbers/buy` (separate legacy flow).

**Code:** `src/newui-transplant/connected/voice/numbers-page.tsx`

---

## Missed Call Text Back

### `/mctb` — mostly wired

- **Wired:** `NewUiMctbOverviewPage` + server `MctbOverviewPayload`.
- **Not connected / misleading:**
  - When `status === "active"`, green **“Nothing needs attention…”** banner is fixed copy (not from attention engine).

**Code:** `src/newui-transplant/connected/mctb/overview-page.tsx`

---

### `/mctb/missed-calls` — partial

- **Wired:** `GET /api/mctb/missed-calls`, stats from API summary.
- **Not connected:**
  - Stat **deltas** on KPI strip (hardcoded in mirror).
  - **Date** filter UI not applied in `MissedCallsBrowser` filter logic.
  - **Pagination** (“Page 1 of 1”) fake.
  - Row menu **Add to exclusions** — no handler.
  - Recovery/trigger filters client-only on loaded rows (no server query params).

**Code:** `src/newui-transplant/connected/mctb/missed-calls-page.tsx`, `src/newui-transplant/components/mctb/missed-calls-browser.tsx`

---

### `/mctb/missed-calls/[id]` — partial

- **Wired:** `GET /api/mctb/missed-calls/:id`, lifecycle/messages/consent rows from adapter.
- **Not connected:**
  - **Text-back sender** row uses sandbox `BUSINESS.sender` in detail view, not API sender.
  - Voicemail **`<audio>`** has no `src` (no playback URL).
  - Link activity / request form are read-only text.

**Code:** `src/newui-transplant/connected/mctb/missed-call-detail-page.tsx`, `src/newui-transplant/mirror/routes/mctb/missed-calls/[id]/detail-view.tsx`

---

### `/mctb/conversations` — partial

- **Wired:** Inbox list + thread via `kimi-inbox-adapter`; send via `sendNewMessage`.
- **Not connected:**
  - Only ~25 conversations loaded (no paging).
  - Filters **Mine**, **Unassigned**, **Closed**, **Spam** — client-only; Closed/Spam always empty.
  - **Mark read** / **Close** bulk actions — no API.
  - Context panel **Consent** (“Pressed 1”) and **Assigned to** (“Unassigned”) — hardcoded.
  - **Missed call** context: `missedCalls` always `[]` (never fetched).
  - Composer footer (“has not opted out”) static; no eligibility recheck API.
  - After send, optimistic local bubble only (no thread reload).

**Code:** `src/newui-transplant/connected/mctb/conversations-page.tsx`, `src/newui-transplant/components/mctb/inbox.tsx`

---

### `/mctb/ai-recovery` — mostly unwired

- **Wired (partial):** `GET /api/mctb/ai-recovery/context`; `POST /api/mctb/ai-recovery/settings` on Save but payload is **hardcoded** (does not read live switch/input state).
- **Not connected:**
  - Master **AI Recovery** switch (`defaultChecked`, uncontrolled).
  - **Information to collect** switches (including **Best time to call back** / API `CALLBACK_TIME`).
  - **Booking link** toggle, URL, label fields.
  - Save does not pass `bookingLinkEnabled` / `bookingLinkId` from UI.

**Code:** `src/newui-transplant/connected/mctb/ai-recovery-page.tsx`, `src/newui-transplant/mirror/routes/mctb/ai-recovery/page.tsx`, `src/app/api/mctb/ai-recovery/settings/route.ts`

---

### `/mctb/voicemail` — partial

- **Wired:** List metadata, summary, transcript text from `GET /api/phone/voicemail`.
- **Not connected:**
  - **Audio player** — no recording URL on `<audio>`.
  - **Open conversation** — generic `/mctb/conversations`, not caller-specific thread.

**Code:** `src/newui-transplant/connected/mctb/voicemail-page.tsx`, `src/newui-transplant/components/mctb/voicemail-browser.tsx`

---

### `/mctb/analytics` — mostly wired

- **Wired:** `loadMctbAnalytics` / `GET /api/mctb/analytics?range=…`, charts, suppression drilldown links.
- **Minor:** Suppression reason labels may show raw enum strings.

**Code:** `src/newui-transplant/connected/mctb/analytics-page.tsx`

---

### `/mctb/setup` (overview) — mostly demo

- **Wired (partial):** Status strip — `businessLine`, `sender`, `recoveryActive` from setup API.
- **Not connected:**
  - **Forwarding “Verified”**, **Last test** date — static.
  - **Pause recovery** button — no API.
  - **Needs attention** accordion — static demo content.
  - **Call flow** + **Operations** summary rows — static `CALL_FLOW` / `OPERATIONS`.
  - **Recent system activity** — static `ACTIVITY` timeline.

**Code:** `src/newui-transplant/connected/mctb/setup-pages.tsx` (`NewUiMctbSetupOverviewPage`), `src/newui-transplant/mirror/routes/mctb/setup/page.tsx`

---

### `/mctb/setup/phone` — partial

- **Wired:** Business line + forwarding destination display; **Save** via `useMctbSetupApi` / `saveMctbSetup`.
- **Not connected:**
  - **Carrier** and **ring before forwarding** selects.
  - **Forwarding instructions** and `*71 …` code block (demo, not canonical carrier guide dataset).
  - **Verification** panel (always verified + fake test metadata).
  - **I've turned it on — verify again** button.
  - **Text-back sender** panel (sandbox sender, fake registration/throughput).
  - “Verizon Business” subtitle on business line.

**Code:** `src/newui-transplant/mirror/routes/mctb/setup/phone/page.tsx`, `NewUiMctbSetupPhonePage`

---

### `/mctb/setup/consent` — mostly wired

- **Wired:** `GET /api/mctb/setup`, `GET /api/mctb/consent-prompt`, save via `saveMctbSetup` (mode + attestation).
- **Not connected:**
  - Press-1 **disclosure** is preview-only on this page (not an inline editor tied to prompt publish API).

**Code:** `src/newui-transplant/components/mctb/consent-editor.tsx`

---

### `/mctb/setup/text-back` — mostly wired

- **Wired:** Load/save opener via `/api/mctb/setup` + `saveMctbSetup`.
- **Not connected:**
  - `{booking_link}` preview depends on runtime link config only.
  - Segment count is local length/160, not full GSM-7/Unicode segment engine.

**Code:** `src/newui-transplant/components/mctb/text-back-editor.tsx`

---

### `/mctb/setup/recovery` — partial

- **Wired:** Missed-call triggers (API), delay/cooldown/max messages, pause presets, save.
- **Not connected:**
  - **Blocked caller ID** trigger — UI only (`onChange: () => {}`); no runtime trigger in setup API.

**Code:** `src/newui-transplant/connected/mctb/setup-pages.tsx` (`NewUiMctbSetupRecoveryPage`)

---

### `/mctb/setup/voicemail` — partial

- **Wired:** TTS greeting text, activate, send-after-voicemail, transcription → `/api/phone/voicemail` + setup hooks.
- **Not connected:**
  - **ElevenLabs / Record / Upload** source tiles.
  - **Preview** play on greeting script.

**Code:** `src/newui-transplant/mirror/routes/mctb/setup/voicemail/page.tsx`, `useMctbVoicemailWiring`

---

### `/mctb/setup/notifications` — partial

- **Wired:** Add recipient, event matrix email/SMS → `POST /api/mctb/handoff`.
- **Not connected:**
  - Recipient **Edit (⋯)** menu.
  - **Forwarding stopped working** event row — no `MctbHandoffEventType`; toggles don’t persist.

**Code:** `src/newui-transplant/connected/mctb/setup-pages.tsx`, `OPUS_EVENT_MAP` in same file

---

### `/mctb/setup/exclusions` — wired

- **Wired:** List/add/delete via `mctb-setup-client` exclusion APIs.

**Code:** `src/newui-transplant/components/mctb/exclusions-table.tsx`

---

### `/mctb/setup/links` — partial

- **Wired:** `defaultLinkUrl`, request form enable/URL, copy — from setup API (`useMctbLinksWiring`).
- **Not connected:**
  - **Add link** button.
  - Per-link **click counts**.
  - No inline editor for `defaultLinkUrl` (hook has `setDefaultLinkUrl` but UI is display-only).

**Code:** `src/newui-transplant/mirror/routes/mctb/setup/links/page.tsx`, `useMctbLinksWiring`

---

### `/mctb/setup/test` — mostly wired

- **Wired:** `GET /api/mctb/setup-test`, `GET/POST /api/mctb/live-test`, checklist from real status.

**Code:** `src/newui-transplant/connected/mctb/setup-pages.tsx` (`NewUiMctbSetupTestPage`), `useMctbTestWiring`

---

## Shared / manifest routes

### `/` (manifest)

- Redirects to `/voice/overview` — not a standalone Opus page.

**Code:** `src/newui-transplant/mirror/routes/page.tsx`

---

### `/integrations`, `/settings/*`, `/settings/billing`

- Linked from Opus nav; **not** Opus mirror pages — wiring is whatever legacy routes provide.

---

## Summary — wiring strength by area

| Area | Rough wiring |
|------|----------------|
| **Strong** | MCTB exclusions, text-back, consent, test, analytics; voice overview; call detail (core); knowledge (heavy); voice analytics KPIs/charts |
| **Weak / demo-heavy** | MCTB setup overview, MCTB setup phone (forwarding UX), AI Recovery, MCTB inbox (filters/context/bulk), Receptionist capabilities |
| **No API today (by design / exceptions doc)** | Multi-link CMS + click analytics, blocked-caller trigger, forwarding-stopped notification event, call-handling Add/Edit/keyword/retention buttons, ElevenLabs greeting sources on setup |

---

## Manifest route list (26)

From `src/newui-transplant/mirror/MANIFEST.json`:

1. `/`
2. `/mctb`
3. `/mctb/ai-recovery`
4. `/mctb/analytics`
5. `/mctb/conversations`
6. `/mctb/missed-calls`
7. `/mctb/missed-calls/[id]`
8. `/mctb/setup`
9. `/mctb/setup/consent`
10. `/mctb/setup/exclusions`
11. `/mctb/setup/links`
12. `/mctb/setup/notifications`
13. `/mctb/setup/phone`
14. `/mctb/setup/recovery`
15. `/mctb/setup/test`
16. `/mctb/setup/text-back`
17. `/mctb/setup/voicemail`
18. `/mctb/voicemail`
19. `/voice/analytics`
20. `/voice/call-handling`
21. `/voice/calls`
22. `/voice/calls/[id]`
23. `/voice/knowledge`
24. `/voice/numbers`
25. `/voice/overview`
26. `/voice/receptionist`

---

## Cross-reference: Phase 2 exceptions doc

See `docs/TRANSOVO-NEWUI-PHASE-2-WIRING-EXCEPTIONS.md` for the original exception table (call-handling CRUD, blocked caller ID, notifications rows, links CMS, voicemail sources, analytics booked series, etc.).
