# Voice V3 — connection greeting vs Amy opening

## Problem

Wizard agents often enable a **connection greeting** (hold/bridge audio) while Amy also has a configured **opening greeting**. Callers can hear two introductions. Amy prompts must coordinate modes without assuming every regression is prompt-only.

## What the web layer knows today

Amy instructions use `resolveConnectionGreetingRole()` in `src/lib/voice-v3/prompts/effective-prompt-capabilities.ts`:

| Role | Meaning | Amy behavior |
|------|---------|--------------|
| `none` | No connection greeting configured | Full configured opening greeting once |
| `holding` | Short connect/hold audio (Transovo presets, typical hold copy) | Business introduction once; do not repeat the hold line |
| `full_business` | Connection copy substantially matches opening greeting | Short offer of help only; no second long welcome |

Classification uses `telephony.connectionGreetingMode`, `connectionGreetingText`, and comparison to `conversation.openingGreeting`. **Playback completion is not yet wired** from the Python worker or Telnyx/LiveKit bootstrap into session state.

## What we do not know without call logs

A **phantom caller turn** (Amy responds as if the caller spoke) may come from:

- Connection greeting audio in the model input
- Echo / loopback
- Residual playback after greeting
- VAD / endpointing
- Transcript events without real speech

Treat these as **media/runtime evidence** problems. Prompt changes reduce duplicate greetings; they do not certify VAD correctness.

## Minimal future hook (not implemented here)

If the runtime exposes `connection_greeting_playback_status` (started / completed / skipped) on the LiveKit session bootstrap payload, Amy instructions should prefer that signal over mode-only inference.

## Related code

- Wizard UI: `src/components/solutions/appointment-receptionist/steps/phone-step.tsx`
- Amy greeting section: `buildAmyGreetingSection()` in `live-frontend-instructions.ts`
- Default hold copy: `DEFAULT_CONNECTION_GREETING` in `appointment-receptionist/defaults.ts`
