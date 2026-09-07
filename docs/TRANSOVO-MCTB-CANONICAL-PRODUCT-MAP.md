# Transovo MCTB — Canonical Product Map

**Status:** Active — **highest product-architecture authority for Missed Call Text Back**  
**Audience:** Cursor, Kimi, engineers, designers  
**Role:** IA, domain model, lifecycle, state vocabulary, page architecture, and implementation contract for MCTB

> **Governing instruction:** Rebuild Missed Call Text Back as one coherent Transovo product domain using the complete Transovo governance and Guides #1–#11. Existing screenshots and pages are feature/content evidence only; they do not control information architecture, navigation, page archetype, terminology, visual hierarchy, or component placement. Preserve verified business logic and runtime behavior, but reorganize all customer-visible MCTB functionality around the canonical mental model: configure recovery → detect missed call → determine eligibility/consent → send recovery text → receive reply → follow up → measure outcome. Daily operational objects—Missed Calls and Conversations—receive highest navigational prominence. Configuration is consolidated under Setup; sender/number infrastructure under Numbers; organization-wide configuration under Settings; aggregate outcomes under Analytics. Every feature has one canonical home, every state has one authoritative runtime source, every compliance decision comes from the centralized deterministic eligibility layer, and no legacy page, screenshot, route, or component may create duplicate product architecture. Use the same Transovo shell, visual tokens, components, accessibility, responsive, form, table, privacy, security, temporal, and internationalization standards already governing the Appointments product. **Audit → Preserve → Extend → Consolidate.**

**Prerequisite:** `docs/TRANSOVO-MCTB-PRODUCT-SCOPE-AND-DOMAIN-RULES.md` + `docs/TRANSOVO-MCTB-INFORMATION-ARCHITECTURE-AND-NAVIGATION-MAP.md` + `docs/TRANSOVO-MCTB-PAGE-INVENTORY-AND-ROUTE-MANIFEST.md`  
**Cursor rule:** `.cursor/rules/transovo-mctb-canonical.mdc`  
**Read order:** Product scope → IA/navigation map → page manifest → this map → all `transovo-*.mdc` standards — before any MCTB UI, API, backend, or runtime change.

---

## 1. Product mental model

MCTB is not a generic voice product. It is:

**Recover missed business calls by automatically opening a compliant text conversation with the caller.**

```
SET IT UP
    ↓
A CALL IS MISSED
    ↓
TRANSOVO DETERMINES WHETHER TEXTING IS ALLOWED
    ↓
CONSENT IS CAPTURED WHEN REQUIRED
    ↓
TEXT-BACK IS SENT
    ↓
CUSTOMER REPLIES
    ↓
BUSINESS RESPONDS / CALLS BACK
    ↓
RESULT IS MEASURED
```

Runtime sequence: carrier-forwarded missed call → consent where applicable → SMS → conversation → analytics, links, forms, and suppression.

---

## 2. Canonical user jobs

| Job | User question | Frequency |
|-----|---------------|-----------|
| Monitor recovery | Is missed-call recovery working? | Daily |
| Handle missed calls | Who called and what happened? | Daily |
| Reply to customers | Who texted back? | Daily |
| Measure results | Is this recovering business? | Weekly |
| Configure recovery | What should happen when I miss a call? | Occasional |
| Maintain readiness | Is forwarding, sender, consent, or compliance okay? | Occasional / exception-driven |

Setup, compliance, exclusions, forwarding, sender, consent, business hours, etc. **must not** compete visually with Missed Calls and Conversations as equally frequent operational work.

---

## 3. Canonical domain objects

| Object | Meaning | Canonical home |
|--------|---------|----------------|
| Missed call | Detected missed-call occurrence | Missed Calls |
| Caller / Contact | Person who called | Conversation / related contact |
| Conversation | SMS thread from MCTB | Conversations |
| Message | Individual inbound/outbound SMS | Conversation |
| Consent event | Permission/withdrawal evidence | Contextual + compliance history |
| Suppression | Reason SMS may not be sent | Contextual + Settings |
| Recovery configuration | Rules controlling MCTB | Setup |
| Business line | Customer's public phone line | Setup |
| Forwarding destination | Hidden Transovo voice-ingress number | Setup |
| SMS sender | Number used to text caller | Setup / Numbers |
| Business schedule | Business-hours periods | Setup |
| Text-back template | Message after missed call | Setup |
| Consent prompt | Voice disclosure for Press-1 | Setup |
| Tracked link | URL in recovery SMS | Setup + missed-call detail |
| Request form | Optional info-gathering form | Setup |
| Request submission | Customer form response | Missed-call detail / Conversation |
| Exclusion | Business do-not-text number | Settings / Setup → Exclusions |
| Recovery event | SMS schedule/send/suppression lifecycle | Missed-call detail |
| Analytics event | Aggregate operational event | Analytics |

