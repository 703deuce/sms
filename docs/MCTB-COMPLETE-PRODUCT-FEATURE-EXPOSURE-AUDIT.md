# MCTB — Complete product / feature exposure / competitive gap audit

**Mode:** Read-only source forensics (no code, schema, nav, or runtime changes).  
**Date:** 2026-09-25  
**Method:** Repository route inventory, navigation tracing, runtime/lib inspection, UI component wiring checks. Competitor names used as a **comparison checklist** only; per-vendor cells are **UNKNOWN** unless noted from the supplied collective inventory (no website re-research).

---

## 1. Executive verdict

Transovo MCTB is **not a thin UI on a demo** — it has a **certified TeXML CFNA ingress**, dual consent modes (`press_1` / `existing_consent`), a **central eligibility engine**, outbound SMS recovery, shared **Conversations** inbox with MCTB filter, operational **missed-call** and **detail** surfaces, setup wizards/editors, **AI Lead Recovery** runtime, optional **visual voicemail** (entitlement-gated), and a **consent log**. That is materially more than “list + send SMS.”

The product is **not yet a coherent standalone MCTB SKU in customer perception** because:

1. **Navigation mixes products** — MCTB V1 nav can show **AI Receptionist** peers (`/voice/overview`, Calls, Receptionist, Knowledge, Call Handling) when `hasVoice` is true (`src/lib/products/mctb-nav.ts`), while canonical MCTB IA docs describe a focused MCTB shell. Customers may not know which product they are configuring.
2. **Exposure gaps are real** — Several runtimes exist without discoverable or wired UI (notably **MCTB handoff / human takeover panel** is implemented but **not mounted** in the inbox thread; only a thin context banner and generic **AI Assist** takeover path appear).
3. **Launch simplification flags** hide or narrow surfaces (`src/lib/mctb/launch-flags.ts`) — AI Book UI, Text-to-Pay, Try It, simplified recovery editor, email-only notifications — without always making “hidden” obvious in setup copy.
4. **Legacy / removed routes** still exist in `MCTB_ROUTES` (`calendar`, `appointments`, `booking`, `reminders`) but **redirect away**; scheduling is **BLUE** (shared Appointments).
5. **Competitor parity is wrong goal** — Transovo should lean into **consent auditability**, **sender-of-record / platform sender**, and **AI recovery depth**, not replicate BeepBack/TxtBack CRM expansion.

**Readiness:** Strong core recovery pipeline; **product decisions** needed on inbox takeover wiring, follow-up policy exposure, callback workflow shape, lightweight outcome/value tracking, and nav purity before IA redesign.

---

## 2. Actual current MCTB navigation

**Primary source:** `buildMctbV1Nav` / `buildMctbV1MobileNav` in `src/lib/products/mctb-nav.ts`, resolved via `resolveProductSidebarNav` in `src/lib/products/resolve-product-nav.ts` when `productShell === "mctb"` or MCTB V1 primary launch.

| Label | Route | Desktop | Mobile | Standalone MCTB | Bundled (+Voice) | Entitlement / condition |
|-------|--------|---------|--------|-----------------|------------------|-------------------------|
| Overview (Voice) | `/voice/overview` | Yes | No | No | Yes | `options.hasVoice` |
| Calls | `/voice/calls` | Yes | Yes (4th slot) | No | Yes | `hasVoice` |
| Receptionist | `/voice/receptionist` | Yes | No | No | Yes | `hasVoice` |
| Knowledge | `/voice/knowledge` | Yes | No | No | Yes | `hasVoice` |
| Call Handling | `/voice/call-handling` | Yes | No | No | Yes | `hasVoice` |
| Overview (MCTB) | `/mctb` | Yes | Home | Yes | Yes | MCTB section |
| Missed Calls | `/mctb/missed-calls` | Yes | Missed | Yes | Yes | — |
| Inbox | `/mctb/conversations` | Yes | Inbox | Yes | Yes | Badge optional |
| Voicemail | `/mctb/voicemail` | Yes | No | Yes | Yes | Add-on entitlement on page |
| AI Lead Recovery | `/mctb/ai-lead-recovery` | Yes | No | Yes | Yes | — |
| Analytics | `/mctb/analytics` | Yes | No | Yes | Yes | — |
| Setup | `/mctb/setup` | Yes | Setup | Yes | Yes | — |
| Integrations | `/integrations` | Yes | No | Yes | Yes | Shared section |
| Numbers | `/voice/numbers` | Yes | No | Optional | Optional | `hasNumbers` |
| Billing | `/settings/billing` | Yes | No | Yes | Yes | Shared |
| Settings | `/settings` | Yes | No | Yes | Yes | Shared |

