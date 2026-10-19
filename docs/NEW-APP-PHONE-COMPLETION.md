# Transovo Phone (`new-app`) — completion status

**Last updated:** 2026-10-19  
**Scope:** Business phone product under `/app/phone/*` + global softphone chrome.

## Product surfaces (all implemented)

| Surface | Route | Backend |
|---------|-------|---------|
| Overview | `/app/phone` | `analytics`, `listCalls`, `readiness`, numbers inventory |
| Dialer | `/app/phone/dialer` | WebRTC + `POST /api/phone/calls` outbound |
| Power Dialer | `/app/phone/power-dialer` | `/api/phone/power-dialer/*` |
| Calls | `/app/phone/calls`, `[id]` | `humanCall` + notes + recording stream |
| Call handling | `/app/phone/call-handling` | routing, hours, voicemail greeting, transfer targets |
| Analytics | `/app/phone/analytics` | `GET /api/phone/analytics` |
| Numbers | `/app/phone/numbers` → `/app/numbers` | shared inventory |

## Live calling (softphone)

| Capability | Implementation |
|------------|----------------|
| Register WebRTC | `/api/phone/webrtc-token`, TelnyxRTC singleton |
| Outbound PSTN | `registerOutboundCall` + SDK `newCall` |
| Inbound ring / answer / decline | SDK notifications + `ringing-inbound` + bridge on Telnyx events |
| Mute / hold | SDK `muteAudio` / `hold` on active call bar |
| Transfer | `POST /api/phone/calls/:id/transfer` + in-call UI + saved targets |
| Hang up | SDK `hangup` |

## Routing & voicemail

| Capability | Implementation |
|------------|----------------|
| Business hours | `workspaceMessagingSettings` — editor on Call handling |
| Inbound route | `decideInboundRoute` + WebRTC bridge |
| No-answer / timeout | Voicemail, external forward, or missed |
| Agent leg no-answer | `handleInboundAgentLegNoAnswer` |
| Voicemail greeting | `workspaceCallRouting.greetingText` + TTS runtime |
| External forward | `policy.externalForwardE164` + env fallback |

## Data integrity (no demo fixtures on Phone paths)

- Call detail: contact, line, notes from Prisma/DTO  
- Calls list (phone): `fetchCalls` + owned number filter  
- Business hours: live API  
- Transfer targets: `workspacePhoneSettings.prefsJson`  

## Verification commands

```bash
cd new-app && pnpm test:phone
node scripts/test-new-app-inbound-telnyx-contract.mjs
PHONE_TEST_BASE_URL=https://transovo.ai pnpm test:phone:prod
# Optional pinned call: PHONE_TEST_CALL_ID=cmvf8iljt002kl30kaxntx9hj
```

## Engineering status

**Complete.** All Phone V1 surfaces, APIs, softphone controls (mute, hold, transfer), power dialer, routing, business hours, voicemail greeting, external forward, recording resolve/stream, and live data on Phone call surfaces are implemented on branch `cursor/new-app-phone-stabilization-f350` (PR #707).

Automated smoke: `node new-app/scripts/test-phone-complete.mjs` (with `PHONE_TEST_BASE_URL` when not on localhost).

## Post-deploy validation (real PSTN)

After Coolify ships the merge commit, confirm on a production workspace:

1. Outbound two-way audio  
2. Inbound two-way audio (human confirmation — logs alone are insufficient)  
3. Recording play + download on call detail  
4. Voicemail after no-answer  
5. External forward / live transfer  
6. Power dialer: list → campaign → session → dial → disposition  

These are **live Telnyx checks**, not open engineering tasks.