---

## 4. Consent architecture (Guide #8 — hard rule)

**There is no `consent = true` product model.**

Conceptual fields: channel, purpose, sender, status, provenance, captured_at, withdrawn_at, source, disclosure_version, evidence_type.

### Press-1
Missed call → voice disclosure → caller presses 1 → consent event → compliance SMS → business conversation message.

### Existing consent
Missed call → business attested/external permission → eligibility → eligible text-back.

Different **provenance** — cannot be one generic "Consent = enabled" switch. Runtime modes: `press_1` and `existing_consent`.

---

## 5. Sender readiness ≠ recipient permission

Three separate state families — never collapse to one green/red "SMS status":

| Family | States |
|--------|--------|
| **SENDER** | Ready / Registration required / Pending / Needs attention |
| **RECIPIENT** | Eligible / Consent required / Not captured / Opted out / Excluded |
| **MESSAGE** | Scheduled / Sending / Sent / Delivered / Suppressed / Failed |

Never show "SMS READY" when only toll-free verification or 10DLC campaign is approved.

---

## 6. Canonical MCTB call lifecycle

```
CALL → Received → Classified (Answered | Missed)
  MISSED → ELIGIBILITY (Ineligible* | Eligible)
    Ineligible: opt-out, excluded, cooldown, sender unavailable, consent unavailable, other
    Eligible → CONSENT (existing | Press-1) → Granted
      → RECOVERY: Scheduled → Sending → Sent → Delivered | Failed | Suppressed
        → ENGAGEMENT: No reply | Customer replied
          → FOLLOW-UP: Open | Assigned | Business replied | Callback needed | Resolved
```

**Suppressed ≠ Failed.** Correct opt-out suppression is success, not failure.

---

## 7. Canonical setup lifecycle

```
Not started → Business line → Forwarding destination → Carrier forwarding →
Forwarding verified → SMS sender ready → Consent method → Recovery behavior →
Live test passed → READY → ACTIVE

Later: Active | Paused | Needs attention (always with reason)
```

---

## 8. Canonical MCTB navigation

### Final sidebar

```
Missed Call Text Back
  Home
  Missed Calls
  Conversations
  Analytics
Configure
  Setup
  Numbers
────────────
Settings
```

### NOT permanent primary nav

Try It, Messaging Compliance, Exclusions, Consent Prompt, Business Hours, Text-back Message, Request Form, Links, Cooldown, Reply Handling, Carrier Instructions, Live Test — these are setup steps, contextual config, settings, or process views.

---

## 9. Compliance

Keep shared platform compliance. MCTB exposes **Business texting** in Setup → Texting (sender status, readiness, link to canonical compliance). Do not duplicate compliance inside MCTB.

---

## 10. Try It

Not permanent nav. Use contextually: Home (demo), Setup → Test & Activate (real test), Setup → Test & diagnostics (post-activation). Preserve engine; demote nav placement.

---

## 11. Conversations = canonical SMS inbox

**`/inbox`** (or MCTB-filtered inbox) — one conversation object, one UI. No duplicate MCTB conversation list separate from inbox. Legacy `/voice/conversations` redirects to canonical inbox.

---

## 12. Canonical page tree

```
MCTB
├── Home
├── Missed Calls → Missed Call Detail
├── Conversations → Conversation Detail
├── Analytics
├── Setup
│   ├── Phone & Forwarding
│   ├── What Counts as Missed
│   ├── Text Back
│   ├── Consent
│   ├── Hours
│   ├── Follow-up Rules
│   ├── Links & Request Form
│   ├── Exclusions
│   └── Test & Activate
├── Numbers
└── Settings (General, Notifications, Team, Advanced MCTB)
```

---

## 13. Feature → canonical home (summary)

| Capability | Canonical home |
|------------|----------------|
| Today KPIs, recovery on/off, setup health | Home |
| Missed-call list, detail, timeline | Missed Calls |
| SMS replies, assignment, notes | Conversations |
| Aggregate metrics | Analytics |
| All configuration (forwarding, triggers, messages, consent, hours, cooldown, links, form, exclusions, test) | Setup (sections) |
| Sender/TFV/10DLC | Numbers / Business texting |
| Integrations | Shared Transovo Integrations |
| Business profile, security | Shared Settings |

---

## 14–31. Page specifications (summary)