**Not in primary nav (but routable):** `/mctb/compliance/consent`, `/mctb/setup/*` sections, `/onboarding/mctb`, `/mctb/ai-lead-recovery`, `/mctb/voice-agent`, `/mctb/numbers` (redirects to setup phone), legacy `/voice/*` (redirects in `next.config.ts`), removed scheduling routes (redirects), `/f/mctb/[token]`, `/analytics/mctb`.

**Bundled shell:** `isMctbBundledAiReceptionistPath` keeps Voice overview/calls/knowledge/call-handling/receptionist under MCTB chrome when MCTB V1 primary (`src/lib/mctb/universal-shell.ts`, `mctb-bundled-receptionist-paths.ts`).

**Legacy MCTB shell:** `buildMctbShellNav` in `voice-nav.ts` still serves older `/voice/missed-calls` patterns when not on V1 MCTB nav (evidence: `getMctbPageTitle` maps both `/mctb/*` and `/voice/*`).

---

## 3. Route inventory

| Route | Classification | Notes |
|-------|----------------|-------|
| `/mctb` | CANONICAL | Overview — `loadMctbOverview` + `MctbOverviewView` |
| `/mctb/missed-calls` | CANONICAL | List |
| `/mctb/missed-calls/[id]` | CANONICAL | Detail view |
| `/mctb/conversations` | CANONICAL | Shared inbox, `product=mctb` filter |
| `/mctb/voicemail` | CANONICAL | Gated by `hasMctbBundledVoicemailAccess` |
| `/mctb/analytics` | CANONICAL | API-backed metrics |
| `/mctb/ai-lead-recovery` | ADVANCED | Policy/config UI |
| `/mctb/setup` | CANONICAL | Setup overview |
| `/mctb/setup/start` | COMPATIBILITY REDIRECT | → `/onboarding/mctb` |
| `/mctb/setup/phone` | CANONICAL | Forwarding |
| `/mctb/setup/missed-call-rules` | COMPATIBILITY REDIRECT | → `/mctb/setup/recovery` |
| `/mctb/setup/text-back` | CANONICAL | Message editor |
| `/mctb/setup/consent` | CANONICAL | Consent mode |
| `/mctb/setup/recovery` | CANONICAL | Pause + cooldown (replaces business-hours/follow-up nav) |
| `/mctb/setup/voicemail` | CANONICAL | Greeting config |
| `/mctb/setup/exclusions` | CANONICAL | Exclusions |
| `/mctb/setup/notifications` | CANONICAL | Owner notifications (email-only at launch) |
| `/mctb/setup/links` | CANONICAL | Request form / links |
| `/mctb/setup/test` | FIRST-RUN / ADVANCED | Live test |
| `/mctb/setup/business-hours` | COMPATIBILITY REDIRECT | → recovery |
| `/mctb/setup/follow-up` | COMPATIBILITY REDIRECT | → recovery |
| `/mctb/compliance/consent` | CANONICAL (audit) | Consent log |
| `/mctb/numbers` | COMPATIBILITY REDIRECT | → setup phone manage |
| `/mctb/voice-agent` | ADVANCED / ORPHANED? | Page exists; not in V1 nav |
| `/mctb/calendar`, `/mctb/appointments/*`, `/mctb/booking/*`, `/mctb/reminders` | LEGACY REDIRECT | → conversations or setup recovery (`removed-scheduling-routes.ts`) |
| `/onboarding/mctb` | FIRST-RUN | Wizard |
| `/f/mctb/[token]` | PUBLIC | Request form |
| `/analytics/mctb` | SHARED / ALT | Analytics alias |
| `/voice/missed-calls`, `/voice/setup`, `/voice/analytics`, `/voice/conversations` | COMPATIBILITY REDIRECT | `next.config.ts` → `/mctb/*` |
| `/voice/consent-log` | LEGACY | Still referenced in older nav titles; canonical log is `/mctb/compliance/consent` |
| `/solutions/missed-call-text-back/setup` | LEGACY | Redirect target in docs/manifest |
| API `/api/mctb/*` | INTERNAL (customer via UI) | setup, missed-calls, handoff, lead-recovery, analytics, exclusions, etc. |

