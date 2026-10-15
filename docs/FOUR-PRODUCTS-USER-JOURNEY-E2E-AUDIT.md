# Four products — start-to-finish user journey audit

**Products:** Missed Call Text Back (MCTB) · Appointment Reminders (Microsoft 365 focus) · Campaigns (Mass Texting) · Reviews (reputation / review requests)  
**Environment:** Production UI smoke `https://transovo.ai` (2026-10-15) + repository/runtime audit  
**Machine JSON:** `/opt/cursor/artifacts/four-products-route-audit.json`  
**Re-run route smoke:** `UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/audit-three-products-production-routes.ts`  
**Related:** `docs/THREE-PRODUCTS-PAGE-CONNECTIVITY-AUDIT.md` (page wiring detail), `docs/BUSINESS-MESSAGING-FUNCTIONAL-AUDIT.md` (send pipelines)

---

## How to read verdicts

| Verdict | Meaning |
|---------|---------|
| **PASS (UI)** | Logged-in user can open the step; no error shell on screen. |
| **PASS (API)** | Backend for that step returns 2xx on the cert browser account (or unit/matrix tests pass). |
| **PASS (runtime)** | Code path exists through queue/worker/provider; **live SMS/voice proved on your tenant** (not fully done in this cloud pass). |
| **FAIL** | Step breaks in production smoke or known API 500 on cert account. |
| **BLOCKED** | Requires human action (PSTN call, M365 OAuth on your calendar, entitlement purchase, A2P approval, worker down). |
| **N/A** | Out of scope for this audit (e.g. Google Calendar until you connect it). |

**Platform sender / templates:** You asked to treat templates as centrally controlled for now. This audit does **not** block on template unification; it notes where UI still exposes per-product template surfaces.

**Console noise (all routes):** `A bad HTTP response code (404) was received when fetching the script` — likely a non-critical asset; not treated as product failure unless paired with API 500 below.

---

## Executive summary (2026-10-15)

| Product | End-to-end “can a real customer finish?” | Prod page smoke | Known prod breaks (cert account) | Live PSTN/SMS proved here |
|---------|----------------------------------------|-----------------|----------------------------------|---------------------------|
| **MCTB** | **Likely yes** when forwarding + sender + consent configured | **All checked routes LOAD_OK** | None in route smoke | **No** — needs your phone + conditional forwarding |
| **Appointment Reminders (M365)** | **Partial** — calendar/appointments/log work; **sequence editor & settings panel broken on prod** | 10/14 AR routes OK | **`/api/appointment-reminders/reminders/workspace` → 500**; AI Rescheduler operations **500** | **No** — needs M365-connected workspace + future appointment with phone |
| **Campaigns** | **Likely yes** when `mass_texting` + A2P + credits + worker | **All list/compose routes OK** except **`/templates` API 500** | Unified templates API fails on load | **No** — needs entitled workspace + launch on test list |
| **Reviews** | **Mostly yes** for overview, requests, campaigns, QR posters | **All routes LOAD_OK** except **`/reviews/contacts` API 500** | Reputation contacts list API **500** on cert tenant | **No** — needs review_campaigns + live send / drip job |

**Automated repo checks (this pass):** `npm run test:mctb-final-pipeline-contract` **PASS** · `scripts/test-reviews-full-integration-matrix.ts` **PASS** · `scripts/test-ar-ui-api-wiring.ts` **PASS**

---

# 1. Missed Call Text Back — user journey

**Mental model:** Configure → forward business line → activate → missed call → consent path → recovery SMS → optional AI reply in inbox.

### 1.1 Setup & activation

