# MCTB + AI Receptionist navigation direction

**Status:** Implemented in product chrome (label + grouping).  
**Authority:** Product decision post `TRANSOVO-ROSIE-SMITH-PRODUCT-SURFACE-AUDIT.md` — discoverability, not Rosie-style rebuild.

## Principles

1. **Two navigation groups, one shell** — `AI Receptionist` (above) and `Missed Call Text Back` (below). Not separate product switchers.
2. **Global Call Handling switcher** — sole ownership control for which product answers the canonical ingress DID. Do not add switchers on Calls, Setup, or the wizard.
3. **Wizard stays** — `AI Agent` → `/mctb/voice-agent` (Purpose → … → Activate). No Rosie-style 12-page settings split.
4. **Inbox ≠ Calls** — SMS/recovery at `/mctb/conversations` (nav label **Inbox**); PSTN history at `/voice/calls` (nav **Calls**). No unified omnichannel inbox.
5. **Reuse implementations** — Calls list/detail remain `/voice/calls`; no MCTB fork.

## Sidebar (when `hasVoice`)

| Section | Items |
|---------|--------|
| AI Receptionist | Overview (`/voice/overview`), Calls, AI Agent (`/mctb/voice-agent`), Knowledge, Call Rules (`/voice/inbound-routing`) |
| Missed Call Text Back | Overview, Missed Calls, Inbox, Voicemail, AI Lead Recovery, Analytics, Setup |
| Shared | Integrations, Numbers (when entitled), Billing, Settings |

Mobile: Home, Missed, Inbox, Calls (when voice), Setup.

## Deferred (do not block launch)

- **Rename** `/voice/inbound-routing` nav copy vs global “Call Handling” — consider **Receptionist routing** or **Call rules** in a dedicated naming pass.
- **Product shell tabs** — AI Receptionist as its own switcher tab vs grouped nav under MCTB-first launch.
- **Voice Agent route** — `/mctb/voice-agent` remains compatibility entry; long-term home under AI Receptionist product surface only.

## Out of scope

- Rosie/Smith feature parity (GBP ingestion, web chat, unified conversations).
- Merging Inbox and Calls.
- Text-to-Pay in MCTB AI Lead Recovery UI.
