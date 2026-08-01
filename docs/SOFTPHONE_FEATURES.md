# Softphone (Human Phone) — Feature Status

**Updated:** 2026-08-01 (full human-call re-audit + fix pass)  
**Product surface:** `/phone` (Business Softphone)  
**Scope:** Browser WebRTC + Call my phone / cellular. **AI voice agent is out of scope.**

Status legend:

| Status | Meaning |
|--------|---------|
| **Wired** | UI + API + runtime linked end-to-end |
| **Wired + env** | Same; live media/push needs Telnyx/VAPID env |
| **External** | Intentionally not in-product |

---

## 1. Calling core

| Feature | Status | Notes |
|---------|--------|-------|
| Outbound WebRTC | **Wired + env** | Creates HumanCall first, then TelnyxRTC; `clientState` carries humanCallId |
| Outbound Call Control | **Wired + env** | Only when Call my phone is on, or mock mode (no orphan PSTN dial) |
| Call my phone | **Wired + env** | DND + international gated; bridges only after destination answers |
| Multi-line outbound | **Wired** | Auto-holds active line; redial places second line |
| Answer WebRTC invite | **Wired + env** | Links / dedupes HumanCall |
| Answer Call Control poll | **Wired + env** | Requires your cellular for audio when no WebRTC invite |
| Decline | **Wired** | Always PATCHes HumanCall `missed:declined` |
| Hang up | **Wired** | Tears down primary + secondary legs; clears presence |
| Remote hangup UI clear | **Wired** | Poll removes line when status is terminal |
| Redial | **Wired** | |
| Click-to-call / history Return | **Wired** | `/phone?dial=` |
| Caller ID selection | **Wired** | Request → user default → workspace default |
| Anonymous dial | **Wired + env** | ACL-gated in UI |
| International guard | **Wired** | |

---

## 2. In-call controls

| Feature | Status | Notes |
|---------|--------|-------|
| Mute / unmute | **Wired** | WebRTC local mute; conference mute via Telnyx conference API |
| Hold / resume | **Wired** | |
| Switch line | **Wired** | Hangup promotes next line |
| Call waiting | **Wired** | Stale waiting banners pruned |
| DTMF | **Wired** | |
| Call notes | **Wired** | |
| Call timer | **Wired** | |

---

## 3. Transfer, park, conference, flip

| Feature | Status | Notes |
|---------|--------|-------|
| Blind transfer | **Wired + env** | Control-link + transfer ACL gated |
| Warm transfer | **Wired + env** | Complete disabled until consult answered (server + UI) |
| Park / retrieve | **Wired + env** | Slot collision-safe; parked list in softphone; cross-device retrieve flips to cell |
| Conference create / add / end | **Wired + env** | End conference action wired |
| Merge held lines | **Wired + env** | Drops secondary WebRTC line after merge |
| Call flip | **Wired + env** | Detaches browser media without wiping HumanCall UI |

---

## 4. Recording, transcription, notes

| Feature | Status | Notes |
|---------|--------|-------|
| Start / stop recording | **Wired + env** | ACL-gated |
| Recording playback | **Wired** | Authenticated `/api/phone/calls/[id]/recording` proxy |
| Live transcription + AI notes | **Wired + env** | Per-line poll |
| Coach note | **Wired + env** | Consult/device leg only; refuses without secondary leg |

---

## 5. Presence, devices, push, permissions

| Feature | Status | Notes |
|---------|--------|-------|
| Presence set / team list | **Wired** | Auto on_call restores prior status (busy/away/dnd) |
| DND blocks dial | **Wired** | |
| Device register + heartbeat | **Wired** | 60s heartbeat; stale devices deactivated |
| Incoming web push | **Wired + env** | Targeted for `forward_user` / `screening` |
| Softphone ACL | **Wired** | Softphone loads permissions; buttons gated |
| Phone readiness | **Wired** | `/phone/readiness` |

---

## 6. Contacts / history

| Feature | Status | Notes |
|---------|--------|-------|
| Contact search / favorites / recent | **Wired** | |
| Screen pop | **Wired** | |
| Contact timeline | **Wired** | |
| Call diagnostics | **Wired** | `/phone/calls/[id]` |

---

## 7. Inbound routing (human)

| Feature | Status | Notes |
|---------|--------|-------|
| Softphone inbound orchestration | **Wired + env** | |
| Phone-first vs AI (per number) | **Wired** | Softphone only when this DID has human assignment / queue / IVR / assignee device — not workspace-wide device count |
| Queues + overflow | **Wired + env** | Sibling cellular rings cancel; overflow includes ai_agent / callback |
| IVR → agent / queue / voicemail | **Wired + env** | Agent handoff holds caller, notifies target, rings cellular when configured |
| Forwarding rules | **Wired** | Holiday mode honored with after-hours; delete in settings UI |
| Caller screening | **Wired + env** | Admin toggle; hangup after accept no longer dumps to voicemail |
| Softphone ring timeout | **Wired** | 30s unanswered → forward/voicemail |
| Block caller | **Wired** | |

---

## 8. Voicemail

| Feature | Status | Notes |
|---------|--------|-------|
| Leave / attach / transcribe | **Wired + env** | |
| Greeting save | **Wired** | `ensure_personal` updates greeting |
| Playback | **Wired** | `/api/phone/voicemail/[id]/recording` proxy |

---

## 9. Settings

| Feature | Status | Notes |
|---------|--------|-------|
| Default caller ID (workspace + personal) | **Wired** | |
| Cellular / DND / intl / recording / ring mobile / screening | **Wired** | Softphone admin tab |
| Forwarding CRUD | **Wired** | |
| Audio device select | **Wired** | Requests mic permission for labels |

---

## Intentionally external / not claimed

| Item | Status |
|------|--------|
| Native iOS / Android softphone apps | **External** |
| OS Bluetooth stack beyond browser headset | **External** |
| Carrier CNAM writeback / spam-network feeds | **External** |
| Private supervisor whisper/barge (`listen` ACL) | **Not built** — coach note is spoken TTS on consult leg only |
| Full sequential multi-target advance beyond first target | Partial — first target rings; unanswered timeout covers fallback |

---

## Env checklist

```
TELNYX_API_KEY
TELNYX_CONNECTION_ID
TELNYX_PUBLIC_KEY
TELNYX_TELEPHONY_CREDENTIAL_ID
APP_URL
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
OPENAI_API_KEY   # optional AI notes + Whisper
```

Schema: `npm run db:push` or `supabase/voice-softphone-checklist.sql`.

---

## Primary code map

| Area | Path |
|------|------|
| Softphone UI | `src/components/phone/softphone-panel.tsx` |
| Human call runtime | `src/lib/phone/human-call-service.ts` |
| Inbound / IVR / queues | `inbound-runtime.ts`, `ivr-service.ts`, `queue-runtime.ts` |
| Devices / push | `device-service.ts`, `incoming-notify.ts` |
| Park / conference | `park-service.ts`, `conference-service.ts` |
| Permissions | `softphone-permissions.ts` |
| APIs | `src/app/api/phone/**` |