**Shared destinations (not duplicated under `/mctb`):** `/integrations`, `/settings`, `/settings/billing`, `/contacts`, `/appointments/*`, `/conversations/saved-replies`, `/voice/numbers` (optional nav).

---

## 4. Runtime architecture summary

```
PSTN → CFNA → TeXML ingress (mctb_texml_final_v1, frozen)
  → press_1: disclosure + Gather 1 OR existing_consent: greeting + hangup
  → missed call capture (lib/mctb/capture/*, agents/missed-call-text-back)
  → eligibility (evaluateMissedCallTextEligibility + mctb/capture/eligibility)
  → consent ledger / attestation
  → SMS recovery (send path, platform sender gates)
  → Conversation (shared inbox, productSource=mctb)
  → optional AI Lead Recovery (lib/mctb/lead-recovery/*)
  → handoff automation state (mctbConversationAutomationState)
  → notifications (lib/mctb/handoff/notifications)
```

Voice ingress is **not** LiveKit for certified MCTB DIDs (`lib/mctb/texml-ingress/frozen-pipeline.ts`, `voice-ingress-guard.ts`).

---

## 5. Master feature matrix (summary)

Full trace columns: Capability | Runtime | Persistence | Config UI | Result UI | Discoverable | Status | Strategic fit | Evidence (file/route).

Below: **representative rows** for all competitor-inventory themes. Status legend: **GREEN / YELLOW / ORANGE / RED / GRAY / BLUE / PURPLE**.

