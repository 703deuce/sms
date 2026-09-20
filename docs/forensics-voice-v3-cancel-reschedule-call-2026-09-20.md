# Voice V3 forensics — cancel + reschedule on one call (2026-09-20)

**Generated from:** web container logs, voice (LiveKit) container logs, DB query attempt.  
**Verdict:** Cancel and reschedule both succeeded at Microsoft/backend on the same PSTN call.

---

## Call identity

| Field | Value |
|--------|--------|
| LiveKit job | `AJ_VwV7kdqd56QE` |
| LiveKit room | `transovo-call-…_MmBxjZ4x5wbM` (`RM_cqp5iWaRuwyC`) |
| Canonical call / live session | `lk_transovo-call-…_MmBxjZ4x5wbM` |
| Workspace / agent | `ws_1` · `cmshz2lc25c622c4i58303501` (Riley) |
| Line (cert) | `+15717491060` |
| Voice container | `tgjridm6vrmrgljkfrr0rpjn-082422767617` |
| Web container | `ds8s3hjin60qs6g7s0iqkixs-084355722569` |
| Web deploy SHA | `723569235e882901fd4c813ad51ac31382396268` |
| Booking | `MICROSOFT_365` · voice `vesper` |
| Call length | Job 11:11:02.934 UTC → disconnect 11:13:54.931 UTC (~2m 52s) |
| Session resolve | 11:11:03.315 → runtime 11:11:04.710 (`resolve_voice_v3_livekit_session` 1411 ms) |

---

## Configuration at session compile

- **Tools (10 in Astra contract):** `update_intake`, `set_scheduling_preference`, `find_availability`, `book_appointment`, `find_appointment`, `reschedule_appointment`, `cancel_appointment`, `transfer_call`, `end_call`, `request_callback`
- **Capabilities:** find / cancel / reschedule / book enabled
- **Calendar:** configured · `service-visit` · `America/New_York`
- Voice worker logged **toolCount: 17** (Live catalog includes extras)
- Prompts: `voice-v3-live-v2` / `voice-v3-astra-v2` · `gpt-live-1` + `gpt-6-astra`

---

## Database

Queried app DB for 2026-09-20 11:10–11:16 UTC (`ws_1`):

- `voice_calls`: **0** rows in window
- `voice_tool_executions`: **0** rows (no `MmBxjZ4x5wbM` match)

LiveKit V3 audit trail is primarily **container logs**, not legacy `voiceCall` / `voiceToolExecution` rows.

Attempt IDs in logs: `cxl_cmu9pvlw44z1c5y071b430l6u`, `rsc_cmu9pxaiv1t10031d0c6u5v0v`

---

## Voice container (Python / LiveKit)

1. 11:11:02 — `received job request` (`AJ_VwV7kdqd56QE`, recording on)
2. 11:11:04.735 — `voice_v3_session_starting` (toolCount 17)
3. 11:11:04.745 — RoomIO linked to SIP participant
4. 16× `voice_v3_caller_utterance_committed` (sequences 1–16)
5. 11:12:54.737 — **ERROR** `duplex transcript outlived the audio it describes` (`[inhale]`)
6. 11:13:04.747 — WARNING segment synchronizer rotation
7. 11:13:54.931 — `closing agent session` — `CLIENT_INITIATED`
8. 11:14:18 — job process exit

No `CALLER_TURN_TIMING` on LiveKit path (sideband-oriented).

---

## Web — tool / Microsoft timeline (UTC)

| Time | Tool | tool_total_ms | Outcome |
|------|------|---------------|---------|
| 11:11:31.861 | update_intake | 3 | INTAKE_UPDATED (name, phone) |
| 11:11:40.204 | find_appointment | 1707 | ambiguous |
| 11:12:16.082 | find_appointment | 1 | confirmed |
| 11:12:20.880–22.328 | cancel_appointment | 1447 | cancelled → ASYNC_ACTION_SUCCEEDED CANCEL_APPOINTMENT |
| 11:12:50.376 | find_appointment | 1 | FAILED invalid_selection / INVALID_IDENTIFIER |
| 11:12:54.502 | find_appointment | 625 | needs_confirmation |
| 11:12:57.518 | find_appointment | 2 | confirmed |
| 11:13:15.989 | set_scheduling_preference | 4 | 2026-09-21 AFTER (America/New_York) |
| 11:13:21.376 | find_availability | 655 | available, 4 slots, Microsoft Graph 478 ms |
| 11:13:39.459–41.238 | reschedule_appointment | 1778 | rescheduled → RESCHEDULE_CONFIRMED |

### Microsoft Graph event IDs

