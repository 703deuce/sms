# Softphone (Cell Phone) — Wired Feature List

**Updated:** 2026-08-01 (human softphone + cellular bugfix pass)  
**Product surface:** `/phone` (Business Softphone)  
**Stack:** Telnyx WebRTC + Call Control, HumanCall records, softphone devices, web push  

This document lists **every softphone feature that is wired end-to-end** in code (UI → API → service → Telnyx/DB).  
Live exercise still needs: `TELNYX_API_KEY`, `TELNYX_CONNECTION_ID`, `TELNYX_PUBLIC_KEY`, `TELNYX_TELEPHONY_CREDENTIAL_ID` (WebRTC), and VAPID keys for incoming-call push.

### Latest human-call fixes (browser + cell)
- Flip / warm-complete no longer wipe the active line when WebRTC hangs up
- Call Control answer without a WebRTC invite requires Call my phone / cellular flip (uses *your* cellular setting)
- History “Return” opens `/phone?dial=` (no orphan Call Control dial)
- Call-my-phone honors DND + international gates; bridges only after destination answers
- Hangup tears down both legs; presence clears when calls end
- Queue sibling cellular rings cancel on answer/overflow
- Warm Complete gated until consult answered; park slot collision safe
- Softphone unanswered ring timeout + `forward_user` push targeting
- Multi-line hangup promotes next line; presence auto `on_call` no longer sticks after first call

Status legend:

| Status | Meaning |
|--------|---------|
| **Wired** | UI + API + runtime path implemented and linked |
| **Wired + env** | Same, but live media/push needs Telnyx/VAPID env |
| **External** | Intentionally not in-product (native apps, carrier CNAM writeback, spam networks) |

---

## 1. Calling core

| Feature | Status | How it works |
|---------|--------|----------------|
| Outbound dial — WebRTC (browser audio) | **Wired + env** | Softphone creates a `HumanCall`, then TelnyxRTC places the call; Call Control id is linked when the SDK exposes it |
| Outbound dial — Call Control API | **Wired + env** | `POST /api/phone/calls` → Telnyx `/calls` when WebRTC is unavailable / Call my phone is off |
| Outbound dial — Call my phone | **Wired + env** | Rings agent cell first, then dials destination and bridges on answer |
| Multi-line outbound | **Wired** | Place another call while already on a line; active line is auto-held |
| Answer inbound — WebRTC invite | **Wired + env** | TelnyxRTC ringing → Answer uses SDK + links/updates `HumanCall` |
| Answer inbound — Call Control poll | **Wired + env** | Softphone polls `ringing,queued`; answer via PATCH. Without WebRTC audio, requires Call my phone / cellular bridge |
| Decline inbound | **Wired** | Hangs up WebRTC (if any) and always PATCHes HumanCall with `missed:declined` |
| Hang up | **Wired** | WebRTC hangup + HumanCall completed |
| Redial | **Wired** | Redials last number from localStorage |
| Click-to-call | **Wired** | Contacts / elsewhere open `/phone?dial=+E164` and auto-start |
| Caller ID selection | **Wired** | Choose from workspace active numbers; server validates |
| Anonymous / private dial | **Wired + env** | Call Control privacy flags; WebRTC sets anonymous display name |
| International dial guard | **Wired** | Blocked unless softphone permission / settings allow |

---

## 2. In-call controls

| Feature | Status | How it works |
|---------|--------|----------------|
| Mute / unmute | **Wired** | WebRTC local mute + Call Control mute when control id linked |
| Hold / resume | **Wired** | WebRTC hold + Call Control hold/unhold |
| Switch active line | **Wired** | Client holds other lines and focuses selected line |
| Waiting inbound (call waiting) | **Wired** | Second inbound shown while on a call; answer holds current |
| DTMF keypad | **Wired** | WebRTC `dtmf` or Call Control `send_dtmf` |
| Call notes | **Wired** | Saved on HumanCall via PATCH |
| Call timer | **Wired** | Elapsed time on active line |

---

## 3. Transfer, park, conference, flip

