# Softphone (Human Phone) — Feature Status

**Updated:** 2026-08-01 (finish audit + gap close)  
**Product surface:** `/phone` (Business Softphone)  
**Scope:** Browser WebRTC + Call my phone / cellular. AI voice agent is out of scope.

| Status | Meaning |
|--------|---------|
| **Wired** | UI + API + runtime linked end-to-end |
| **Wired + env** | Same; live media/push needs Telnyx/VAPID/Brevo |
| **External** | Intentionally not in-product |

---

## Calling, controls, transfer / park / conference

| Feature | Status | Notes |
|---------|--------|-------|
| Outbound WebRTC / Call Control / Call my phone | **Wired + env** | |
| Answer (WebRTC invite or cellular flip) | **Wired + env** | Held Call Control / queue / hunt require cellular for audio |
| Hold / mute / hangup / DTMF / disposition | **Wired** | Mute promotes Call Control to conference when needed |
| Blind + warm transfer | **Wired + env** | |
| Call flip | **Wired + env** | |
| Park + timeout / fallback | **Wired + env** | |
| Conference create / add / remove / end | **Wired + env** | |
| Merge two lines | **Wired + env** | |
| Recording start/stop + playback proxy | **Wired + env** | |
| Softphone-only screening Accept / Decline | **Wired + env** | Accept requires cellular (no browser audio on held CC leg) |
| Supervisor listen / whisper / barge | **Wired + env** | Join failures surface in notes / API error |
| Sequential hunt (forwarding) | **Wired + env** | Ring legs hung up on timeout / advance |
| Simultaneous hunt | **Wired + env** | Ring legs hung up on ring timeout |
| Queue ring_all / RR / longest_idle | **Wired + env** | |
| Queue linear / sequential hunt | **Wired + env** | Notes preserve members/index; notify active member only |
| Queue callback overflow | **Wired** | Softphone banner + Call back (no auto-dial) |
| Forwarding `device` target | **Wired** | |
| `ringDesktop` honor on push | **Wired + env** | |
| Self-service cellular / ring / screening / DND | **Wired** | Non-admins can save own settings |
| Softphone ACL admin (teammate + full keys) | **Wired** | |
| Presence / devices / heartbeat | **Wired + env** | |
| Contacts / history / Return / Call back | **Wired** | |
| IVR + queue CRUD (admin gated) | **Wired + env** | |
| Voicemail leave / list / playback / email notify | **Wired + env** | Email needs Brevo |
| Per-number phone-first vs AI | **Wired** | |
| Readiness panel | **Wired** | |

---

## Intentionally external only

| Item | Status |
|------|--------|
| Native iOS / Android softphone apps | **External** |
| OS Bluetooth beyond browser headset APIs | **External** |
| Carrier CNAM writeback | **External** |
| Third-party spam-network feeds | **External** |

---

## Operational notes

- **Queue / hunt / screening audio:** PSTN leg is answered+held for hold music. Softphone Accept/Answer without a WebRTC invite bridges via **Call my phone** (cellular). Set cellular under Phone settings or the softphone panel.
- **Callback overflow:** Records `callback_requested` and shows a softphone banner; agent clicks **Call back** (does not auto-dial).
- **Schema:** `npm run db:push` or `supabase/voice-softphone-checklist.sql`.

## Env checklist

```
TELNYX_API_KEY
TELNYX_CONNECTION_ID
TELNYX_PUBLIC_KEY
TELNYX_TELEPHONY_CREDENTIAL_ID
APP_URL
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
OPENAI_API_KEY   # optional transcripts
BREVO_API_KEY    # optional voicemail email
```

## Code map

| Area | Path |
|------|------|
| Softphone UI | `src/components/phone/softphone-panel.tsx` |
| Human calls | `src/lib/phone/human-call-service.ts` |
| Supervisor | `src/lib/phone/supervisor-service.ts` |
| Hunt groups | `src/lib/phone/hunt-service.ts` |
| Inbound / IVR / queues | `inbound-runtime.ts`, `ivr-service.ts`, `queue-runtime.ts` |
| APIs | `src/app/api/phone/**` |