Detailed specs for Home, Missed Calls, Missed Call Detail, Conversations, Analytics, Setup sections (Phone & Forwarding through Test & Activate), Numbers, premium dedicated local texting, Settings, Integrations, and public request form are defined in sections 14–34 of the approved product map. Key principles:

- **Home:** Dashboard archetype; Finish setup OR View missed calls; needs-attention only when real; no setup wall when complete.
- **Missed Calls:** List; no "create" action; semantic table; drawer detail.
- **Detail:** Timeline is canonical diagnostic; separate Recovery / Consent / Reply / Follow-up state chips.
- **Conversations:** Master-detail inbox; MCTB-filtered; sender context visible.
- **Analytics:** MCTB-only metrics; no voice-AI dump.
- **Setup:** Wizard (first-time) + sectioned config (existing); 9 sections — not 11 sidebar items.
- **Phone & Forwarding:** Business number ≠ forwarding destination; verification is deterministic.
- **Consent:** Press-1 vs existing permission — never Manual/Automatic labels.
- **Press-1 SMS:** System compliance confirmation (locked) + business opener (editable).

---

## 35. Canonical status language

### Recovery
Eligible | Scheduled | Sending | Sent | Delivered | Suppressed | Failed

### Consent
Captured | Existing permission | Not captured | Opted out | Unknown

### Sender
Ready | Registration required | Pending | Needs information | Rejected | Suspended

### MCTB service
Active | Paused | Needs attention | Setup incomplete

---

## 36. Canonical reason codes (backend)

`recipient_opted_out`, `business_exclusion`, `cooldown_active`, `message_limit_reached`, `no_phone`, `sender_registration_required`, `sender_pending`, `sender_unavailable`, `consent_not_available`, `press_1_not_completed`, `outside_allowed_window`, `provider_suppression`, `delivery_failed`

UI translates; one vocabulary — no per-screen guessing.

---

## 37. Operational status hierarchy

Healthy = quiet ("Recovery active"). Problems deserve prominence. No celebration wall of green checkmarks.

---

## 43. Privacy/compliance enforcement

**One deterministic eligibility engine** for: automatic recovery, manual reply, scheduled retry, workflows, AI reply, bulk, API, integrations. Recheck immediately before delivery.

---

## 44–46. Data, security, time, i18n

- All MCTB data tenant-scoped; server-enforced auth; consent evidence not normally editable.
- Authoritative instants per event type; business hours = IANA timezone civil schedule.
- Translation-ready strings; versioned consent copy per language.

---

## 48. Legacy cleanup

| Surface | Treatment |
|---------|-----------|
| `/voice/setup` | Preserve engine; rebuild presentation |
| `/solutions/missed-call-text-back/setup` | Redirect only |
| `/agents/john` | Redirect / remove from IA |
| `/voice/conversations` | Consolidate to canonical inbox |
| `/inbox` | Canonical conversations |
| MCTB APIs, eligibility, SIP runtime | Preserve |

---

## 49. Route contract (conceptual)

`/mctb`, `/mctb/missed-calls`, `/mctb/missed-calls/:id`, `/mctb/conversations`, `/mctb/analytics`, `/mctb/setup`, `/mctb/numbers`

Old routes may redirect; one conceptual architecture matters more than URL renames.

---

## 51. Implementation order

1. Audit routes/components/runtime  
2. Freeze business/runtime logic  
3. Canonical IA manifest  
4. Status/reason vocabulary  
5. Map surfaces to canonical home  
6. Consolidate nav → shell → components  
7. Kimi page specs + integrate  
8. Reconnect real data; remove fake controls  
9. Six states, responsive, a11y  
10. Consent/compliance tests, browser journeys, PSTN test  
11. Cross-page consistency; redirect legacy  

---

## 52. Page-state matrix (mandatory)

Every MCTB page: **empty, loading, error, degraded, success** — see governance rules.

---

## 53. Certification journeys

A: New customer Press-1 end-to-end  
B: Existing-permission mode  
C: Suppression / opt-out at delivery time  
D: Repeat caller / cooldown  
E: Setup forwarding failure with retained config  
F: Sender needs attention while voice continues  

---

## 54. Final sidebar (locked)

```
Missed Call Text Back
  Home | Missed Calls | Conversations | Analytics
Configure: Setup | Numbers
Settings
```

Contextual: Business texting, Integrations, Try It, Exclusions, Consent editor, Tests, Request forms.

---

## Kimi instruction

Screenshots are **not** architectural authority. Preserve content/functionality; reorganize to approved IA. Do not reproduce legacy sidebar placement or duplicate configuration.