| Feature | Status | How it works |
|---------|--------|----------------|
| Blind transfer | **Wired + env** | Telnyx `transfer` after Call Control is linked; gates until linked on WebRTC |
| Warm transfer — start | **Wired + env** | Hold customer, dial consult leg, track phase in UI |
| Warm transfer — consult answered | **Wired** | Webhook tags notes; UI polls and shows “Employee answered” |
| Warm transfer — complete | **Wired + env** | Bridge customer ↔ consult; ends agent browser media |
| Warm transfer — cancel | **Wired + env** | Hang up consult, unhold customer |
| Warm transfer timeout job | **Wired** | Background job cancels stale consults |
| Call park | **Wired + env** | Hold + park slot code; permission `park` required |
| Park retrieve | **Wired + env** | Unhold Call Control + restore parked WebRTC handle when available |
| Park timeout fallback | **Wired** | Job handles parked-call timeout |
| Conference create | **Wired + env** | Telnyx conference from active call (fails if Telnyx returns no id) |
| Conference add participant | **Wired + env** | Dial out; join on answer via webhook |
| Merge held lines | **Wired + env** | Merge two HumanCalls into a conference; permission `merge` |
| Call flip to another device | **Wired + env** | Dial flip leg, bridge on answer, hang up browser media; permission `flip` |

---

## 4. Recording, transcription, AI notes, coaching

| Feature | Status | How it works |
|---------|--------|----------------|
| Start / stop recording | **Wired + env** | Telnyx record start/stop when control linked; permission `record` |
| Recording URL persist | **Wired** | `call.recording.saved` webhook → HumanCall.recordingUrl |
| Live transcription start | **Wired + env** | Transcription start on answer / AI notes action |
| Transcript persist | **Wired** | Transcription webhooks append to HumanCall.transcriptText |
| Live transcript UI poll | **Wired** | Softphone polls active call for transcript/summary |
| AI call summary / notes | **Wired + env** | OpenAI summary when key set; heuristic fallback otherwise |
| Coach note (spoken) | **Wired + env** | Speaks a short note on the live leg (not a private supervisor channel); permission `whisper` |

---

## 5. Presence, devices, push, permissions

| Feature | Status | How it works |
|---------|--------|----------------|
| Presence set (available / busy / away / dnd / offline / on_call) | **Wired** | `PATCH /api/phone/presence` |
| Presence team list | **Wired** | Softphone sidebar transfer targets from presence |
| DND blocks outbound dial | **Wired** | Presence `dnd` syncs `softphoneUserSettings.dndEnabled` and dial guards |
| Auto presence on call | **Wired** | Softphone sets `on_call` / restores available |
| Softphone device registration | **Wired** | Browser device key in localStorage → `POST /api/phone/devices` |
| Multi-device registration | **Wired** | Multiple device keys per user; presence `deviceIds` updated |
| Incoming-call web push | **Wired + env** | VAPID push on inbound softphone ring; SW opens `/phone?incoming=` |
| Push ack | **Wired** | Click/open acks via `/api/phone/devices/ack` |
| Softphone permissions ACL | **Wired** | place_call, record, transfer, park, conference, flip, merge, whisper, block, anonymous, international, admin |
| Phone readiness test | **Wired** | `/phone/readiness` — Telnyx, numbers, presence, push/devices |

---

## 6. Contacts, CRM pop, history

| Feature | Status | How it works |
|---------|--------|----------------|
| Contact search in softphone | **Wired** | `/api/contacts?q=` (name/phone/email/company) |
| Favorites | **Wired** | Local favorites list; one-tap dial |
| Recent calls | **Wired** | Last HumanCalls loaded into sidebar |
| Screen pop / CRM contact card | **Wired** | Lookup by caller phone on inbound |
| Click-to-call from contacts | **Wired** | Opens softphone with `?dial=` |
| ContactId attach on dial/inbound | **Wired** | HumanCall.contactId resolved by E.164 |
| Unified contact timeline | **Wired** | Contact Activity = SMS + softphone + AI voice + voicemail |
| Call-path diagnostics | **Wired** | `/phone/calls/[id]` event timeline for support |

---

## 7. Inbound routing that feeds the softphone