| Step | What the user does | Canonical UI | Backend | Verdict |
|------|-------------------|--------------|---------|---------|
| 1 | Open product | `/mctb` (Activity) | Overview loaders | **PASS (UI)** |
| 2 | Connect business line & carrier forwarding | `/mctb/phone` | `/api/mctb/setup`, forwarding verify, live test | **PASS (UI)** |
| 3 | Choose what counts as missed | `/mctb/missed-call-recovery` (rules) | Same setup API | **PASS (UI)** |
| 4 | Choose consent mode | Recovery / consent surfaces | `press_1` vs `existing_consent` in setup | **PASS (API)** — both modes preserved in runtime |
| 5 | Edit recovery opener (not compliance text in press-1) | `/mctb/text-back` | Setup templates | **PASS (UI)** |
| 6 | Recovery cooldown / pause | Recovery rules | Recovery controls in setup | **PASS (UI)** |
| 7 | Finish / activate | Onboarding `/onboarding/mctb` or phone verify | Setup readiness | **BLOCKED** — not re-smoked; depends on verify evidence |
| 8 | Optional AI inbound SMS | `/mctb/ai-recovery` | `/api/mctb/ai-recovery/*` | **PASS (UI)** |

### 1.2 Runtime call flow (frozen TeXML — `mctb_texml_final_v1`)

| Step | `press_1` | `existing_consent` | Verdict |
|------|-----------|-------------------|---------|
| Call hits forwarded business line | Ingress matches workspace | Same | **PASS (runtime code)** — `docs/MCTB_FINAL_PRODUCTION_PIPELINE.md` |
| Voice path | Play consent → Gather DTMF 1 | Play voicemail greeting → hangup on missed | **PASS (contract test)** |
| SMS | System confirmation + opener (domain order) | Auto SMS on `texml-status` after missed | **PASS (runtime code)** |
| Inbox | `/mctb/conversations`, `/mctb/missed-calls` | Same | **PASS (UI)** |

**Not proven in cloud VM:** Real PSTN call, DTMF 1, delivery to handset, A2P edge cases for brand-new workspace.

**Human cert:** `docs/MCTB-AI-LEAD-RECOVERY-LIVE-MANUAL-TEST-RUNBOOK.md`, `docs/V1-PRODUCTION-CERTIFICATION.md` (MCTB section).

---

# 2. Appointment Reminders (Microsoft 365) — user journey

**Mental model:** Connect M365 calendar → appointments sync with phone on event → reminder sequences fire on schedule → customer SMS → responses in AR inbox.

### 2.1 Connect & operate

| Step | What the user does | UI | Backend | Verdict |
|------|-------------------|-----|---------|---------|
| 1 | Connect calendar | `/appointment-reminders/setup/connect`, `/appointment-reminders/calendars` | OAuth + `/api/integrations/calendars` | **PASS (UI)** |
| 2 | See agenda / events | `/appointment-reminders` | Calendar events APIs | **PASS (UI)** |
| 3 | List appointments | `/appointment-reminders/appointments` | Appointments API | **PASS (UI)** |
| 4 | See reminder send log | `/appointment-reminders/reminders` | Reminder log APIs | **PASS (UI)** |
| 5 | Edit reminder **sequences** / timing | `/appointment-reminders/reminders/sequences` | **`GET /api/appointment-reminders/reminders/workspace`** | **FAIL** — workspace API **500** on prod cert account |
| 6 | Settings (plan, scheduling) | `/appointment-reminders/settings` | Same workspace API + test preview endpoints | **FAIL** — same **500** family |
| 7 | Template library page | `/appointment-reminders/reminders/templates` | Workspace + test previews | **FAIL** — same **500** |
| 8 | Customer SMS replies | `/appointment-reminders/responses` | Responses APIs | **PASS (UI)** |
| 9 | AI Rescheduler | `/appointment-reminders/ai-rescheduler` | **`/api/appointment-reminders/ai-rescheduler/operations`** | **FAIL** — **500** + error UI |
| 10 | Analytics | `/appointment-reminders/analytics` | AR analytics | **PASS (UI)** |

### 2.2 M365 → SMS dispatch (code path)

| Step | Behavior | Verdict |
|------|----------|---------|
| Calendar sync imports events with phone | Microsoft Graph / integration layer | **PASS (runtime code)** — not re-certified on your tenant here |
| Reminder discovery schedules jobs | `reminder-discovery.ts`, `appointment_reminders` queue | **PASS (runtime code)** |
| Send customer SMS | `send-customer-sms-job`, platform sender policy | **PASS (runtime code)** |
| User edits sequence in UI | Depends on `loadArReminderWorkspacePanel` | **FAIL on prod** until workspace API fixed |

