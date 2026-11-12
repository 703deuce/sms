# MCTB — Final product scope, IA & page architecture

**Mode:** Product / IA design pass (no implementation).  
**Builds on:** `docs/MCTB-COMPLETE-PRODUCT-FEATURE-EXPOSURE-AUDIT.md`  
**Date:** 2026-09-25  
**Authority:** Owner product decisions in this document supersede legacy UI, competitor shapes, and incidental code breadth.

---

## 1. Executive product definition

**Missed Call Text Back (MCTB)** is Transovo’s product for recovering callers when a business misses a phone call. It safely establishes permission to text, sends an appropriate first recovery message, supports an SMS conversation, optionally assists with simple AI collection of caller needs, and helps the business act (reply, call back, send a booking link) without adopting a second CRM.

**Canonical lifecycle:**

```
MISSED CALL → ELIGIBILITY → CONSENT → TEXT BACK → CUSTOMER REPLIES → CONVERSATION
  → OPTIONAL AI ASSISTANCE → BUSINESS TAKES OVER / CALLS BACK / BOOKING LINK → RESOLVED
```

**MCTB is not:** a CRM, pipeline, field-service platform, workforce manager, calendar product, marketing automation platform, or outbound nurture system.

**Implementation principle:** Existing TeXML ingress, eligibility, consent, SMS, lead-recovery runtime, and handoff state are **preserved**. This document defines **what customers see and where** — not a runtime rewrite.

---

## 2. Locked product decisions

| Decision | Status |
|----------|--------|
| **No automatic no-reply follow-up** | **LOCKED — NOT PART OF FINAL PRODUCT** |
| **No competitor-style chase** (wait → second unsolicited SMS) | **LOCKED** |
| Legacy/dormant follow-up code may remain for regression safety | Hide from launch UI; do not market; do not design IA around it |
| **AI Recovery simplified** | Business context + collection fields + optional booking URL only |
| **No Voice-style agent builder** in MCTB | **LOCKED** |
| **MCTB does not directly book** | No FIND/BOOK/reschedule/cancel/slot picker in MCTB UI |
| **Booking = SEND BOOKING LINK** when enabled | External or shared Appointments owns scheduling after click |
| **AI_BOOK runtime** | May remain dormant/protected; **not exposed** in final launch UI (`MCTB_LAUNCH_HIDE_LR_AI_BOOK_UI` aligns) |
| **Text-to-Pay** | Out of scope; remain hidden |
| **Consent as strength** | Plain-language consent/eligibility everywhere appropriate |

---

## 3. Feature buckets (final product)

### Bucket A — Core recovery (first-class)

Missed-call detection; business number + CFNA forwarding; Press-1 and existing-consent modes; consent persistence; eligibility; first automatic text; exclusions; STOP/HELP; repeat/cooldown suppression; recovery pause; conversations; manual replies; owner notifications (truthful channels only).

### Bucket B — Recovery intelligence (integrated, not a second product)

Simple AI recovery; business information; qualification fields (name, need, address, urgency, callback preference); AI summary; human takeover + resume automation; booking-link send; returning-caller context.

### Bucket C — Missed-call evidence

History; eligibility/suppression; text-back status; consent method/time; voicemail + transcript; linked conversation; recovery outcome signals.

### Bucket D — Operational tools (in Inbox / detail, not a CRM)

Unread/replied; takeover; quick replies (shared); call customer; callback needs/completed; resolved; booking-link action; notifications.

### Bucket E — Measurement

Missed calls; eligible; texts sent; replies; reply rate; AI-assisted recoveries (if definable); callbacks requested/completed (if persisted); booking links sent (must be **real** counts); voicemail; opt-outs/suppressions; trends.

### Bucket F — Compliance / trust

Press-1 records; attestations; provenance; STOP; suppression; eligibility explanations; sender identity; messaging status — **visible**, not backend-only.

### Post-launch (not IA drivers now)

