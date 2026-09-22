# MCTB Setup — Screen-by-Screen UI Inventory

**Scope:** Missed Call Text Back **setup** (not Voice V3 wizard). Documents **what is on each screen** as implemented in the repo — not a connectivity or readiness audit.

**Routes:** `/mctb/setup/*`, first-time flow `/onboarding/mctb` (often entered via `/mctb/setup/start`).

**Source (evidence):** `src/components/mctb/setup/*`, `src/components/mctb/onboarding-wizard.tsx`, `src/components/mctb/wizard/*`, `src/lib/mctb/routes.ts`.

---

## Shared chrome (all post-setup setup pages)

- **MCTB app shell** with product nav (Overview, Missed Calls, Conversations, Voicemail, Analytics, Setup, etc.).
- **Setup local nav** (`MctbSetupLocalNav`) — 11 links:
  1. Overview (`/mctb/setup`)
  2. Phone & Forwarding
  3. Missed-call rules
  4. Text Back
  5. Links & request form
  6. Consent
  7. Notifications & Handoff
  8. Recovery controls
  9. Voicemail
  10. Exclusions
  11. Test & diagnostics
- Most section editors use **`MctbSetupSectionLayout`**: page H1 **Setup**, section **H2** title + description, **Save changes** / **Saved**, error banner.
- **Phone, Consent, Recovery, Notifications, Exclusions** use **`MctbSetupShell`** with their own section headers and save affordances.
- **Legacy redirects:** `/mctb/setup/business-hours`, `/mctb/setup/follow-up`, `/mctb/setup/schedule` → **Recovery controls**.

**Entry:** `/mctb/setup/start` → onboarding wizard (`/onboarding/mctb`).

---

## A. First-time onboarding wizard (`/onboarding/mctb`)

Standalone chrome (not the setup sidebar): **Transovo · Missed Call Text Back**, **Need help?**, **Save & exit**, **6-step progress** (Business line → Connect calls → Consent → Recovery → Voicemail → Review & test).

### Ready screen (`step === ready`)

- Success icon, **You're ready**
- Copy (messaging pending vs complete), optional **Trial active · N days**
- **Go to MCTB**, **Review setup**

### Step 1 — Business line

- **Business name**, **Business phone**, **Carrier / provider** (dropdown from carrier guides), **Website (optional)**
- Aside: **Keep your existing number** flow diagram, **No porting required**, **See how it works** (opens demo modal)
- **Continue** (requires name + phone)

### Demo modal (from step 1 or elsewhere)

- **How missed-call recovery works**, demo description
- **Demo number** (hero)
- **Start demo call**, **Demo progress** timeline (call detected, text delivered), **Close**

### Step 2 — Connect calls

- **MctbPhoneForwardingPanel** (shared with setup phone UX): business line, carrier, forwarding destination, ring seconds, guided vs instructions, verification timeline
- Auto **provision trial MCTB number** while on step
- **Back**, **Continue** or **Save & verify later** (starts forwarding test if not verified)

### Step 3 — Consent

- Eligibility note when **existing consent** disabled
- **MctbConsentModeCards**: Press 1 (recommended) vs **Use permission my business already has** (attestation checkbox on existing mode)
- **Back**, **Continue**

### Step 4 — Recovery message & texting

- **MctbTextBackComposer** (opener + customer preview; Press-1 shows locked compliance bubble + editable opener)
- **Text-back number** card (display, TFV status, **Complete messaging verification**, **Choose a number**)
- Aside: **MctbMessagingActivationPanel** (A2P/TFV status)
- **Back**, **Continue** (requires message)

### Step 5 — Voicemail

- Short copy + link to **Voicemail** inbox
- **Use default greeting**
- Aside: **Call ending** (Press-1 vs existing-consent behavior)
- **Back**, **Continue**

### Step 6 — Review & test

- Checklist rows with **Edit**: Business line, Forwarding, Consent, Recovery message, Messaging
- **Run live test**, warning + **Review forwarding** if not verified
- **Live test progress** timeline (forwarded call, missed classified, consent, recovery SMS)
- Aside: **Recovery flow** summary
- **Back**, **Finish setup** / **Continue** (activates trial when live test passed)

**Global:** **MctbNumberDrawerHost** (add / manage / verify numbers), error alert, saving footer on each step.

---

## B. Setup Overview (`/mctb/setup`)