| Capability | Status | Strategic fit | Evidence (abbrev.) |
|------------|--------|---------------|----------------------|
| Missed-call detection | GREEN | KEEP | `eligibility.ts`, `capture/handle.ts`, TeXML |
| Automatic text-back | GREEN | KEEP | `agents/missed-call-text-back/send.ts` |
| Voicemail greeting | GREEN | KEEP | `/mctb/setup/voicemail` |
| Voicemail recording | GREEN* | KEEP | `MctbVoicemailWorkspace`; *add-on entitlement |
| Voicemail transcription | ORANGE | ADD SOON | Runtime varies; UI shows processing states — verify provider path per tenant |
| Press-1 opt-in | GREEN | KEEP (differentiator) | TeXML + consent log |
| Existing-consent mode | GREEN | KEEP | `consent-attestation.ts`, setup consent |
| Dedicated texting / platform sender | GREEN | KEEP | `platform-sender-*`, setup phone/numbers |
| Business number forwarding | GREEN | KEEP | `/mctb/setup/phone`, forwarding guides |
| Forwarding test/verify | GREEN | KEEP | `api/mctb/live-test`, setup test |
| SMS conversations | GREEN | KEEP | `/mctb/conversations` |
| Human takeover + pause automation | YELLOW | ADD FOR LAUNCH (exposure) | Runtime: `handoff/automation-state.ts`, `process-inbound-reply.ts`; UI: `MctbHandoffContextPanel` **not imported** in inbox |
| Quick replies | BLUE | SHARED PRODUCT | `/conversations/saved-replies` — not linked from MCTB nav |
| AI qualification | ORANGE | ADD SOON | Lead Recovery runtime; inbox visibility thin |
| Configurable qualification questions | YELLOW | ADD SOON | `/mctb/ai-lead-recovery` |
| Job type / urgency / address / name extraction | ORANGE | ADD SOON | `lead-recovery` field collection; partial inbox surfacing |
| AI lead summaries | YELLOW | ADD SOON | Handoff snapshot API; panel unwired |
| Emergency detection (SMS) | ORANGE | CONSIDER LATER | `action-runtime.ts` notify paths |
| Owner alerts | YELLOW | ADD SOON | `setup/notifications`; email-only flag |
| Callback queue/workflow | ORANGE | ADD SOON | Callback **events** + follow-up flags; no canonical queue UI |
| No-reply follow-up SMS | ORANGE | ADD SOON | Config `followUpEnabled` often false at launch; UI simplified |
| Business-hours SMS variants | GRAY | DO NOT ADD (as separate msgs) | Spec 12: recovery controls not weekly hours for SMS |
| Recovery pause / cooldown | GREEN | KEEP | `/mctb/setup/recovery` |
| Repeat-call suppression | GREEN | KEEP | `cooldownMinutes` in eligibility |
| Booking links | GREEN | KEEP | `setup/links`, lead recovery SEND_BOOKING_LINK |
| Direct SMS booking (AI Book) | ORANGE | CONSIDER LATER | Runtime exists; `MCTB_LAUNCH_HIDE_AI_BOOK_UI` |
| Calendar integrations | BLUE | SHARED | Appointments + integrations calendars |
| Appointment reminders | BLUE | SHARED | Appointments product |
| Leads page / pipeline | RED / GRAY | DO NOT ADD (full CRM) | No canonical Lead model; missed call + conversation |
| Contacts | BLUE | SHARED | `/contacts` |
| Won/lost / job value | RED | CONSIDER LATER (lightweight) | No MCTB won/value persistence found |
| Returning customer context | YELLOW | ADD SOON | `repeatCaller` on conversation banner |
| Notes | BLUE | SHARED | Contacts / conversation notes patterns |
| STOP/HELP | GREEN | KEEP | Messaging compliance layer |
| Suppression / exclusions | GREEN | KEEP | exclusions setup + eligibility reasons |
| Analytics | YELLOW | ADD SOON | `/mctb/analytics`; some metrics approximate |
| Weekly/monthly email reports | RED | CONSIDER LATER | No MCTB-specific digest found |
| CSV export | ORANGE | CONSIDER LATER | Platform export patterns; not MCTB-prominent |
| Review requests | GRAY | DO NOT ADD in MCTB | Separate product scope |
| Lead win-back (old leads) | RED | DO NOT ADD | Different consent semantics |
| Text-to-Pay | GRAY | OUT OF SCOPE | Hidden via launch flags; runtime remains |
| Teams/workers page | GRAY | DO NOT ADD | Workspace members + inbox assign |
| Multiple locations/lines | ORANGE | CONSIDER LATER | Multi-number in provisioning; UI partial |
| Spanish/multilingual | ORANGE | CONSIDER LATER | i18n standards; MCTB-specific unclear |

---

## 6. Missed-call detection / eligibility

**Runtime:** `src/lib/agents/missed-call-text-back/eligibility.ts`, `src/lib/mctb/capture/eligibility.ts`, classification in `classify.ts`.

**Customer understanding:**

- **GREEN:** Missed call list/detail show status and suppression reason vocabulary (`MissedCallEvent`, detail view).
- **YELLOW:** “Why not texted?” is authoritative in backend but **depends on detail UI** showing `suppressionReason` / eligibility narrative consistently (verify per state in `mctb-missed-call-detail-view`).

**Factors traced:** feature enabled, entitlement/trial, not answered/busy/unreachable rules, carrier forward requirement, spam filter, opt-out, cooldown, landline/invalid phone, pause (`recovery_paused`), exclusions, duplicate idempotency.

---

## 7. Consent & compliance

