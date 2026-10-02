# MCTB — UI vs API testing (customer Save) + full coverage matrix

**Date:** 2026-10-02  
**Purpose:** Answer “is it only connected in the API, or tested like a customer clicking Save?” — and list **every major surface** with **API / browser / manual** coverage.

---

# Part 1 — UI vs API: what is actually proven?

## Two different kinds of “tested”

### 1. Backend / contract tests (most of the automated audit)

Scripts like `test-mctb-setup-recovery.ts`, `test-mctb-setup-consent.ts`, `test-mctb-setup-exclusions.ts`, `test-mctb-setup-links.ts`, `test-mctb-setup-phone-forwarding.ts`, `run-mctb-commercial-launch-guards.sh`, etc. call **`/api/mctb/setup`**, **`/api/mctb/handoff`**, **`/api/mctb/exclusions`**, and lib code **directly** (or via DB harness), **not** by driving the React pages.

**They prove:** if the payload the API expects is sent, it **persists** and **runtime reads it**.

**They do not prove:** the button on `/mctb/text-back` (or recovery hub) builds that payload, fires the POST, shows success, and reload shows the new value.

### 2. Customer-style UI tests (Playwright on a real app URL)

| Runner | What it does |
|--------|----------------|
| **`scripts/mctb-production-browser-cert.ts`** | Logs into **production** (or `MCTB_PROD_CERT_BASE_URL`) as a **cert workspace** (e.g. `ws_1` admin), **Playwright** clicks controls, waits for saves, compares **backend snapshot** (and sometimes reload). |
| **`scripts/mctb-production-browser-cert-continue.ts`** | Wider route list + phone copy, links save, notifications CRUD, voicemail setup, AI recovery, etc. |
| **`scripts/mctb-production-browser-cert-phase3b.ts`** + **`scripts/mctb-browser-cert/phase3b-*.ts`** | Deeper **notifications** on **`/mctb/notifications`**. |
| **`scripts/mctb-production-browser-cert-exercise-all.ts`** | Nav link exercise matrix (many rows are harness timeouts, not product). |

From **`docs/MCTB-E2E-AUDIT-HANDOFF-2026-10-01.md`** (documented full run on production cert workspace):

- **19/19** MCTB URLs load (HTTP 200, not login) in the **main** cert script.
- **27 interactive rows** in **`mctb-production-browser-cert.ts`** were **27/27 PASS** after harness fixes (consent, pause, exclusions CRUD, missed calls search/detail, etc.).
- That run used an **existing cert tenant**, not “brand-new signup on a blank workspace.”
- **Notifications add recipient + reload** was **not** in that “all green” main script; older docs show **FAIL** on `/mctb/setup/notifications`, while **phase 3b** reported **PASS** on **`/mctb/notifications`** (different URL).

**This chat’s audit work** ran **API/guard scripts**; it did **not** re-run Playwright production cert on your current deploy SHA.

---

## What the main UI cert actually exercises (Save → backend)

From **`mctb-production-browser-cert.ts`**, real UI + persistence checks include roughly:

