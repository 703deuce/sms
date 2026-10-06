# MCTB launch menu audit (deterministic, non–AI Recovery)

Audit of **Missed Call Text Back as it appears in the main menu today** (New UI / Opus, `NEXT_PUBLIC_NEWUI_STAGE2` not `0`), **excluding AI Recovery as a product path**. Based on nav source (`src/lib/products/mctb-nav.ts`), route wiring (`scripts/audit-mctb-opus-page-wiring.ts`), automated tests on branch `cursor/mctb-first-text-templates-f350`, and `docs/MCTB-PRODUCTION-BROWSER-CERTIFICATION.md` (older SHA; useful for last deep-click history).

---

## How to read this

| Status | Meaning |
|--------|---------|
| **Works** | Route loads, real APIs, save/load wired; static or prior browser cert supports it |
| **Partial** | Loads and mostly works, but missing UX, wrong link, entitlement gate, or not in analytics/list |
| **Not verified here** | Needs your production account + real phone/SMS (PSTN) |
| **Broken / drift** | Known fail or test/pipeline mismatch on current branch |

### Prerequisites for “everything in the menu” to feel right

- MCTB product active on the workspace
- New UI: default on (`isNewUiShellEnabled` + stage 2)
- Platform or workspace sender **messaging-ready** (A2P/TFV)
- Forwarding **verified** for live missed-call flow
- **Visual Voicemail** add-on for `/mctb/voicemail` (otherwise upgrade card)
- Deterministic path: **`MCTB_LEGACY_AI_SMS_REPLY=0`** (no AI SMS after first reply)

---

## Sidebar map (what you actually have)

### Top

| Nav item | Route | Connected UI | Data / save | Status |
|----------|--------|--------------|-------------|--------|
| **Overview** | `/mctb` | `overview-page.tsx` | SSR `loadMctbOverviewCore` + `/api/mctb/overview-enrichment`, setup via `fetchMctbSetup` | **Works** (read + pause recovery). **Partial:** setup health links still point at `/mctb/setup/*` (redirects to launch IA). Optional **AI Recovery** attention banner can still link to `/mctb/ai-recovery` if backend says `needs_attention` — ignore for deterministic launch |
| **Getting Started** | `/getting-started` | `MctbGettingStartedPage` when MCTB V1 primary | `/api/mctb/getting-started` | **Works** for MCTB readiness checklist |

### Activity

| Nav item | Route | Connected UI | Data / save | Status |
|----------|--------|--------------|-------------|--------|
| **Missed Calls** | `/mctb/missed-calls` | `missed-calls-page.tsx` | `GET /api/mctb/missed-calls`, exclusions → `POST /api/mctb/exclusions` | **Works** (list, filters, detail link, repeat-call badge). **Partial:** no **Handled / Needs follow-up** column (only on **detail**) |
| **Conversations** | `/mctb/conversations` | `conversations-page.tsx` | `kimi-inbox-adapter` + `product=mctb`, send/patch → SMS pipeline | **Works** for read threads. **Partial:** composer often **disabled** on platform sender unless **own-sender / manual two-way** entitled (`MCTB_PLATFORM_SENDER_MANUAL_REPLY_MESSAGE`) — by design for deterministic MCTB |
| **Voicemail** | `/mctb/voicemail` | `mctb-ia-pages` (messages + greeting tabs) or upgrade | `GET /api/phone/voicemail`, greeting via setup voicemail wiring | **Works** if **visual_voicemail** entitled. **Partial:** otherwise **upgrade only**, not broken |
| **Analytics** | `/mctb/analytics` | `analytics-page.tsx` | SSR + `GET /api/mctb/analytics?range=` | **Works** for missed / texts / replies / funnel. **Partial:** no **handled** KPI (persistence exists via `followUpStatus`, analytics lib doesn’t expose it). Old cert noted **React #418** once on load — re-check on your build |

### Configure