**Implication for “365 works”:** Operational calendar + log surfaces look wired; **configuring/editing sequences from the UI is broken on production** for the automated cert workspace until `reminders/workspace` stops returning 500. Reminders may still fire for workspaces that were configured earlier if DB state is valid — that requires a **golden-tenant live SMS** run (`docs/AR-LAUNCH-READINESS-NOW.md`).

---

# 3. Campaigns (Mass Texting) — user journey

**Mental model:** Pick list/segment → compose broadcast → review audience & credits → launch → worker sends → see results.

### 3.1 Broadcast flow

| Step | What the user does | UI | Backend | Verdict |
|------|-------------------|-----|---------|---------|
| 1 | Open campaigns | `/campaigns` | `GET /api/mass-texting/campaigns` | **PASS (UI)** |
| 2 | Filter drafts / scheduled / completed | `/campaigns/drafts`, etc. | Same API, filtered | **PASS (UI)** |
| 3 | Create campaign | `/campaigns/new` | Draft save `POST/PATCH` mass-texting campaigns | **PASS (UI)** |
| 4 | Attach audience (list/segment) | Compose step | Audience resolution in draft | **PASS (API)** — real contacts; suppressions in review math |
| 5 | Pre-send review | `/campaigns/new/review` | `launch-review` → `buildPreSendReview` | **PASS (UI)** — honest `canSend` / `blockReason` |
| 6 | Launch (now or scheduled) | Queue / launch actions | `launchCampaignWithAudit` | **PASS (runtime code)** — enrolls recipients |
| 7 | Delivery | Worker | `campaign-processor` → Telnyx SMS | **BLOCKED** without `mass_texting`, A2P, credits, **worker running** |
| 8 | Results | `/campaigns/[id]` | Stats/recipients APIs | **Not smoke-tested** (needs campaign id) |
| 9 | Templates tab | `/templates` | **`GET /api/templates/unified?product=all`** | **FAIL** — **500** on prod cert account (page shell may load) |
| 10 | SMS analytics | `/sms/analytics` | Metrics APIs | **PASS (UI)** |

### 3.2 Gates (why “it didn’t send”)

1. **`mass_texting` entitlement** — APIs 403 without feature (`requireMassTextingWorkspace`).
2. **A2P / marketing registration** — `assertMassTextMarketingSendAllowed` at launch.
3. **Credits / segments** — reserved at launch.
4. **Workers** — UI launch without `campaign-processor` → stuck sending.
5. **Recurring broadcasts** — blocked unless `MASS_TEXT_RECURRING_PRODUCTION_ENABLED`.

**Separate system:** Playbook / sequence campaigns via `POST /api/campaigns` (not the broadcast launch path). Real, but different UX from “Create → Review → Launch.”

---

# 4. Reviews — user journey

**Mental model:** Import or select contacts → send review requests (manual or campaign) → drip by daily limit → track requests / insights → optional QR posters.

### 4.1 Requests & campaigns

| Step | What the user does | UI | Backend | Verdict |
|------|-------------------|-----|---------|---------|
| 1 | Overview | `/reviews/overview` | Reputation loaders (maps visibility fixed Oct 2026) | **PASS (UI)** |
| 2 | Manual / bulk requests | `/reviews/requests` | Review send APIs, `dispatchReviewRequestSms` | **PASS (UI)** — matrix tests PASS |
| 3 | Review **campaigns** (drip) | `/reviews/campaigns` | `review_request_campaigns`, `campaign-processor`, `daily_send_limit` in `sequence-runner.ts` | **PASS (UI)** — throttle is in code |
| 4 | Upload list / contacts | `/reviews/contacts` | **`GET /api/reputation/contacts?businessId=…`** | **FAIL** — **500** on prod cert account |
| 5 | Insights / alerts | `/reviews/insights`, `/reviews/alerts` | Reputation DB | **PASS (UI)** |
| 6 | QR poster (Google) | `/reviews/qr-campaigns/new/review` | QR campaign CRUD | **PASS (UI)** — routes fixed in `29158d129` |
| 7 | Pay & Review QR | `/reviews/qr-campaigns/new/payment` | Payment QR editor | **PASS (UI)** |
| 8 | Settings | `/reviews/settings` | Reputation settings | **PASS (UI)** |