| Area | Status | Notes |
|------|--------|-------|
| Press-1 path | GREEN | TeXML frozen pipeline; consent before SMS |
| Existing consent + attestation | GREEN | Setup + `consent-attestation.ts` |
| Consent log UI | GREEN | `/mctb/compliance/consent` |
| STOP | GREEN | Shared SMS suppression |
| HELP | PURPLE/ORANGE | Carrier/help templates — trace in messaging lib (not re-run PSTN) |
| Disclosure versioning | YELLOW | Stored in runtime; customer visibility on log/detail |

**Transovo advantage:** Dual provenance paths and audit log — **should be marketed in UI**, not buried in setup.

---

## 8. Text-back configuration

**Route:** `/mctb/setup/text-back` → `MctbSetupTextBackView` → `api/mctb/setup`.

**Expected (spec 10):** Press-1: locked compliance message + editable opener; existing consent: opener flow; preview; segments.

**Status:** **GREEN** for core editor; **YELLOW** if after-hours message variants still appear anywhere (should be GRAY per spec 12).

---

## 9. Conversations / inbox

**Route:** `/mctb/conversations` — `KimiConversationsConnected`, filter `product=mctb`.

| Need | Status |
|------|--------|
| Thread list / unread | GREEN (shared inbox) |
| Manual reply | GREEN |
| Delivery states | YELLOW (depends on thread rendering) |
| MCTB missed-call context | GREEN (`MctbConversationContextBanner`) |
| Qualification / AI summary | YELLOW (API exists; panel unwired) |
| Consent/opt-out in thread | YELLOW |
| Booking actions | GREEN (`MctbConversationBookingActions`) |
| Voicemail link | YELLOW (via missed call detail) |

---

## 10. Human takeover

**Runtime:** `mctbConversationAutomationState` — `human_active`, `shouldBlockAutomation`, owner send sets takeover in `process-inbound-reply.ts`.

**UI:** `MctbHandoffContextPanel` supports take_over / resume_automation / follow_up — **component is never imported** outside its own file (grep only hit definition).

**Inbox:** `InboxAiBanner` + `InboxAiAssistPanel` takeover targets **AI Assist** sessions (`ai-replies`), not necessarily MCTB lead-recovery automation.

**Status:** **YELLOW** (exposure) — **ADD FOR LAUNCH** to wire handoff panel or equivalent into MCTB threads.

---

## 11. Quick replies

**Exists:** `/conversations/saved-replies` (`SavedRepliesConnected`).

**MCTB discoverability:** **RED** from MCTB IA — **BLUE** shared; link from inbox help or MCTB setup optional.

---

## 12. AI Lead Recovery

**UI:** `/mctb/ai-lead-recovery` — full policy/goals editor.

**Runtime:** `lib/mctb/lead-recovery/*` (intent agent, actions, booking link, callback notify).

**Launch flags:** Hide AI Book, Text-to-Pay, simplify recovery UI.

**Status:** **ORANGE** overall — strong runtime, **YELLOW** customer comprehension (inbox does not surface qualification clearly).

---

## 13. No-reply follow-up

**Config:** `followUpEnabled` in lead-recovery config; launch defaults often **false** (`launch-lead-recovery.ts`).

**MCTB agent follow-up:** legacy `followUpEnabled` on phone switch disabled.

**Status:** **ORANGE** — competitor strength; **ADD SOON** with clear compliance bounds, not **ADD FOR LAUNCH** without owner sign-off.

---

## 14. Emergency / urgency

**SMS path:** `lead-recovery/action-runtime.ts` — `urgent_detected`, notifications.

**Status:** **ORANGE** — not a full escalation product; **CONSIDER LATER** for prioritized owner alerts.

---

## 15. Callback workflow

**Runtime:** Callback intent, `followUpStatus` (`called_back`, `resolved`), notifications.

**UI:** Buttons exist on **unwired** handoff panel; no `/mctb/callbacks` queue.

**Status:** **ORANGE** — **ADD SOON** (lightweight queue or missed-call filter), not full FSM.

---

## 16. Voicemail

**Inbox:** `/mctb/voicemail` + setup `/mctb/setup/voicemail`.

**Status:** **GREEN** for entitled workspaces; **ORANGE** transcription depth — provider-dependent.