- **Cancel:** `AQMkADAwATM0MDAAMi1hOWY1LTY3MzEtMDACLTAwCgBGAAADxtFon5XuVEalmlhPr1nWBgcAs2vWk3hKT02vN5c-Q6OlzQAAAgENAAAAs2vWk3hKT02vN5c-Q6OlzQAAAEesWN0AAAA=`  
  Attempt: `cxl_cmu9pvlw44z1c5y071b430l6u`  
  CANCELLATION_COMMIT_SENT → ASYNC_ACTION_SUCCEEDED → CANCELLATION_CONFIRMED · CLAIM_CANCELLED

- **Reschedule:** `AQMkADAwATM0MDAAMi1hOWY1LTY3MzEtMDACLTAwCgBGAAADxtFon5XuVEalmlhPr1nWBgcAs2vWk3hKT02vN5c-Q6OlzQAAAgENAAAAs2vWk3hKT02vN5c-Q6OlzQAAAEiPQ9oAAAA=` (different event)  
  Attempt: `rsc_cmu9pxaiv1t10031d0c6u5v0v`  
  RESCHEDULE_COMMIT_SENT → ASYNC_ACTION_SUCCEEDED → RESCHEDULE_CONFIRMED · CLAIM_RESCHEDULED

---

## Per-turn latency (caller commits)

Session start 11:11:04.735 → turn 1 11:11:11.180 = **6.44 s** (greeting + first speech/VAD).

| Turn | Committed (UTC) | Sec from answer | Gap since prev | Chars |
|------|-----------------|-----------------|----------------|-------|
| 1 | 11:11:11.180 | 6.4 | 6.44 | 5 |
| 2 | 11:11:23.298 | 18.6 | 12.12 | 73 |
| 3 | 11:11:30.187 | 25.5 | 6.89 | 128 |
| 4 | 11:11:56.979 | 52.2 | 26.79 | 21 |
| 5 | 11:12:11.119 | 66.4 | 14.14 | 3 |
| 6 | 11:12:14.362 | 69.6 | 3.24 | 71 |
| 7 | 11:12:34.588 | 89.9 | 20.23 | 4 |
| 8 | 11:12:35.752 | 91.0 | 1.16 | 14 |
| 9 | 11:12:37.751 | 93.0 | 2.00 | 18 |
| 10 | 11:12:40.362 | 95.6 | 2.61 | 16 |
| 11 | 11:12:43.510 | 98.8 | 3.15 | 40 |
| 12 | 11:12:45.056 | 100.3 | 1.55 | 19 |
| 13 | 11:12:47.960 | 103.2 | 2.90 | 25 |
| 14 | 11:13:13.753 | 129.0 | 25.79 | 22 |
| 15 | 11:13:34.982 | 150.2 | 21.23 | 19 |
| 16 | 11:13:54.485 | 169.7 | 19.50 | 15 |

Rolling transcript at end: 508 chars, 16 revisions.

### Turn → first backend tool (approx.)

| After turn | Tool | Latency |
|------------|------|---------|
| 3 | update_intake | 1.67 s |
| 3 | find_appointment (ambiguous) | 8.31 s |
| 6 | find_appointment (confirm) | 1.72 s |
| 6 | cancel_appointment | 6.52 s |
| 13 | find_appointment (fail) | 2.42 s |
| 14 | set_scheduling_preference | 2.23 s |
| 15 | reschedule_appointment | 4.48 s (+ 1778 ms tool ≈ 6.3 s to HTTP complete) |

---

## Call narrative

1. **Cancel:** Intake → ambiguous find (1.7 s) → disambiguation (turns 4–6) → find confirmed → cancel (~1.45 s) → confirmed.
2. **Reschedule (same call):** Turns 7–13 burst → INVALID_IDENTIFIER find at 11:12:50 → recovery in ~7 s → find confirmed.
3. **Reschedule commit:** Scheduling preference (Sep 21 AFTER) → find_availability (4 slots) → reschedule (~1.78 s) → confirmed → hang up turn 16.

Friction: ambiguous first find, delay before cancel tool, invalid find once, duplex transcript error at 11:12:54 — not failed Graph commits.

---

## Contrast: earlier call same log (~11:05 UTC)

Room suffix `6P2rakKGBwY6` · `booking_strategy: SEND_LINK` · only `update_intake` — no `cancel_appointment` in catalog. Not this Microsoft call.

---

## How to re-pull logs

```bash
ssh coolify-server
docker logs tgjridm6vrmrgljkfrr0rpjn-082422767617 2>&1 | grep -E 'MmBxjZ4x5wbM|AJ_VwV7kdqd56QE'
docker logs ds8s3hjin60qs6g7s0iqkixs-084355722569 2>&1 | grep -E 'MmBxjZ4x5wbM|cxl_cmu9pvlw|rsc_cmu9pxaiv'
```

Local excerpt: `/workspace/tmp-web-45m.log` (~183 lines for `MmBxjZ4x5wbM`).

---

## Bottom line

Microsoft cancel and reschedule both committed with distinct Graph event IDs on one call (`MICROSOFT_365` / vesper). Backend succeeded; UX had disambiguation and one bad find attempt.