| Area | Browser behavior | Backend check |
|------|------------------|---------------|
| **Consent** | `/mctb/setup/consent` — Press-1 ↔ existing + attestation, Save | `POST /api/mctb/setup`, effective config / TeXML mode |
| **Recovery pause** | `/mctb/missed-call-recovery?tab=general` — “1 hour” preset, resume | `recoveryPaused`, `pauseKind` |
| **Exclusions** | Recovery hub **exclusions** tab — add + delete | `POST/DELETE /api/mctb/exclusions` |
| **Text back** | `/mctb/setup/text-back` — platform template radio (when applicable) | setup snapshot |
| **Missed calls** | Search + open first row | UI navigation |
| **Analytics** | Route + light interaction | (hydration #418 noted on older prod SHA) |

**Mostly route-load only** in the main script (no full Save on every field):

- `/mctb/setup/phone`, full text-back message edit, voicemail greeting save, links, test, missed-call rules toggles, onboarding wizard steps, etc.

---

## What is NOT UI-certified as “full customer journey”

| Area | Status |
|------|--------|
| **Brand-new signup → modal wizard → trial activate → first real forwarded call** | **Manual** (PSTN/SMS); cloud agents cannot complete live Telnyx on your phone. |
| **Every launch settings page** (`/mctb/phone`, `/mctb/text-back`, `/mctb/notifications`, …) | **Partial**; deepest Save proofs are main cert + **continue** + **phase 3b**. |
| **Notifications recipients** (add + hard refresh) | **Mixed** — setup route historically **FAIL** in matrix; **`/mctb/notifications`** phase 3b **PASS** in docs — **re-run on current `commitSha`**. |
| **End-to-end “settings change → next missed call behaves differently”** | **Manual PSTN** + inspect scripts; not one automated UI test. |

---

## Direct answer

- **“Connected to the backend”** — strongly supported by **API/lib tests** for MCTB core config.
- **“Tested from the UI like a customer”** — **only for a subset**, via **Playwright on production** (cert workspace): **consent**, **pause**, **exclusions** are the strongest **Save → backend** proofs; **not** every screen or fresh signup.
- **Honest gap:** “I signed up today, saved every settings page, reloaded, forwarded a call, and saw the new behavior” still needs **production browser cert on current deploy** + **manual PSTN** on a **non-cert** workspace if you want launch confidence.

---

## Commands to verify on production yourself

**Main interactive cert (27 rows):**

```bash
MCTB_PROD_CERT_BASE_URL=https://<your-production-host> \
MCTB_PROD_CERT_EMAIL=<admin-on-cert-workspace> \
npx tsx scripts/mctb-production-browser-cert.ts
```

**Extended cert (more routes + notifications, links, phone copy, etc.):**

```bash
MCTB_PROD_CERT_BASE_URL=https://<your-production-host> \
MCTB_PROD_CERT_EMAIL=<admin> \
npx tsx scripts/mctb-production-browser-cert-continue.ts
```

**Notifications only:**

```bash
MCTB_PROD_CERT_BASE_URL=https://<your-production-host> \
MCTB_PROD_CERT_EMAIL=<admin> \
npx tsx scripts/mctb-production-browser-cert-continue.ts --only-notifications
```

**Phase 3b notifications (`/mctb/notifications`):**

```bash
MCTB_PROD_CERT_BASE_URL=https://<your-production-host> \
MCTB_PROD_CERT_EMAIL=<admin> \
npx tsx scripts/mctb-production-browser-cert-phase3b.ts
```

Check **`GET /api/health` → `commitSha`** matches what you deployed before trusting results.

---

# Part 2 — Coverage matrix (API vs browser vs manual)

## Legend

| Symbol | Meaning |
|--------|---------|
| **API** | Automated script exercises save/persist via API or lib (no Playwright page Save). |
| **Browser (route)** | Playwright loads route; no Save persistence proof. |
| **Browser (UI)** | Playwright interacts (click/type); may not assert backend. |
| **Browser (persist)** | Playwright Save + backend snapshot and/or reload proof. |
| **Manual** | Real phone, carrier forwarding, new signup, or human QA only. |

**Primary API scripts** (commercial guards unless noted):

- Consent/setup core: `test-mctb-setup-consent.ts`, `test-mctb-setup-sections.ts`, `test-mctb-existing-consent-attestation.ts`, `test-mctb-press1-consent-db.ts`
- Recovery/pause/triggers: `test-mctb-setup-recovery.ts`, `test-mctb-schedule-pause.ts`, `test-mctb-recovery-cooldown-eligibility.ts`, `test-mctb-recovery-max-messages-field.ts`
- Phone/forwarding: `test-mctb-setup-phone-forwarding.ts`, `test-mctb-setup-phone-validation.ts`, `test-mctb-live-test-forwarding-evidence.ts`, `test-mctb-onboarding-business-line-persist.ts`
- Exclusions: `test-mctb-setup-exclusions.ts`
- Links/booking URL: `test-mctb-setup-links.ts`
- Sender mode: `test-mctb-setup-sender-mode-persist.ts`
- Notifications/handoff (partial): `test-mctb-setup-notifications.ts` (model/helpers), `test-mctb-handoff-recipient-email-destination.ts`, `test-mctb-brevo-handoff-delivery-e2e.ts`, `test-mctb-urgent-handoff-guards.ts`
- Onboarding/lifecycle: `test-mctb-onboarding-wizard-flow.ts`, `test-mctb-onboarding-lifecycle-p0.ts`, `test-mctb-onboarding-entry-path.ts`, `test-mctb-trial-ingress-provision-contract.ts`
- Ingress/PSTN contract: `verify:mctb-final-pipeline`, `test-mctb-final-pipeline-contract.ts` (not UI)
- Tenant: `test-transovo-multi-tenant-isolation-fixture.ts`, `test-mctb-api-workspace-isolation.ts`

**Primary browser runners:**

- **Main:** `mctb-production-browser-cert.ts`
- **Continue:** `mctb-production-browser-cert-continue.ts`
- **Phase 3b:** `mctb-production-browser-cert-phase3b.ts`, `mctb-browser-cert/phase3b-notifications.ts`, `phase3b-state-changing.ts`

---

## A. Onboarding & first-run

| Surface / flow | API | Browser | Manual | Notes |
|----------------|-----|---------|--------|-------|
| Signup + MCTB bootstrap (`productIntent=voice`) | **API** — `workspace-bootstrap`, trial ingress contract | — | **Manual** for full signup UX | Bootstrap on voice signup path only. |
| Post-login entry `/mctb` + first-run modal | **API** — `test-mctb-first-run-wizard-policy.ts` | **Browser (route)** — `/onboarding/mctb` in main cert | **Manual** — dismiss/mandatory modal UX | Stage 2 redirects legacy onboarding to `/mctb`. |
| Wizard steps (business, consent, recovery, voicemail, notifications, connect, live test) | **API** — onboarding architecture, business-line persist, lifecycle P0 | **Browser (route)** — `/mctb/setup/start` in continue cert | **Manual** — full wizard click-through on **fresh workspace** | No single Playwright “new user wizard end-to-end” cert. |
| Trial activation gates (forwarding + live test) | **API** — `trial-gates.ts` tests via onboarding | — | **Manual** — CFNA on **your carrier** + real second phone | Transovo does not set carrier forwarding. |
| Activate trial / `trialActivatedAt` | **API** — lifecycle P0 | — | **Manual** | Gates block until forwarding evidence + live test. |

---

## B. Operational pages (not “settings save”)

| Route | API | Browser | Manual | Notes |
|-------|-----|---------|--------|-------|
| `/mctb` Overview | **API** — overview metrics tests in matrix | **Browser (route)** — main cert | — | KPIs from backend. |
| `/mctb/missed-calls` | List filters lib tests | **Browser (persist)** — search + detail (main); filters/pagination (continue) | — | |
| `/mctb/missed-calls/[id]` | Detail load scoped by workspace | **Browser (UI)** — open detail (main) | — | |
| `/mctb/conversations` | Messaging runtime tests (inbound path) | **Browser (UI)** — search, thread (continue) | — | Shared inbox engine. |
| `/mctb/voicemail` | Voicemail lifecycle hermetic tests | **Browser (route/UI)** — continue cert | — | |
| `/mctb/analytics` | `test-mctb-analytics-range.ts` | **Browser (route/UI)** — main cert | — | React #418 fixed in docs on chart labels; verify on deploy SHA. |
| `/getting-started` | Getting-started readiness scripts | **Browser (route)** — nav exercise (harness) | — | |

---

## C. Configuration — launch IA routes

| Route | What customers change | API | Browser | Manual |
|-------|----------------------|-----|---------|--------|
| `/mctb/missed-call-recovery` (hub) | Pause/resume, tabs | **API** — recovery, pause, schedule | **Browser (persist)** — pause 1h + resume (main); rules tab (route/phase3b) | — |
| `/mctb/missed-call-recovery?tab=consent` | Consent mode | **API** — setup-consent, attestation | **Browser (persist)** — same as setup consent (main) | — |
| `/mctb/missed-call-recovery?tab=exclusions` | Exclusion list | **API** — setup-exclusions | **Browser (persist)** — add/delete (main) | — |
| `/mctb/missed-call-recovery?tab=rules` | Missed-call triggers | **API** — setup-recovery / triggers in setup | **Browser (UI)** — phase3b state-changing (partial) | — |
| `/mctb/text-back` | Opener, delay, templates | **API** — setup-recovery, sender mode, platform templates | **Browser (route)** — launch route in continue; **persist** mainly via `/mctb/setup/text-back` | — |
| `/mctb/notifications` | Recipients, urgent, AI replies | **API** — handoff delivery tests | **Browser (persist)** — phase3b **PASS** in docs; continue tests both URLs | Re-verify recipient **reload** on current prod. |
| `/mctb/phone` | Business line, forwarding copy | **API** — phone-forwarding, phone-validation | **Browser (UI)** — continue (own-sender route) | **Manual** — carrier CFNA |
| `/mctb/ai-recovery` | AI recovery settings | **API** — ai-recovery entitlement gate | **Browser (UI)** — continue (may redirect) | Paid entitlement. |
| `/mctb/numbers` | Number inventory | Numbers API contracts | **Browser (route)** — continue | — |

---

## D. Configuration — `/mctb/setup/*` (canonical editors)

| Route | API | Browser (main cert) | Browser (continue / 3b) | Manual |
|-------|-----|---------------------|-------------------------|--------|
| `/mctb/setup` | setup-sections | **Route** | **Route** | — |
| `/mctb/setup/start` | wizard-flow | — | **Route** | Wizard E2E |
| `/mctb/setup/phone` | phone-forwarding, validation, telnyx-sync | **Route** | **UI** (copy buttons) | CFNA + live test |
| `/mctb/setup/missed-call-rules` | setup-recovery (triggers) | **Route** | **Route** | Save all toggles |
| `/mctb/setup/text-back` | setup-recovery, sender, templates | **Persist** (platform template radio) | **Route** | Full message edit + reload |
| `/mctb/setup/consent` | setup-consent, attestation | **Persist** (mode switch both ways) | **Route** | — |
| `/mctb/setup/recovery` | setup-recovery, cooldown, max messages | **Route** | **UI** (fields visible; Save not mutated) | Cooldown save via UI |
| `/mctb/setup/notifications` | handoff (config); recipient save via API in other tests | Urgent toggle **persist** in matrix docs | **Persist** — CRUD attempt (historical **FAIL** on recipient reload) | Use `/mctb/notifications` + phase3b |
| `/mctb/setup/voicemail` | voicemail lifecycle (lib) | **Route** | **UI** — continue voicemail setup | Greeting activate |
| `/mctb/setup/links` | setup-links | — | **Persist** — save link (continue) | — |
| `/mctb/setup/exclusions` | setup-exclusions | — (hub tested in main) | **Route** | — |
| `/mctb/setup/test` | live-test API, simplified-launch | **Route** | **Route** | **Manual** — real test call |

---

## E. Compliance & other

| Route | API | Browser | Manual |
|-------|-----|---------|--------|
| `/mctb/compliance/consent` | `test-mctb-consent-log.ts` | **Route** — continue (`testConsentLog`) | — |
| `/mctb/setup/consent` + consent prompt audio | consent-prompt routes in texml tests | — | **Manual** — hear prompt on PSTN |
| Public `/f/mctb/[token]` | token scoped APIs | — | **Manual** |

---

## F. Runtime / telephony (not “settings page”)

| Flow | API / simulation | Browser | Manual |
|------|------------------|---------|--------|
| TeXML `press_1` ingress | `verify:mctb-final-pipeline`, texml route tests | — | **Manual PSTN** |
| TeXML `existing_consent` ingress | same | — | **Manual PSTN** |
| SMS send after missed call | engine matrix, eligibility, usage idempotency | — | **Manual SMS** on phone |
| STOP / opt-out | messaging tests | — | **Manual** or scripted SMS |
| Worker dispatch (BullMQ) | `test-sms-worker-bullmq.ts` | — | Ops — worker SHA parity |

---

## G. Settings fields → test type (quick reference)

| Setting domain | Save API | API script coverage | Browser Save proof | Manual |
|----------------|----------|---------------------|-------------------|--------|
| Consent mode (`press_1` / `existing_consent`) | `POST /api/mctb/setup` | **Strong** | **Strong** (main cert) | PSTN audio path |
| Recovery pause / resume | `POST /api/mctb/setup` | **Strong** | **Strong** (recovery hub) | — |
| Missed-call trigger rules | `POST /api/mctb/setup` | **Strong** | **Weak** (route/rules tab) | — |
| Text-back template / delay | `POST /api/mctb/setup` | **Strong** | **Partial** (template radio) | — |
| Cooldown / max messages | `POST /api/mctb/setup` | **Strong** | **Weak** (continue observes Save only) | — |
| Exclusions | `/api/mctb/exclusions` | **Strong** | **Strong** (hub tab) | — |
| Booking links / default URL | setup + booking-links API | **Strong** (links script) | **Partial** (continue save) | — |
| Handoff / notifications / recipients | `POST /api/mctb/handoff` | **Partial** (delivery + email dest) | **Mixed** (setup FAIL history; `/mctb/notifications` 3b PASS) | — |
| Phone / business line / forwarding metadata | setup + onboarding | **Strong** | **Weak** (copy UI only) | **CFNA + live test** |
| Voicemail greeting | setup + consent-prompt/voicemail APIs | **Partial** (lifecycle lib) | **Weak** | Record/upload PSTN |
| AI Recovery | lead-recovery config + entitlement | **Strong** (gate) | **UI** only in continue | Entitlement / paid |
| Sender mode (platform vs own) | setup | **Strong** | **Partial** | Own-sender A2P **manual** |

---

## H. Definition of done (honest)

| Claim | Typical evidence |
|-------|------------------|
| API saves config correctly | Commercial guards + setup `test-mctb-setup-*` — **yes** for MCTB core |
| Customer clicked Save in browser and backend updated | **Main cert** — consent, pause, exclusions; **continue** — links, partial notifications; **not all routes** |
| Fresh signup → wizard → live call works | **Manual** + optional lifecycle P0 DB scripts |
| Every launch settings URL Save + reload | **Not fully certified** — run **continue** + **phase 3b** on **current production SHA** |
| Settings change affects next real call | **Manual PSTN/SMS** |

---

## Related docs in repo

- `docs/MCTB-E2E-AUDIT-HANDOFF-2026-10-01.md` — latest documented 27/27 main browser cert
- `docs/MCTB-PRODUCTION-BROWSER-CERTIFICATION.md` — full matrix markdown (includes notifications FAIL rows)
- `docs/MCTB-NEW-ACCOUNT-TO-LIVE-CALL-FLOW-2026-10-02.md` — signup → wizard → forwarding → live call
- `docs/MCTB-FULL-APP-AUDIT-2026-10-02.md` — backend + tenant audit
- `docs/certification/APPOINTMENTS-MCTB-SETTINGS-COVERAGE.md` — generated field-level map (`npx tsx scripts/generate-settings-coverage-proof.ts`)