| Nav item | Route | Tabs / sections | Data / save | Status |
|----------|--------|-----------------|-------------|--------|
| **Missed-Call Recovery** | `/mctb/missed-call-recovery` | **General** (pause, cooldown, delay, usage), **Rules**, **Consent**, **Exclusions** | `GET/POST /api/mctb/setup`, exclusions API | **Works** (cert: pause, rules, consent mode, exclusions add/delete). **Partial:** consent tab links to **Consent log** (not in main nav) |
| **Text Back** | `/mctb/text-back` | Editor + **booking link** section | `POST /api/mctb/setup` (templates, info fields, hours, ack preview) | **Works** (deterministic templates + previews; script PASS). Link: `/mctb/text-back?section=booking` |
| **Notifications** | `/mctb/notifications` | Recipients + per-event email/SMS | `GET/POST /api/mctb/handoff` | **Works** for **email** + UI. **Works** for **owner SMS** when `businessReplySms` entitled (#609). **Partial:** **Urgent Reply Alerts** UI still sends you to **AI Recovery** for criteria copy (`criteriaEditHref: /mctb/ai-recovery`) — turn off urgent detection for pure deterministic. Old cert **FAIL** on add-recipient persistence — re-test on your workspace |
| **Phone & Forwarding** | `/mctb/phone` | Business line, forwarding, sender, **Test connection** dialog | `/api/mctb/setup`, `/api/mctb/onboarding`, live-test APIs | **Works** (cert: sender display, forwarding). **Not verified here:** real CFNA test from your phone |

### Shared (same shell)

| Nav item | Route | MCTB relevance | Status |
|----------|--------|----------------|--------|
| **Settings** | `/settings` | Workspace, business, messaging | **Works** (shared) |
| **Billing** | `/settings/billing` | MCTB SKUs | **Works** (shared) |
| **Help** | `/help` → redirects getting-started | — | **Works** |

Mobile bottom nav: Home, Missed, Chats, **Configure** → `/mctb/missed-call-recovery`.

---

## Not in main menu (still part of MCTB, non-AI)

| Route | Purpose | Status |
|-------|---------|--------|
| `/mctb/missed-calls/[id]` | Detail, thread, voicemail, **Mark handled** (#609) | **Works** (API + handoff action). List doesn’t show handled state |
| `/mctb/compliance/consent` | Consent log | **Works** (read/search); linked from Recovery → Consent |
| `/mctb/setup/*` | Legacy setup URLs | **Works** as **redirects** into launch IA (`setup-ia-redirects.ts`) |
| `/mctb/numbers` | Number inventory | Redirects to `/mctb/phone?open=manage` |
| `/onboarding/mctb` | Wizard | With New UI: **redirects to `/mctb`** — onboarding is **Setup guide** on Overview, not this route |
| `/f/mctb/:token` | Public request form | **Works** if token valid (public, no nav) |

**Explicitly out of scope for this audit (AI):** `/mctb/ai-recovery`, `/mctb/ai-lead-recovery` (redirect). Route exists; **not in launch nav**.

**Stray MCTB routes (not launch menu):** `/mctb/calendar`, `/mctb/appointments/*`, `/mctb/booking/*`, `/mctb/reminders` → redirect to Appointments product per pass-6 reconciliation.

---

## Deterministic runtime (menu doesn’t show this, but “everything works” includes it)

| Step | Status | Notes |
|------|--------|--------|
| Missed call → TeXML / consent | **Not verified in VM** | Frozen pipeline; `npm run verify:mctb-final-pipeline` **failed on this branch** (default opener assertion vs new first-text templates — **test drift**, not necessarily production TeXML) |
| First recovery SMS | **Works** (code + templates) | Config on **Text Back** + **Recovery** (timing) |
| Duplicate suppression | **Works** (preserved) | Don’t change; regression only |
| Caller replies → one ack | **Works** (contract tests PASS) | `MCTB_LEGACY_AI_SMS_REPLY=0` |
| Email / in-app notify | **Works** | Handoff + Brevo path |
| Owner SMS notify | **Works** when entitled | Not blocked by recovery; only SMS channel gated |
| Automation stops after ack | **Works** | `resolved` automation state |
| Business **Mark handled** | **Partial** | **Detail only**; not on list/analytics |
| Live PSTN + real SMS | **You must run** | Cloud agent cannot certify |

---

## Automated checks you can run locally

**Passed on branch `cursor/mctb-first-text-templates-f350` (VM):**

```bash
npx tsx scripts/audit-mctb-opus-page-wiring.ts
npx tsx scripts/test-mctb-nav-ia.ts
npx tsx scripts/test-mctb-setup-sections.ts
npx tsx scripts/test-mctb-pass-5-overview-analytics.ts
npx tsx scripts/test-mctb-pass-6-final-reconciliation.ts
npx tsx scripts/test-mctb-getting-started-readiness.ts
npx tsx scripts/test-mctb-getting-started-shell.ts
npx tsx scripts/test-mctb-deterministic-handoff-contract.ts
npx tsx scripts/test-mctb-deterministic-recovery-launch.ts
npx tsx scripts/test-mctb-caller-replied-inbound-path.ts
npx tsx scripts/test-mctb-setup-recovery.ts
npx tsx scripts/test-mctb-first-text-templates.ts
npx tsx scripts/test-mctb-caller-replied-email-delivery-contract.ts
```

**Failed or flaky in that VM run:**

- `npm run verify:mctb-final-pipeline` — assertion on default opener text vs new template rendering (**update verifier or accept as known drift**).
- `scripts/run-mctb-commercial-launch-guards.sh` — same template assertion.
- `scripts/test-mctb-simplified-launch.ts` — hits `server-only` via `launch-lead-recovery` import (script env issue).

**Full non-human matrix (long):**

```bash
bash scripts/run-mctb-consolidated-nonhuman-matrix.sh
```

**Production browser exercise (your login + URL):**

```bash
MCTB_PROD_CERT_BASE_URL=https://<your-app> \
MCTB_PROD_CERT_EMAIL=... \
npx tsx scripts/mctb-production-browser-cert-exercise-all.ts
```

Reference: `docs/MCTB-PRODUCTION-BROWSER-CERTIFICATION.md` (many **PASS** route loads; revisit **notifications recipient** and **analytics** rows).

---

## Manual runbook (what you run to say “completely works”)

Do this on **staging or production** with a test phone. Order matters.

1. **Configure (menu)**
   - **Phone & Forwarding:** business line saved, forwarding **Verified**, sender **Ready**, run **Test connection**.
   - **Missed-Call Recovery:** triggers on, not paused, cooldown/delay as you want; **Consent** press-1 or existing consent saved.
   - **Text Back:** strategy, information fields, callback expectation, during/after previews look right; save and hard-refresh.
   - **Notifications:** at least one recipient with **email**; enable **SMS** on “caller replied” if you want owner texts; send a test if available.

2. **Operational**
   - **Overview:** KPIs not skeleton forever; pause/resume works.
   - Place **one real missed call** (no answer → consent → first SMS).
   - **Missed Calls:** row appears, correct recovery state, open **detail**.
   - Reply from handset **once:** one ack SMS, no second bot message; you get **email** (and SMS if enabled).
   - **Conversations:** thread shows inbound + ack.
   - **Detail:** **Mark handled** → reload → shows handled.
   - Second call same ANI inside suppression window: **no duplicate first SMS**, repeat indicator if applicable.
   - **STOP** on consumer: no further recovery texts.

3. **Voicemail (if entitled)**
   - Leave VM; check **Voicemail** inbox + greeting tab; SMS reinforcement still aligned with Text Back.

4. **Analytics**
   - Range change loads; drilldowns to missed calls / conversations work.

5. **Consent log**
   - From Recovery → Consent → **View consent history**; events look sane.

---

## Honest “can I ship deterministic MCTB from the menu alone?”

**Yes, with caveats:**

- **Menu + configure surfaces** for deterministic MCTB are **largely connected and working**, with legacy `/mctb/setup/*` safely redirected.
- **Gaps for “complete operations” without AI:** handled state **only on detail**; **analytics doesn’t track handled**; **overview** still has optional AI Recovery attention wiring; **notifications urgent** path still references AI Recovery for criteria; **pipeline verify script** needs updating for new default opener text.
- **“Everything completely works” end-to-end** still requires **your** PSTN/SMS certification runbook above — no substitute in the repo for a real call and reply.

---

## Related docs

- Deterministic launch matrix: `docs/MCTB-DETERMINISTIC-RECOVERY-FINAL-LAUNCH-MATRIX.md`
- Browser cert log: `docs/MCTB-PRODUCTION-BROWSER-CERTIFICATION.md`
- Opus wiring inventory script: `scripts/audit-mctb-opus-page-wiring.ts`
