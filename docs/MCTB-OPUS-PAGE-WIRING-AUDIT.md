# MCTB Opus (Stage 2) page wiring audit

**Date:** 2026-09-27  
**Branch:** `cursor/mctb-critical-path-perf-2304`  
**Scope:** Missed Call Text Back primary nav under Stage 2 (`isNewUiStage2Enabled()`). Shared product nav (Numbers, Settings, generic `/conversations`) is out of scope.

## How to re-run

```bash
npm run audit:mctb-opus-page-wiring
npm run verify:mctb-stage2-demo-state
```

Connected shells must not import `sandbox-data` (enforced by `verify:mctb-stage2-demo-state`).

## Runtime write map (UI → pipeline)

| Route | Saves that affect live MCTB |
|-------|-----------------------------|
| Setup → Consent | `consentMode`, attestation → TeXML press-1 vs existing_consent |
| Setup → Text back | `messageTemplate` → recovery SMS body |
| Setup → Recovery | triggers, pause, cooldown, delay, max messages → eligibility / scheduling |
| Setup → Phone | onboarding carrier/ring, forwarding test → CFNA verification only |
| Setup → Voicemail | greeting + `sendAfterVoicemail` trigger |
| Setup → Exclusions | exclusion list → send eligibility |
| Setup → Links | `defaultLinkUrl`, request form → message variables / public form |
| Setup → Notifications | handoff recipients |
| Setup → Test | `POST /api/mctb/live-test` → real ingress test |
| Missed calls list | row exclusion → exclusions API |
| Inbox (`/mctb/conversations`) | outbound reply → shared SMS send path |
| AI Recovery | lead-recovery config → automated follow-up SMS |

Read-only but authoritative: Overview, Analytics, Missed call detail, Consent history, Voicemail inbox.

## Chrome / cross-page context

- `GET /api/mctb/shell-context` → `loadMctbShellContextData()` (business line resolver, real sender E164, timezone).
- `OpusWorkspaceDataProvider` feeds sidebar + inbox header (no `BUSINESS` sandbox fallback).

## Business line display

Cert workspaces may still store `+15555550188` in `customFieldsConfig.mctb.businessLineE164`. UI and APIs use `resolveMctbWorkspaceBusinessLineE164()` so onboarding `businessNumberE164` wins over the cert placeholder. **Setup → Phone** shows the resolved line read-only; changing the stored line uses `POST /api/mctb/setup` (`businessLineE164`) or onboarding `businessNumberE164` (wizard) — dedicated inline editor not yet on Phone page.

## Mirror vs connected

`src/newui-transplant/mirror/routes/mctb/**` still references `sandbox-data` for design preview when `wired` is omitted. Production app routes import `connected/mctb/*` only when Stage 2 is on.

## Known follow-ups (non-blocking)

- Inline edit for business line on Setup → Phone (API already supports save).
- Full browser certification per `docs/V1-PRODUCTION-CERTIFICATION.md` (live PSTN/SMS).