Lightweight won/lost; job value; richer returning-customer UI; multi-recipient notifications; SMS owner alerts; multi-line/location; recovery scorecard email; CSV export.

---

## 4. Explicit non-features (do not design IA around)

Full Leads CRM; sales pipeline; workers/crews; `/mctb/contacts`; `/mctb/calendar` or MCTB appointments nav; direct appointment scheduling; proposed slots; no-reply nurture; win-back; review campaigns; Text-to-Pay; field-service job management; pricing intelligence; giant revenue CRM; generic marketing automation.

**Shared platform** (Contacts, Appointments, Integrations, Settings, Billing) — link contextually only.

---

## 5. Final permanent MCTB navigation

**Maximum permanent MCTB product nav (7 items):**

| # | Label | Route (canonical) |
|---|--------|-------------------|
| 1 | Overview | `/mctb` |
| 2 | Missed Calls | `/mctb/missed-calls` |
| 3 | Inbox | `/mctb/conversations` |
| 4 | AI Recovery | `/mctb/ai-recovery` *(rename from `/mctb/ai-lead-recovery`)* |
| 5 | Voicemail | `/mctb/voicemail` |
| 6 | Analytics | `/mctb/analytics` |
| 7 | Setup | `/mctb/setup` |

**Not primary nav:** Consent Log (`/mctb/compliance/consent`) — Setup → Consent + contextual links.  
**Shared/global (not duplicated under MCTB):** Contacts, Appointments, Integrations, Settings, Billing, Numbers (when entitled).

**Mobile (compact):** Home (`/mctb`), Missed, Inbox, Setup — optional Voicemail if entitlement; full IA via sidebar.

---

## 6. Ownership model (navigation questions)

| Destination | Question it answers |
|-------------|---------------------|
| **Overview** | What has MCTB recovered, and does anything need attention? |
| **Missed Calls** | What happened to each missed call? |
| **Inbox** | Who is texting me, and what should I do next? |
| **AI Recovery** | What should Transovo know and collect during SMS recovery? |
| **Voicemail** | Which callers left messages needing attention? |
| **Analytics** | Is MCTB recovering missed opportunities? |
| **Setup** | How is MCTB connected and configured? |

---

## 7. Overview — page specification

**Archetype:** Operational dashboard (spec 01 aligned).  
**Primary job:** In seconds: Is MCTB working? What happened recently? Does anything need me?

### Frame & shell

- Transovo app shell + MCTB local nav (Overview selected).
- Content max-width: match Appointments operational pages (~`max-w-7xl` / existing shell content region).
- Gutters: standard shell padding (`px-4 md:px-6`).

### Top-to-bottom architecture

1. **PageHeader** — H1: `Overview` (product name in shell/breadcrumb: Missed Call Text Back). Description: one line recovery value. **No** giant hero.
2. **Service status strip** (conditional) — Quiet `● Active` or actionable pause/setup issue only (`mctb_status`, forwarding/sender/consent facets from `loadMctbOverview`).
3. **KPI strip** — 4 metrics max, semantic `StatCard` pattern:
   - Missed calls (today or selected period — match Analytics definition)
   - Texts sent
   - Replies
   - **Recovered conversations** OR **Needs reply** — use metric only if denominator is defined in backend; else **Needs reply** from authoritative `needs_reply_count`.
   - **No** recovered revenue dollars.
4. **Needs attention** (conditional region) — List 0–n items with primary link: replied needs human; callback requested; voicemail unreviewed; setup/sender blockers. Hidden when empty (healthy quiet).
5. **Recent activity** — Table or structured list, 5–8 rows: caller, relative time, human outcome line, CTA (Open / Call / View voicemail). Data: `recent_missed_calls` + recent conversations — same contract as overview API.
6. **Setup readiness** (conditional) — Compact rows linking to Setup sections; **hidden** when healthy/active.

### States

- Loading: skeleton KPI + list rows (no false zeros).
- Empty first-use: CTA to Setup / Continue onboarding.
- Error: retry on overview fetch.
- Partial: show KPIs with banner if one sub-feed failed.