- Header: **Setup**, description, optional **Last successful test**, primary **Run live test**
- **Status rail:** Recovery **Active / Paused / Inactive**, **Business line**, **Text-back sender** (+ state), **Forwarding** Verified/Pending, **Last test**
- **MctbSetupPauseControl** (pause/resume recovery from overview)
- **Health strip:** Needs attention vs Setup healthy, **N of M core systems ready**
- **Attention rows** (message + fix link), **View N issues**
- **How recovery works** flow strip: Missed call → Forwarded → Consent → Text sent → Voicemail (state labels)
- **Call flow** summary rows (each links to section): Phone & Forwarding, Recovery, Consent, Text-back message, Voicemail
- **Operations** rows: Notifications, Exclusions, Test & diagnostics
- Optional **Recent system activity** (funnel events)
- **Quick actions:** Run live test, Forwarding instructions, Edit recovery message, Change consent method, Change voicemail greeting

---

## C. Phone & Forwarding (`/mctb/setup/phone`)

- Header **Phone & Forwarding**, **Save changes** / Saved
- Paused banner when recovery paused
- **Status strip:** Business line, Forwarding to, Carrier, Connection
- **1. Public business number** — business line input, Verified / Not verified chip, helper copy
- **2. Forwarding destination** — Transovo number, Voice/Messaging chips, **Manage number** / **Choose number**, multi-number **select**
- **3. Phone service provider** — carrier grid (all guides in `MCTB_CARRIER_GUIDES`)
- **4. Set up conditional forwarding** — status, forward-to number, **View instructions**, **I already set this up**
- **5. Ring timing** — 10 / 15 / 20 sec (+ Recommended), **Custom** seconds (10–30), voicemail timing warning
- **6. Verify forwarding** — steps copy, panel states (verified / listening / failed / ready), **Run forwarding test** / **Run again**
- **Instructions drawer** (carrier steps, dial codes, copy)
- **Right rail:** Connection summary, **What happens when a call is missed** flow, **Need help?** (instructions, connection test, Troubleshooting → Test)
- **MctbNumberDrawerHost**; URL `?open=manage|add|verify`

---

## D. Missed-call rules (`/mctb/setup/missed-call-rules`)

- **Missed-call rules** + description (classification only)
- Paused banner
- **MctbTriggerRuleCards** toggles: **No answer**, **Busy**, **Rejected**, **Unreachable**, **Voicemail** (each with helper); validation if none selected
- Footnote link to **Recovery controls** for cooldown/max sends
- **Save changes**

---

## E. Text Back (`/mctb/setup/text-back`)

- Paused banner
- **Consent method** strip + **Change consent method** → Consent
- **MctbTextBackComposer:**
  - **Recovery opener** textarea, word count, variables hint (`{{customer.firstName}}`, `{{business.name}}`, `{{link}}`)
  - **Customer preview:** Press-1 → **System compliance confirmation (locked)** + **Recovery opener (editable)**; existing consent → single recovery bubble
- **Delivery timing (optional):** delay seconds
- Link to **Links & request form** for `{{link}}`
- **Save changes**

---

## F. Links & request form (`/mctb/setup/links`)

- Link to Text Back template
- **Default link URL** (http/https)
- **Enable public request form** (checkbox)
- **Lead capture** (checkbox, requires form)
- **Form fields** list (read-only defaults: label, type, Required badge) — note that custom editing is later
- When form on: **Public request form** URL, **Copy link**, **Preview form**
- **Resolved `{{link}}` preview** or empty state
- **Save changes**

---

## G. Consent (`/mctb/setup/consent`)

- Header **Consent**, health **Configured / Needs attention**, **Save changes**
- Paused banner; error alert
- **Status strip:** Status, Method, Text-back sender, Evidence
- **How should permission…** — two mode cards:
  - **Ask callers to press 1** (Recommended, per-call, MCTB line)
  - **Use permission my business already has** (attestation, eligible sender; disabled if ineligible + warn + link to manage number)
- **Caller experience** — numbered flow steps (mode-specific)
- **Press-1 only:** **Voice disclosure** (script text, **Preview / play** audio), **If the caller does not press 1** (voicemail path)
- **Existing consent:** attestation info (no Press-1 disclosure block)
- **Consent evidence** (method, captured/basis, stored with / attested) + **View consent log**
- **Right rail:** Consent summary, **Best for** bullets, **Current call flow**, **Related settings** (Recovery, Text back, Voicemail, Consent log)
- **Modals:** **Use existing consent** (attestation checkbox), **Switch to Press 1?**

---

## H. Notifications & Handoff (`/mctb/setup/notifications`)

- Header **Notifications**, **Save changes**
- **Status strip:** Alerts, Primary email, SMS alerts, Handoff mode
- **Conversation handoff** — response mode radios:
  - Notify me after they reply
  - Collect information
  - AI text conversation
  - Hand off immediately