---

## 17. Phone & forwarding

**Setup:** `/mctb/setup/phone`, APIs, carrier guides, verification evidence.

**Status:** **GREEN** core; **YELLOW** multi-line clarity.

---

## 18. Numbers / A2P / TFV

**Surfaces:** Setup phone, `api/mctb/tfv`, platform sender assignment libs, numbers nav optional.

**Status:** **GREEN** technical split (ingress vs sender); **YELLOW** customer copy distinguishing platform sender vs own 10DLC.

---

## 19. Booking

**MCTB:** Booking links + lead recovery `SEND_BOOKING_LINK`; AI Book hidden at launch.

**Shared:** Appointments platform owns calendar CRUD.

**Status:** **BLUE** for appointment records; **GREEN** for link mode.

---

## 20. Leads

**No canonical `Lead` entity** for MCTB — **missed call**, **conversation**, **contact**, **automation state**.

**Status:** **GRAY** — **DO NOT ADD** standalone Leads page without product decision.

---

## 21. Contacts

**BLUE** — `/contacts` shared; auto-create from calls/SMS likely via messaging layer.

---

## 22. Pipeline / outcomes

**No** won/lost/revenue pipeline in MCTB libs.

**Status:** **RED**; lightweight outcome enum on missed call/conversation **CONSIDER LATER**.

---

## 23. Revenue / value

**RED** — no recovered revenue metrics in `loadMctbAnalytics` (missed, texts, replies, links, voicemail counts).

**Recommendation:** **CONSIDER LATER** — optional “mark won + value” without CRM.

---

## 24. Returning customers

**YELLOW** — `repeatCaller` on conversation banner; history via contact + missed calls.

---

## 25. Notes

**BLUE** — shared contacts/conversation notes if enabled globally.

---

## 26. Notifications

**Setup:** `/mctb/setup/notifications`; `MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY = true`.

**Status:** **YELLOW** — **ADD SOON** for SMS/push recipients if desired post-launch.

---

## 27. Team / workers

**GRAY** — workspace members, inbox assignment; **DO NOT ADD** Workers page.

---

## 28. Multiple locations / lines

**ORANGE** — provisioning supports multiple numbers; per-line MCTB UX not first-class in nav.

---

## 29. Hours / quiet / vacation

**GRAY** for SMS quiet hours as competitor markets — MCTB spec **replaced business-hours page with recovery pause/cooldown** (`/mctb/setup/recovery`). Night missed calls are core use case.

---

## 30. Duplicate / repeat suppression

**GREEN** — cooldown in eligibility + recovery controls.

---

## 31. Analytics

**Route:** `/mctb/analytics` — `loadMctbAnalytics`.

**Trust notes:** `textsSent` uses `smsSentAt || status === SENT`; `linksSent` approximated from `textsSent` — **YELLOW** (label honesty).

---

## 32. Reports

**RED** — no MCTB weekly/monthly customer report (distinct from Voice digest investigation).

---

## 33. Reviews

**GRAY** — separate product; **DO NOT ADD** to MCTB core.

---

## 34. Win-back

**RED** for old-lead campaigns; current recovery is **in-session** missed caller.

---

## 35. Export

**ORANGE** — platform may export contacts; MCTB-specific CSV not prominent.

---

## 36. Settings / billing / support

**BLUE** — `/settings`, `/settings/billing`, support links; contextual links from setup sufficient.

---

## 37. Customer journeys A–J (abbrev.)

| Journey | Verdict |
|---------|---------|
| A First setup | **YELLOW** — wizard + setup overview; Try It disabled; voice bundle nav noise |
| B Press-1 opt-in | **GREEN** runtime; **YELLOW** education |
| C No opt-in | **GREEN** if detail shows no-SMS reason |
| D Existing consent | **GREEN** |
| E Voicemail | **GREEN** with entitlement |
| F AI qualification | **ORANGE** — works in SMS; inbox weak |
| G Booking | **GREEN** link path; **ORANGE** AI book |
| H Human takeover | **RED** customer path — panel unwired |
| I STOP | **GREEN** |
| J Repeat call | **GREEN** cooldown |