| Feature | Status | How it works |
|---------|--------|----------------|
| Softphone inbound orchestration | **Wired + env** | Forwarding → IVR/queue → ring → overflow (`inbound-runtime`) |
| Phone-first vs AI routing | **Wired** | Prefers softphone when human assignment or softphone devices exist |
| Call queues | **Wired + env** | Strategies, hold music, member ring, overflow |
| IVR menus | **Wired + env** | DTMF route to queue / agent / voicemail / forward |
| Call forwarding rules | **Wired** | always / busy / unanswered / offline / after-hours / etc. |
| Caller screening | **Wired + env** | Optional gather accept/decline before ringing agent |
| Blocked / suppressed callers | **Wired** | Hang up immediately when suppressed |
| Block caller from softphone | **Wired** | Adds suppression + hangs up; permission `block_caller` |

---

## 8. Voicemail (softphone-adjacent)

| Feature | Status | How it works |
|---------|--------|----------------|
| Leave voicemail on overflow / forward | **Wired + env** | Greeting + record on Call Control |
| Recording attach | **Wired** | `call.recording.saved` while status voicemail |
| Transcription | **Wired + env** | Whisper when `OPENAI_API_KEY` + box transcription enabled |
| Voicemail UI (play + transcript) | **Wired** | Phone settings → Voicemail tab |

---

## 9. Settings & admin (softphone)

| Feature | Status | How it works |
|---------|--------|----------------|
| Default caller ID | **Wired** | Workspace phone settings |
| Personal / team voicemail boxes | **Wired** | Ensure personal box, greetings |
| Forwarding rule CRUD | **Wired** | Phone settings → Forwarding |
| Softphone user settings | **Wired** | Extension, DND, cellular forward, intl, recording flag |
| Softphone admin API | **Wired** | `/api/phone/admin` |
| Audio input / output device select | **Wired** | Mic/speaker enumerate + Telnyx device APIs |
| Network quality hint | **Wired** | Browser `effectiveType` + online/offline reconnect copy |

---

## 10. Intentionally external (not claimed as wired softphone)

| Item | Status |
|------|--------|
| Native iOS / Android softphone apps | **External** |
| OS Bluetooth stack (beyond browser headset support) | **External** |
| Carrier CNAM writeback | **External** |
| Third-party spam-network feeds | **External** |
| Private supervisor whisper/coach channel (barge conference) | **Not claimed** — current “coach note” is spoken TTS on the live leg |

---

## Env checklist for live softphone

```
TELNYX_API_KEY
TELNYX_CONNECTION_ID
TELNYX_PUBLIC_KEY
TELNYX_TELEPHONY_CREDENTIAL_ID   # WebRTC login token
APP_URL
NEXT_PUBLIC_VAPID_PUBLIC_KEY     # incoming-call push
VAPID_PRIVATE_KEY
VAPID_SUBJECT                    # optional
OPENAI_API_KEY                   # AI notes + voicemail Whisper (optional)
```

Webhooks: `/api/telnyx/voice` (and tools webhook if using AI voice on other numbers).

Schema: `npm run db:push` or `supabase/voice-softphone-checklist.sql`.

---

## Primary code map

| Area | Path |
|------|------|
| Softphone UI | `src/components/phone/softphone-panel.tsx` |
| Human call runtime | `src/lib/phone/human-call-service.ts` |
| Inbound routing | `src/lib/phone/inbound-runtime.ts` |
| Devices / push notify | `src/lib/phone/device-service.ts`, `incoming-notify.ts` |
| Park / conference | `src/lib/phone/park-service.ts`, `conference-service.ts` |
| Permissions | `src/lib/phone/softphone-permissions.ts` |
| APIs | `src/app/api/phone/**` |
| Readiness | `/phone/readiness` |
| Positioning | `docs/PRODUCT_POSITIONING.md` |
| Audit history | `docs/VOICE_SOFTPHONE_AUDIT.md` |

---

**Bottom line:** The softphone feature set above is **code-complete and wired**. With a live Telnyx number and the env checklist set, these paths are ready for number-on testing without more product wiring.