- **Appointment booking in thread** select: Off / When customer asks / Selected services / AI when appropriate
- **Guided collection only:** **Information to collect** — per-field Off / Optional / Required (caller name, service reason, urgency, location/ZIP, etc.)
- **Emergency handling:** detection toggle; criteria textarea; when detected (action enum); if uncertain (treat normal / clarify / handoff human)
- **Team recipients:** enable toggle, name, role, email, mobile; **+ Add recipient**
- **Notification events** table — rows: Missed call detected, Customer replied, Lead captured, Callback requested, Urgent, Human required, Appointment booked, Voicemail received, Recovery failure — columns **Email / SMS / In-app**
- **Quiet hours:** enable, start/end time, emergency bypass, delay non-urgent SMS
- **Test notifications:** **Send test notification**, preview tabs (Lead SMS / Emergency SMS / Email)
- **Right rail:** summary KV, **When a caller responds** mini-flow, link to Conversations

---

## I. Recovery controls (`/mctb/setup/recovery`)

- Header **Recovery**, **Save changes**
- Unverified forwarding warning + **Fix forwarding**
- **Command bar:** Active/Paused, qualifying outcomes count, cooldown, last recovery (or pause note + **Resume now**)
- **Recovery status** — Active/Paused, **Resume now**, **Pause recovery** / **Change pause**; footnote (forwarding/voicemail stay on)
- **What counts as a missed call?** — same five outcomes as missed-call rules (toggle grid)
- **Repeat callers** — cooldown **Off** + presets + **Custom** minutes, illustrative mini-flow
- **AI Lead Recovery** — blurb + **Configure AI Lead Recovery →** (separate route)
- **Booking** subsection (`MctbSetupBookingSection`):
  - Booking links list (label, host, active, edit/delete), **Add booking link**
  - **Include booking link in initial recovery** + default link select
  - **AI Booking** (Premium): enable, provider, targets, fallback link, readiness, test slots, upgrade if not entitled
- **Recovery guardrails:** **Recovery delay** modal, repeat caller behavior, **Follow-up behavior** link (Text Back), **Maximum attempts**
- **Why a recovery may not send** — diagnostic reasons with 7d counts (trigger disabled, paused, cooldown, excluded, consent, sender, duplicate, not forwarded) + **View missed calls**
- **Right rail:** Recovery summary, message preview, related links, **How recovery works**, **Recent suppressions**
- **Pause recovery modal:** 1 hour, until tomorrow morning, 24 hours, custom datetime, until I resume; timezone shown

---

## J. Voicemail (`/mctb/setup/voicemail`)

- Link **Open voicemail inbox**
- **MctbVoicemailSetupSection:**
  - **Voicemail greeting** header
  - **Greeting source** cards: Transovo voice (TTS), Record yourself, Upload audio
  - **Build & preview** — `PersonalGreetingControls` (script, record, upload, create greeting)
- No page-level Save (greeting saves inside controls)

---

## K. Exclusions (`/mctb/setup/exclusions`)

- Header **Exclusions**, **Add exclusion**
- **Status strip:** Total, Added here, Personal blocks, Recently added (this month)
- Toolbar: **Search**, filters (Reason, Source, All types, Sort newest/oldest/phone)
- **Table:** Caller, Phone, Reason, Source, Added, row menu (edit/remove/copy)
- **Add/Edit modal:** phone, reason presets + custom
- **Remove confirmation**
- Empty / filtered-empty states

---

## L. Test & diagnostics (`/mctb/setup/test`)

No Save button.

1. **Demo test (no forwarding)**
   - Consent mode cards (Press 1 vs existing permission + attestation)
   - **Demo number**
   - **Start demo test** → timeline: call, greeting, press 1 (if mode), consent, SMS queued/sent; **Start new demo** if expired

2. **Production path test**
   - Assigned MCTB number
   - **Start setup test** / **Run again**
   - Checkpoints: call reached MCTB, workspace, consent mode, greeting, press 1 (if applicable), consent recorded, missed-call event, SMS queued, provider accepted

3. **Forwarded business line test**
   - Copy with business line + forward target
   - **Start live test** / **Run again**
   - Checkpoints: call on MCTB, missed classified, consent, SMS sent, delivered, reply in inbox

4. **After testing** — links to Phone & Forwarding, reminder on consent/message copy

---

## Notable overlaps (for a later connectivity audit)

- **Missed-call outcomes** appear on both **Missed-call rules** and **Recovery controls** (same runtime fields).
- **Recovery delay** appears on **Text Back** and **Recovery guardrails**.
- **Links** exist in both **Links & request form** and **Recovery → Booking** (external schedulers vs `{{link}}` / request form).

---

## Next pass (optional)

Connectivity matrix per section: UI control → API → persistence → runtime behavior → “actually works” (same style as Voice V3 wizard audit).
