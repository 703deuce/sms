# MCTB launch UI wiring — ten review rounds (pass 2)

**Branch:** `cursor/mctb-ui-wiring-audit-f350`  
**Follows:** `docs/MCTB-UI-BACKEND-WIRING-AUDIT-10-ROUNDS.md` (pass 1)  
**Goal:** Re-scan entire launch inventory; close all remaining monitor items and harden fetch/save feedback.

---

## Round 11 — Voicemail operational inbox

| File | Finding | Fix |
|------|---------|-----|
| `voicemail-page.tsx`, `voicemail-messages-panel.tsx` | Inbox fetch ignored HTTP errors; mark-reviewed failures still refreshed list | `fetchMctbVoicemailInboxPayload()` + load/action alerts |

## Round 12 — Missed calls list mutations

| File | Finding | Fix |
|------|---------|-----|
| `missed-calls-page.tsx` | List fetch ignored `!res.ok`; row exclusion errors uncaught | `res.ok` + `loadError` / `exclusionError` |

## Round 13 — Onboarding operational recovery + AI

| File | Finding | Fix |
|------|---------|-----|
| `mctb-onboarding-operational-steps.tsx` | Resume used `enabled: true` without clearing pause; pause/resume errors silent; AI section load/save swallowed | `resumeRecovery()` / `pausePreset` with errors; AI load/save UI |

## Round 14 — IA recovery usage + text-back meta

| File | Finding | Fix |
|------|---------|-----|
| `mctb-ia-pages.tsx` | Usage stat fetch silent; stale setup cache | `fetchMctbSetup({ force: true })` + `usageError`; text-back meta fallback on failure |

## Round 15 — AI Recovery page load path

| File | Finding | Fix |
|------|---------|-----|
| `ai-recovery-page.tsx` | `!ctxRes.ok` returned empty UI with no message | `loadError` alert |

## Round 16 — Text-back & consent editors

| File | Finding | Fix |
|------|---------|-----|
| `text-back-editor.tsx` | Setup load ignored `!res.ok` | `loadError` |
| `consent-editor.tsx` | Setup load ignored `!res.ok` | `loadError` |

## Round 17 — Booking links surfaces

| File | Finding | Fix |
|------|---------|-----|
| `mctb-booking-link-section.tsx`, `mctb-setup-links-editor.tsx` | Parallel reload did not check `linksRes`/`setupRes` | Throw + surface `error` state |

## Round 18 — Notifications recipients

| File | Finding | Fix |
|------|---------|-----|
| `setup-pages.tsx` | `void n.save()` on add/edit with no feedback | `saveRecipients()` + `recipientSaveError` |

## Round 19 — Conversations composer

| File | Finding | Fix |
|------|---------|-----|
| `conversations-page.tsx` | Manual-reply gate used cached setup; send with missing phone returned silently | `{ force: true }`; throw when no `to` |

## Round 20 — Regression grep (pass 2)

Re-ran connected + components `mctb/**` for silent user-action fetches. Remaining `.catch(() => undefined)` limited to non-critical paths (e.g. audio `play()`, optional header meta network blips). **No launch-blocking wiring gaps identified.**

---

## Verdict (pass 2)

Monitor items from pass 1 (recovery usage stat, onboarding AI toggle) are **fixed**. Launch surfaces now check authoritative HTTP responses on load/save paths traced in both passes. Browser/production certification remains a separate gate.