### Responsive / a11y

- KPI strip stacks 2×2 on narrow; table becomes stacked records (Guide #6/#7).
- Status uses text + icon, not color alone.

---

## 8. Missed Calls — page specification

**Archetype:** Operational list (spec 02).  
**Route:** `/mctb/missed-calls`

### Header

- H1: `Missed Calls`
- Control bar: Search (phone/name) → Status/Recovery → Date range → More filters (suppressed, business line if multi-line later).

### Table (desktop)

Semantic `<table>` with columns:

| Column | Content |
|--------|---------|
| Caller | Primary link → detail |
| Missed | Timestamp (workspace TZ) |
| Recovery | Single authoritative state (see §13 vocabulary) |
| Conversation | Replied / No reply / — |
| Next action | Contextual text or action menu |

### Filters (only if backed by DB)

- All · Replied · Needs callback · Voicemail · Suppressed / Not texted

### States

- True empty vs filtered empty.
- Preserve filter/page on return from detail.

---

## 9. Missed Call Detail — page specification

**Archetype:** Object detail (spec 03).  
**Route:** `/mctb/missed-calls/[id]`

### Layout order (top → bottom)

1. Back link → Missed Calls (preserve list context).
2. **Header** — Caller identity (name or E.164), missed time, business line; **one** primary status chip; **one** dominant action (state-dependent).
3. **Lifecycle summary** — Ordered plain-language steps (not raw event codes). Example chain in owner spec §12.
4. **Primary actions** — Open conversation · Call customer · Review voicemail · Send booking link (if configured) · Mark callback complete (if state supports).
5. **Recovery information** — Captured fields from handoff snapshot / lead recovery (only non-empty).
6. **Consent & messaging** — Method, timestamp, eligibility, suppression reason; link **View consent history →** `/mctb/compliance/consent` (filtered context if supported).
7. **Voicemail** — Player, transcript, processing state if linked.
8. **Timeline** — `<ol>` authoritative events from API (not client-inferred).
9. **Diagnostics** — Collapsed disclosure; no secrets.

### “Why wasn’t this caller texted?” (§13)

Dedicated block when `SUPPRESSED` / not sent:

| Backend reason (examples) | Customer copy |
|---------------------------|---------------|
| No Press-1 | No text sent — caller did not press 1 to opt in. |
| Opt-out | No text sent — this number previously opted out. |
| Recovery paused | No text sent — recovery is currently paused. |
| Cooldown | No text sent — caller was recently texted; repeat-call cooldown applies. |
| Invalid / landline | No text sent — this number cannot receive SMS. |
| Not missed / answered | No text sent — call was not treated as a missed call. |
| Exclusion | No text sent — number matches your exclusion rules. |

Map from `suppressionReason` / eligibility API — **required** for launch IA pass implementation.

---

## 10. Inbox — page specification

**Archetype:** Split-pane workspace (spec 04).  
**Route:** `/mctb/conversations` (shared `KimiConversationsConnected`, `product=mctb`).

### Thread list

- Caller/contact, latest message preview, time, unread indicator.
- **One** operational state badge max: Needs reply · Needs callback · AI active · Booking link sent · Resolved (priority order defined in implementation contract).

### Conversation pane

- **Header:** Identity, phone, repeat-caller badge, consent/messaging eligibility line (factual).
- **Actions:** Call · Send booking link · More (assign/tags if shared inbox permits).
- **Composer:** Standard SMS composer; **Saved replies** entry (§17).

### States

- Blocked composer: opted out, sender not ready, human-only mode per automation state, permission denied — with reason text.

---

## 11. AI recovery result-in-thread specification

**Placement:** Between context header and message thread (or right rail on wide desktop — pick one in implementation; **default: above thread** for mobile parity).

**Component:** `MctbRecoveryContextPanel` (evolve from unwired `MctbHandoffContextPanel` + snapshot fields).

### Visual structure

```
┌─ AI Recovery ─────────────────────────────┐
│ [Urgent · Callback requested]  (optional) │
│ What they need: Water heater leaking      │
│ Name: Mike                                  │
│ Location: Woodbridge, VA                    │
│ Callback: After 3 PM                          │
│ Summary: … (labeled AI summary)             │
│ [Take over conversation]                    │
└─────────────────────────────────────────────┘
```

### Rules

- Render **only** fields present in `api/mctb/handoff/context` / snapshot JSON.
- Empty collection → **omit panel** (no placeholder wall).
- Typography: `text-sm`, section label `font-semibold`, field labels `text-muted-foreground`.
- a11y: `region` + `aria-label="AI recovery context"`.

---

## 12. Human takeover specification

**Canonical owner:** Inbox thread.

**Runtime (preserve):** `mctbConversationAutomationState`, `shouldBlockAutomation`, `/api/mctb/handoff/actions` (`take_over`, `resume_automation`).

### UI states

| State | Copy | Actions |
|-------|------|---------|
| Automation active | AI Recovery is handling replies. | **Take over conversation** |
| Human active | You're handling this conversation. Automatic AI replies are paused. | **Resume AI Recovery** |

**Behavior:** Owner manual send → takeover per existing `process-inbound-reply` (verify on implement — do not duplicate state machine).

**Stop condition check:** APIs exist and enforce workspace scope — **safe to expose** in controlled implementation. Panel was built but not mounted (audit P1).

---

## 13. Callback workflow specification

**No** `/mctb/callbacks` route.

**States (runtime):** `followUpStatus` — `needs_follow_up`, `called_back`, `resolved`, etc. (`handoff/actions`).

**Surfaces:**

- Inbox list filter: **Needs callback** (if query supported).
- Missed Calls filter + detail primary action.
- In recovery panel / header: **Call customer** · **Mark called back** · **Resolve**.

---

## 14. Quick Replies integration

**Owner:** Shared `/conversations/saved-replies` (`SavedRepliesConnected`).

**MCTB change:** Composer control `[ Saved replies ]` opening picker or submenu; no MCTB-specific template DB.

**Nav:** No MCTB menu item; optional Setup tip link “Manage saved replies in Conversations.”

---

## 15. AI Recovery configuration page specification

**Route:** `/mctb/ai-recovery` (redirect `/mctb/ai-lead-recovery` → canonical).

**Rename customer-facing:** **AI Recovery** (never “Agent builder” / “Lead Recovery agent”).

### Page sections

1. **Status** — On/Off (`AI Recovery enabled`) tied to existing config enable flag.
2. **Business information** — Editable concise fields **or** read-only from shared Company Brain with “Edit in Business profile” link where `loadMctbApprovedBusinessInformation` / `loadBusinessBrain` is source of truth. Fields: name, description, services, service area, hours, short policies. **Do not** rebuild Voice Business Knowledge UI.
3. **Information to collect** — Checkbox list mapped to runtime field IDs (name, need, address, urgency, callback time). Custom questions only if runtime supports (gate per field registry).
4. **Booking link** — Toggle: Allow AI Recovery to offer online booking. URL input. Help text per owner spec. **No** calendar UI.
5. **Behavior (minimal)** — Handoff thresholds only if already persisted (e.g. when to notify owner); **no** model/temperature/prompt editors.

### Explicitly absent

- Follow-up timers / no-reply sequences (§20).
- AI_BOOK / FIND / BOOK / reschedule / cancel.
- Text-to-Pay scenario.
- Payment / multi-scenario policy builder.

### Persist path

Continue `api/mctb/lead-recovery/config` with UI projecting **launch subset**; dormant actions remain in DB but not editable.

---

## 16. Booking-link-only specification

| Step | Behavior |
|------|----------|
| Customer expresses booking intent | AI policy allows `SEND_BOOKING_LINK` |
| Runtime | `action-runtime.ts` sends configured URL |
| MCTB UI | Configure URL on AI Recovery; manual “Send booking link” in Inbox optional |
| After click | Transovo Appointments / Calendly / Microsoft / customer URL owns flow |

**Isolation:** Launch flags already hide AI_BOOK UI; IA forbids re-exposing. Runtime `AI_BOOK` path stays for certification/rollback — **no customer controls**.

---

## 17. Voicemail — page specification

**Route:** `/mctb/voicemail` (entitlement gate unchanged).

**List:** Caller, time, duration, transcript status, attention state.  
**Detail:** Playback, transcript, related missed call, related conversation, Call / Open conversation.

**Not** a leads CRM.

---

## 18. Voicemail configuration

**Owner:** Setup → Voicemail (`/mctb/setup/voicemail`): greeting, behavior, test/preview per spec 05.

---

## 19. Analytics — page specification

**Route:** `/mctb/analytics`

### Hierarchy

1. Date range (+ business line when multi-line exists).
2. **Recovery funnel** (only stages with data): Missed → Eligible → Texts sent → Replies → (optional) Actionable/AI-assisted.
3. **Primary metrics** — honest definitions inline or tooltip.
4. **Trends** — missed / replies over time.
5. **Suppression breakdown** — opt-out, cooldown, excluded, no consent (not framed as “failures”).

### Honesty fixes (implementation pass)

- **Booking links sent:** must count link send events or tracked clicks — **not** proxy `textsSent` (audit finding).
- Document numerator/denominator/TZ internally per metric.

---

## 20. Setup architecture

**Route:** `/mctb/setup` — overview of sections (no 11-item sidebar).

| Section | Route | Owns |
|---------|-------|------|
| Phone & Forwarding | `/mctb/setup/phone` | Business line, CFNA, carrier, verify |
| Consent | `/mctb/setup/consent` | Mode, attestation, link to consent log |
| Text Back | `/mctb/setup/text-back` | Opener + locked compliance preview |
| Recovery | `/mctb/setup/recovery` | Pause, cooldown — **no** quiet hours / no-reply |
| Voicemail | `/mctb/setup/voicemail` | Greeting config |
| Notifications | `/mctb/setup/notifications` | Email-only if launch flag |
| Exclusions | `/mctb/setup/exclusions` | Suppression rules |
| Test | `/mctb/setup/test` | Forwarding/consent/SMS checks |
| Links / request form | `/mctb/setup/links` | Public form (not primary nav) |

**Redirects (keep):** `business-hours`, `follow-up`, `missed-call-rules` → recovery.

---

## 21. Consent / compliance architecture

- **Setup → Consent:** Plain-language Press-1 vs existing permission.
- **Consent Log:** `/mctb/compliance/consent` — audit table; reach via Setup + detail links.
- **Surfacing:** Chips/copy on detail, inbox header, missed list recovery column.

---

## 22. Contacts & Appointments shared ownership

| Need | Owner |
|------|--------|
| Contact record | `/contacts` |
| Appointment records | `/appointments` |
| MCTB surfaces | Name, repeat caller, links **View contact →** / **View appointment →** |

No `/mctb/contacts` or `/mctb/appointments` in permanent nav (redirects remain for legacy URLs).

---

## 23. Product shell rules (MCTB vs Voice)

| Entitlement | Shell behavior |
|-------------|----------------|
| MCTB only | **7-item MCTB nav only** — no Voice peers in MCTB shell |
| Voice only | Voice IA (separate shell product) |
| Both | **Product switcher** makes ownership explicit; MCTB nav must not embed Voice configuration pages as if they were MCTB setup |

**Implementation note:** Today `buildMctbV1Nav` injects Voice items when `hasVoice` — **change in Pass 1** to shell/switcher model above (smallest clear separation; may touch `resolve-product-nav.ts`, product switcher, not Voice runtime).

---

## 24. First-run rules

- **Process route:** `/onboarding/mctb` (wizard).
- Configures: phone, forwarding, consent, first text, notifications, basic recovery, test.
- **Same persistence** as Setup / AI Recovery — no wizard-only shadow config.
- Wizard not in permanent nav.

---

## 25. Runtime preservation map

| Customer concept | Canonical UI | API / persistence | Runtime consumer |
|------------------|--------------|-------------------|------------------|
| Missed call | Missed Calls / detail | `MissedCallEvent`, `api/mctb/missed-calls` | TeXML capture, eligibility |
| Eligibility reason | Detail “why no SMS” | `suppressionReason`, eligibility | `evaluateMissedCallTextEligibility` |
| First text | Setup → Text Back | MCTB setup config | SMS send pipeline |
| Consent | Setup + log | Consent events, attestation | TeXML press-1 / existing_consent |
| Conversation | Inbox | Shared conversations | Inbound SMS |
| AI collection | Inbox panel + AI Recovery | Lead recovery config, automation state | `lead-recovery/*` |
| Takeover | Inbox | `handoff/actions`, `mctbConversationAutomationState` | `shouldBlockAutomation` |
| Booking link | AI Recovery + inbox action | Policy `SEND_BOOKING_LINK`, booking URL | `action-runtime` |
| Callback state | Inbox / detail | `followUpStatus` | `handoff/actions` |
| Voicemail | Voicemail + setup | Voicemail models | MCTB voicemail runtime |
| Pause/cooldown | Setup → Recovery | Config cooldown, pause | Eligibility + recovery |
| No-reply follow-up | **None (hidden)** | Legacy flags may exist | **Do not expose** |

---

## 26. Duplicate-editor removals

| Remove / avoid | Keep single owner |
|----------------|-------------------|
| AI Lead Recovery “agent builder” complexity | AI Recovery simplified page |
| MCTB calendar/appointments/booking nav | Shared Appointments + booking URL |
| `/mctb/voice-agent` as customer destination | Remove from nav; deprecate or redirect to AI Recovery / Setup |
| Second takeover (AI Assist vs MCTB) for MCTB threads | MCTB handoff for `productSource=mctb` |
| Follow-up / business-hours editors | Recovery pause + cooldown only |
| Inbox-only vs MCTB-only duplicate compliance editors | Setup + log |

---

## 27. Legacy route recommendations

| Legacy route | Recommendation |
|--------------|----------------|
| `/mctb/ai-lead-recovery` | 301/redirect → `/mctb/ai-recovery` |
| `/voice/missed-calls`, `/voice/setup`, etc. | Keep redirects to `/mctb/*` |
| `/mctb/calendar`, appointments, booking, reminders | Keep redirects to conversations or setup recovery |
| `/mctb/voice-agent` | Redirect → `/mctb/ai-recovery` or Setup |
| `/mctb/numbers` | Keep redirect → setup phone manage |
| `/analytics/mctb` | Alias or redirect → `/mctb/analytics` |

---

## 28. Responsive & accessibility contract

- All pages: WCAG 2.2 AA, semantic landmarks, keyboard paths for tables, filters, takeover actions, voicemail player.
- Inbox: split-pane collapse pattern from shared Conversations.
- Touch targets ≥ platform minimum; focus visible on takeover/resume.
- Motion: respect `prefers-reduced-motion`.

---

## 29. Detailed page-spec requirements (implementation gate)

Before coding each changed surface, produce a **page contract** (Voice Mode 4 pattern) with: archetype, primary job, visual reference (Appointments operational), frame, header, section order, column specs, spacing tokens, typography roles, controls, status vocabulary, progressive disclosure, all states, responsive rules, a11y notes.

**Forbidden:** vague tickets (“add qualification to inbox”).

---

## 30. Migration sequence (recommended)

| Pass | Scope | Rationale |
|------|--------|-----------|
| **1** | Shell/nav purity + Inbox: mount recovery panel, takeover, saved replies entry | Highest customer pain (audit P1) |
| **2** | Missed Calls + detail + “why no SMS” copy map | Trust + support load |
| **3** | AI Recovery page simplification + route rename | Product clarity |
| **4** | Setup consolidation, consent discoverability, hide follow-up remnants | Configuration coherence |
| **5** | Analytics honesty + Overview alignment | Measurement trust |
| **6** | Voicemail cross-links + legacy route cleanup | Polish |

**Dependencies:** Pass 1 shell work may precede or parallel Pass 1 inbox; AI Recovery simplification (3) should not re-enable AI_BOOK UI.

---

## 31. Risks / unresolved constraints

| Risk | Mitigation |
|------|------------|
| Bundled MCTB+Voice nav today | Pass 1 shell rules; product switcher |
| AI Assist takeover vs MCTB | For `product=mctb`, prefer MCTB handoff; document in composer |
| Booking link metrics missing | Add event count before showing metric |
| Company Brain edit location | AI Recovery may be read-only + link to Settings business profile |
| Custom collection fields | Limit UI to registry supported by `lead-recovery` field engine |
| Entitlement voicemail | Keep add-on gate; nav item remains |

**Stop conditions evaluated:**

- Handoff runtime **safe to expose** (APIs scoped).
- Collected fields **stable** via handoff context API.
- Booking-link-only **isolatable** via launch flags + policy defaults (`SEND_BOOKING_LINK`).
- Shared Contacts **available** for links.
- Shell separation **requires** nav refactor, not impossible.

**Not blocked.**

---

## 32. Final ownership table

| Capability | Canonical owner | Contextual access | Duplicate editor allowed? |
|------------|-----------------|-------------------|---------------------------|
| Missed call history | Missed Calls | Overview, Inbox | No |
| Consent evidence | Consent Log | Missed Call Detail, Setup | No |
| First text | Setup → Text Back | Onboarding summary | No |
| Recovery pause/cooldown | Setup → Recovery | Overview status | No |
| AI business info | AI Recovery | Onboarding; Business profile if shared | No |
| AI collection fields | AI Recovery | Inbox result panel | No |
| Booking link | AI Recovery | Inbox send action | No |
| Conversation | Inbox | Missed Call detail | No |
| Human takeover | Inbox | — | No |
| Quick replies | Shared Saved Replies | Inbox composer | No |
| Voicemail operations | Voicemail | Missed Call detail | No |
| Voicemail config | Setup → Voicemail | Onboarding | No |
| Contacts | Shared Contacts | Inbox/detail | No |
| Appointments | Shared Appointments | Contextual link only | No |
| Analytics | Analytics | Overview summaries | No |
| Notifications | Setup → Notifications | Overview problem state | No |
| Phone/forwarding | Setup → Phone | Overview readiness | No |
| Exclusions | Setup → Exclusions | Missed Call explanation | No |
| No-reply follow-up | **Not in product** | — | **N/A** |
| Direct appointment booking | **Not in product** | — | **N/A** |

---

## 33. Recovery status vocabulary (Missed Calls / detail)

Use locked domain terms (canonical map): **Eligible · Scheduled · Sending · Sent · Delivered · Suppressed · Failed** for recovery SMS; consent states separate; **Suppressed ≠ Failed**. Customer copy layers on top (§13).

---

## Appendix — Mapping current implementation → target IA

| Current nav label | Target |
|-------------------|--------|
| AI Lead Recovery | AI Recovery |
| Inbox | Inbox (unchanged) |
| Voice section in MCTB shell | Product switcher only when both entitlements |

| Current page | Target |
|--------------|--------|
| `ai-lead-recovery-page.tsx` | Simplified `ai-recovery` config |
| `MctbHandoffContextPanel` | Wired into `conversations-thread-area` for MCTB |
| `launch-flags` follow-up hide | Permanent product exclusion |

---

**MCTB FINAL IA DESIGN COMPLETE — READY FOR CONTROLLED IMPLEMENTATION**