---

## 38. UI without function (reverse audit samples)

| Control | Finding |
|---------|---------|
| `MctbHandoffContextPanel` | **DEAD** — not mounted |
| Try It nav / CTAs | **DISABLED** by launch flag — ok if hidden |
| Text-to-Pay in LR UI | **HIDDEN** — runtime remains (**LEGACY / OUT OF SCOPE**) |
| `/mctb/setup/missed-call-rules` | **REDIRECT** only — ok |
| Disabled “Add endpoint” on old webhooks page | Fixed in Voice remediation branch — N/A MCTB |
| AI Book toggles | **HIDDEN** at launch |

---

## 39. Runtime without UI (samples)

- Handoff snapshots / captured fields API — partial surfacing  
- Lead recovery policy edges (follow-up, payment) — hidden  
- Pipeline trace — operator-only logs  
- Admin test bootstrap — internal  

---

## 40. Competitor comparison matrix

**Rule:** Competitor columns = **UNKNOWN** (no per-vendor repo evidence). Collective inventory = checklist only.

| Capability | Transovo | BeepBack | TxtBack | Others | Transovo status |
|------------|----------|----------|---------|--------|-----------------|
| (all inventory rows) | traced above | UNKNOWN | UNKNOWN | UNKNOWN | see §5 |

Use collective list as **market coverage map**, not parity scorecard.

---

## 41. Transovo advantages

- Press-1 + existing-consent **dual mode** with consent log  
- **Sender-of-record / platform sender** architecture  
- **Suppression ≠ failed** domain language  
- **Frozen TeXML** production ingress  
- **AI Lead Recovery** depth (when exposed)  
- **Shared** Contacts, Appointments, Integrations, Compliance  
- Optional **visual voicemail** add-on  

---

## 42. Meaningful competitor advantages (likely)

- **Inbox polish** — takeover, qualification visible in thread  
- **No-reply follow-up** messaging  
- **Callback queue** UX  
- **Simple ROI** — won/value on recovered leads  
- **Quick replies** discoverability  

---

## 43. Unnecessary competitor features (for Transovo MCTB)

- Full **pipeline CRM**, **workers**, **standalone calendar**, **review campaigns inside MCTB**, **field-service job costing**, **text-to-pay** (removed from launch), **SMS quiet hours that block night recovery**.

---

## 44. Provisional ownership map (no IA redesign)

| Capability | Owner | Route |
|------------|-------|-------|
| Missed calls / detail | MCTB | `/mctb/missed-calls` |
| Conversations | Shared inbox | `/mctb/conversations` |
| Voicemail ops | MCTB | `/mctb/voicemail` |
| Voicemail config | MCTB setup | `/mctb/setup/voicemail` |
| Consent log | MCTB compliance | `/mctb/compliance/consent` |
| AI Lead Recovery config | MCTB | `/mctb/ai-lead-recovery` |
| Contacts | Platform | `/contacts` |
| Appointments | Platform | `/appointments` |
| Numbers/A2P | Shared | `/voice/numbers`, setup |
| Saved replies | Platform | `/conversations/saved-replies` |
| Billing/settings | Platform | `/settings/*` |

---

## 45. Bucket 1 — KEEP / ALREADY COMPLETE

TeXML ingress, eligibility, dual consent, recovery SMS, missed calls list/detail, setup phone/consent/text-back/recovery/exclusions, consent log, shared inbox, cooldown/pause, exclusions, STOP handling, booking links, analytics baseline, onboarding wizard, public request form.

---

## 46. Bucket 2 — FIX EXPOSURE

- Wire **human takeover / resume** UI to MCTB conversations  
- Surface **qualification summary / urgency / callback state** in inbox  
- Clarify **analytics** definitions (links sent, reply rate denominator)  
- **Discoverability** of saved replies from MCTB context  
- Reduce **bundled Voice nav confusion** when selling standalone MCTB  
- Consent advantage **copy** on overview/setup  