### 4.2 Platform sender & UX caveats

- Review SMS can use **platform sender** when `reputation_settings.settings_json.senderMode` is `PLATFORM`; UI may still show generic “text-back sender” callouts that do not reflect platform mode (`MessagingSetupCallout` is largely static).
- **Templates:** Review templates are separate from campaign templates today; unified catalog is intended future work — does not block send if campaign/request APIs succeed.

### 4.3 Drip / trickle behavior (campaigns)

Review campaigns honor **`daily_send_limit`** when enqueueing sends (`campaign-processor.ts`, `sequence-runner.ts`). User can upload a large list but outbound rate is capped per campaign settings — **wired in code**, not live-proved to 100 numbers on cert tenant.

---

# 5. Production smoke matrix (four products)

| Product | Path | Verdict (2026-10-15) |
|---------|------|----------------------|
| MCTB | All routes in audit script (13) | **LOAD_OK** |
| AR | `/appointment-reminders/reminders/sequences` | **API_FAIL** |
| AR | `/appointment-reminders/settings` | **API_FAIL** |
| AR | `/appointment-reminders/reminders/templates` | **API_FAIL** |
| AR | `/appointment-reminders/ai-rescheduler` | **ERROR_UI** |
| AR | Other AR routes in script | **LOAD_OK** |
| Campaigns | `/templates` | **API_FAIL** |
| Campaigns | Other campaign routes in script | **LOAD_OK** |
| Reviews | `/reviews/contacts` | **API_FAIL** |
| Reviews | Other review routes in script | **LOAD_OK** |

Full per-route detail: `four-products-route-audit.json`.

---

# 6. What actually works today (plain language)

1. **MCTB:** Pages and setup APIs load on production; voice/SMS pipeline matches the certified TeXML contract in code. A customer **can** complete setup in the app if forwarding verification and sender readiness succeed; **you** still need a real missed call to prove press-1 or auto-text on your line.

2. **Appointment Reminders:** Connecting calendars and viewing appointments/reminder **history** works in prod smoke. **Editing sequences, settings scheduling panel, and template previews are broken** on the cert account because the workspace panel API returns 500. M365 reminder **sends** are implemented in jobs but need a live test on a connected calendar with a phone on the appointment.

3. **Campaigns:** Creating drafts, opening review, and navigating status tabs works. **Launching** is a real pipeline but needs entitlement, compliance, credits, and workers. The **Templates** hub fails its unified API on prod (500) — broadcast compose does not depend on that page alone.

4. **Reviews:** Overview, requests, campaigns, QR flows load. **Contact list/import page fails API** on cert tenant (500). Campaign drip limits exist in backend; manual/campaign send paths pass integration matrix tests in repo.

---

# 7. Recommended fix order (engineering)

1. **AR:** Root-cause **`loadArReminderWorkspacePanel`** / `GET /api/appointment-reminders/reminders/workspace` 500 on production (unblocks Sequences, Settings, Templates). Then **AI Rescheduler operations** 500.
2. **Reviews:** Root-cause **`/api/reputation/contacts`** 500 (Supabase `review_request_contacts` / service client / cert `businessId`).
3. **Campaigns:** Root-cause **`loadUnifiedTemplates`** / `GET /api/templates/unified` 500.
4. **UX (non-blocking):** Align Reviews sender callouts with platform sender; default PLATFORM where product policy requires.

---

# 8. Human certification checklist (your side)

| Product | Minimum live proof |
|---------|-------------------|
| MCTB | Forwarding verified → unanswered call → press-1 **or** voicemail path → recovery SMS received |
| AR (M365) | Connect M365 → create/edit appointment with mobile → receive reminder SMS before start |
| Campaigns | Entitled workspace → small test list (5–10) → review → launch → delivered + stats on campaign detail |
| Reviews | Import or pick contacts → manual send or campaign with low daily cap → delivery + opt-out honored |

---

*Audit assembled 2026-10-15. Re-run route smoke after API fixes; update §5 matrix when verdicts change.*
