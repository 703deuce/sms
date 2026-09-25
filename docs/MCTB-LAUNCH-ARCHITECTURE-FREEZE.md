# MCTB launch architecture freeze

**Status:** FROZEN for visual UI/UX polish phase (Pass 6 complete).  
**Scope:** Missed Call Text Back customer product — not Voice receptionist, not mass SMS.

## 1. Product definition

MCTB recovers missed calls through compliant SMS: missed call → consent/eligibility → recovery text → conversation → follow-up. Not PBX, not CRM, not marketing campaigns.

## 2. Final nav (MCTB local)

1. Overview — `/mctb`
2. Missed Calls — `/mctb/missed-calls`
3. Inbox — `/mctb/conversations`
4. AI Recovery — `/mctb/ai-recovery`
5. Voicemail — `/mctb/voicemail`
6. Analytics — `/mctb/analytics`
7. Setup — `/mctb/setup`

Shared shell: Integrations, Billing, Settings, Numbers (workspace) per existing product chrome.

## 3. Final route map (summary)

| Route | Class |
|-------|--------|
| `/mctb`, `/mctb/missed-calls`, `/mctb/conversations`, `/mctb/ai-recovery`, `/mctb/voicemail`, `/mctb/analytics`, `/mctb/setup/*` | CANONICAL |
| `/mctb/compliance/consent` | CONTEXTUAL (audit) |
| `/onboarding/mctb` | PROCESS |
| `/f/mctb/:token` | PUBLIC |
| `/mctb/ai-lead-recovery` | REDIRECT → `/mctb/ai-recovery` |
| `/mctb/numbers` | REDIRECT → `/mctb/setup/phone?open=manage` |
| `/mctb/voice-agent` | REDIRECT → `/voice/agents` |
| `/mctb/setup/business-hours`, `follow-up`, `missed-call-rules` | REDIRECT → `/mctb/setup/recovery` |
| `/mctb/calendar`, `/mctb/appointments`, `/mctb/booking`, `/mctb/reminders` | REDIRECT → shared `/appointments/*` |
| `/analytics/mctb` | REDIRECT → `/mctb/analytics` |
| Legacy `/voice/*` MCTB | REDIRECT (preserved) |

## 4. Feature-to-owner matrix (launch)

| Feature | Canonical page | Runtime |
|---------|----------------|---------|
| Forwarding / business line | Setup → Phone | MCTB CFNA / onboarding |
| Consent mode | Setup → Consent | `consent-mode` + TeXML |
| Consent evidence | Compliance consent + Missed Call Detail | consent events |
| Recovery opener | Setup → Text Back | sender-authority + templates |
| Pause / cooldown | Setup → Recovery | schedule + eligibility |
| Exclusions | Setup → Exclusions | eligibility |
| `{{link}}` / request form | Setup → Links | solution config |
| AI Recovery | `/mctb/ai-recovery` | lead-recovery engine |
| Booking link (AI) | AI Recovery | `SEND_BOOKING_LINK` + booking links store |
| Inbox / takeover | `/mctb/conversations` | shared conversations + MCTB handoff |
| Missed call lifecycle | Missed Calls + Detail | `MissedCallEvent` |
| Voicemail ops | `/mctb/voicemail` | voicemail APIs |
| Voicemail config | Setup → Voicemail | greeting studio |
| KPIs | Overview (Today) | overview-kpis |
| Funnel metrics | Analytics | `loadMctbAnalytics` |
| Test | Setup → Test | existing test infra |

## 5–15. Models (frozen)

- **Sender authority:** Pass 1B/1C — PLATFORM vs workspace A2P; no free-form platform composer.
- **Consent:** `press_1` vs `existing_consent` (paid + messaging); server enforcement.
- **AI Recovery:** Simplified UI only — status, business info ref, fields to collect, booking link when entitled.
- **Booking link:** One persisted link source; AI Recovery controls offer; analytics use `BOOKING_LINK_SENT`.
- **Inbox:** Operational; MCTB handoff/takeover; not generic AI Assist.
- **Voicemail:** Ops vs Setup split; cross-links to missed call / inbox where data exists.
- **Setup:** Nine sections (incl. Links for `{{link}}`).
- **Analytics:** Truthful funnel; no revenue/booking proxies.
- **Overview:** Four KPIs + needs attention + recent activity.
- **Contacts / Appointments:** `/contacts`, `/appointments` — not under `/mctb/*`.

## 16. Legacy redirects

See route table §3.

## 17. Dormant runtime

Lead-recovery engine, Text-to-Pay actions, AI_BOOK paths, no-reply follow-up fields may exist in `lib/` without launch UI.

## 18. Launch flags (guard old UI)

| Flag | Purpose |
|------|---------|
| `MCTB_LAUNCH_HIDE_LR_AI_BOOK_UI` | Blocks AI_BOOK in LR UI |
| `MCTB_LAUNCH_HIDE_LR_TEXT_TO_PAY_UI` | Hides TTP |
| `MCTB_LAUNCH_SIMPLIFY_RECOVERY_UI` | Hides no-reply/max-attempt editors |
| `MCTB_LAUNCH_COMPACT_OVERVIEW` | Operational overview layout |
| `MCTB_LAUNCH_COMPACT_SETUP_HOME` | Compact setup index (Pass 4) |

## 19. Deferred (non-blocking)

- Voicemail inbox greeting drawer vs strict Setup-only config (Setup link present).
- Browser/mobile visual polish.
- Live PSTN/SMS certification.
- Post-launch removal of `ai-lead-recovery-page.tsx` presentation.

## 20. Owner certification

Telephony, sender, consent, and full browser matrices still required before production launch.

## Architecture freeze statement

**MCTB PRODUCT ARCHITECTURE FROZEN — READY FOR VISUAL UI/UX POLISH**