---

## 47. Bucket 3 — ADD BEFORE LAUNCH (keep small)

1. **Inbox handoff takeover** wired to `api/mctb/handoff/*` (exposure of existing runtime).  
2. **“Why no SMS?”** consistent on missed call detail/list (if any gap found in UI review).  

*Owner may shrink further — no new CRM pages.*

---

## 48. Bucket 4 — ADD AFTER LAUNCH

- No-reply follow-up policy (with compliance review)  
- Callback queue or filtered workspace  
- Lightweight **outcome + optional job value** on missed call/conversation  
- Returning-customer history chip expansion  
- SMS/multi-recipient notifications  
- CSV export for missed calls  
- Transcription reliability UX  

---

## 49. Bucket 5 — DO NOT ADD

- Standalone **Leads** CRM, **pipeline**, **workers**, **MCTB calendar**, **review requests**, **win-back campaigns**, **text-to-pay**, **competitor-style quiet hours**, duplicate **contacts** under `/mctb`.

---

## 50. P0 / P1 / P2 / P3 findings

| Priority | Finding |
|----------|---------|
| **P0** | None identified in static audit (runtime pipeline present) |
| **P1** | Human takeover UI not wired in MCTB inbox despite runtime |
| **P1** | Product shell mixes Voice + MCTB nav when bundled — confuses standalone SKU |
| **P2** | AI Lead Recovery value not visible in conversation thread |
| **P2** | Analytics metrics may mislead (links sent proxy) |
| **P2** | No-reply follow-up not customer-configurable at launch |
| **P3** | `/mctb/voice-agent` orphan route |
| **P3** | Legacy scheduling routes in constants (redirect only) |

---

## 51. Files / routes / APIs inspected (representative)

- Nav: `mctb-nav.ts`, `resolve-product-nav.ts`, `universal-shell.ts`, `mctb-bundled-receptionist-paths.ts`, `voice-nav.ts`  
- Routes: `src/app/(app)/mctb/**`, `next.config.ts` redirects  
- Runtime: `lib/agents/missed-call-text-back/*`, `lib/mctb/capture/*`, `lib/mctb/texml-ingress/*`, `lib/mctb/handoff/*`, `lib/mctb/lead-recovery/*`, `lib/mctb/analytics.ts`  
- UI: `components/mctb/**`, `components/inbox/conversations-thread-area.tsx`, `kimi-conversations-connected`  
- APIs: `app/api/mctb/**`  
- Launch: `lib/mctb/launch-flags.ts`  
- Prisma models referenced: `MissedCallEvent`, `mctbConversationAutomationState`, `IntegrationWebhookEndpoint` (not MCTB outbound)  

---

## 52. Uncertainties requiring owner decision

1. Standalone MCTB SKU: **hide Voice nav entirely** when customer only buys MCTB?  
2. Is **AI Assist takeover** intended to replace MCTB handoff or complement?  
3. **No-reply follow-up**: launch scope vs post-launch?  
4. **Lightweight won/value** on missed call vs no revenue fields?  
5. **Voicemail add-on** default bundled or always upsell?  
6. **AI Book over SMS** — ever in MCTB or Appointments-only?  

---

## 53. Recommended next pass

1. **Product decision meeting** — approve Buckets 2–5 (no IA yet).  
2. **Exposure remediation** — wire handoff panel; inbox qualification strip; analytics labels.  
3. **Nav experiment** — standalone MCTB without Voice peers.  
4. **PSTN/SMS certification** — Press-1, existing consent, STOP, forwarding verify (owner).  
5. **Then** MCTB IA redesign against approved feature set (not competitor nav).  

---

## Appendix A — Trace template (for extended rows)

For each capability, auditors should record: Runtime/backend | Persistence | Config UI | Save path | Runtime consumer | Result UI | Action UI | Analytics | Notifications | Route | Discoverable | Status | Strategic class | Evidence path.

---

**MCTB COMPLETE PRODUCT AUDIT FINISHED — READY FOR PRODUCT DECISIONS**
