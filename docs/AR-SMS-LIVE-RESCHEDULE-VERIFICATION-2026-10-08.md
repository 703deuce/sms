# AR SMS live reschedule verification — Anthony / ws_1

**Captured:** 2026-10-08 (UTC) · **Production** transovo.ai · **Code on prod:** `886cb13e92b3fcdc6edbc7c0148de8598ef4b7a5`

**Customer SMS thread (summary):**

1. Reminder: Microsoft AR live test — **Wed Oct 14, 10:00 AM** (initial confirmation before reschedule).
2. Customer: **R**
3. Assistant: reschedule opener (what day/time works better).
4. Customer: **Next Monday at 1pm**
5. Assistant: offer **Mon Oct 19, 1:00 PM**
6. Customer: **Yes**
7. Assistant: **Your appointment has been rescheduled to Monday, October 19 at 1:00 PM.**
8. Customer: **Thanks** (duplicate confirmation SMS also sent — see note at end).

**Platform sender (Telnyx):** `+18666020680`  
**Customer:** `+15714776175`

> **Single copy-paste bundle:** correlation IDs, DB/Graph proof, turn-by-turn expected steps, **77-row log audit table**, and **full raw JSON logs** (sections 8–9).

---

## 1. Correlation IDs (use these in logs / DB)

| Role | ID |
|------|-----|
| Workspace | `ws_1` |
| Contact | `cmsdkphjd6t12365p2g301r5o` |
| Appointment | `cmuzyipnf5y3k115c7060464k` |
| AR reply session | `cmuzyixh54t1i303r3f4g254z` |
| Persistent conversation | `cmuzu7o2s3h1r355c3k53124b` |
| Platform phone number row | `cmtoszkn26t6z485u3d2w3c51` |
| Microsoft connection | `cmu1uq7f15s1o5s4f6c5b6a57` |
| Second AR session (older appt, same customer/sender) | `cmuzrs78n3h5h5s2o5s1j5b60` |

**Telnyx `providerMessageId` per customer reply:**

| Customer text | providerMessageId |
|---------------|-------------------|
| R | `59c0d003-2c1f-45cb-8ede-93c1e87ac410` |
| Next Monday at 1pm | `411291fa-0a0d-4d32-a1c9-f1b9c014f8d1` |
| Yes | `f1f6f484-568f-45f4-8554-c7e68440cb98` |
| Thanks | `8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d` |

**Durable inbound receipt IDs (sample):** `cmuzyjazp715f2n0h3a5g2y3k` (R), `cmuzyjy1k5q0a4i4p1u0z0w3t` (Monday), `cmuzykl5o2v5r4x6q3r6b2s6h` (Yes), `cmuzyl51r3a4o4f460s1m006m` (Thanks).

---

## 2. Calendar & database verification (authoritative)

**Command run on production web container:**

```bash
npx tsx scripts/ar-prod-verify-reschedule.ts --appointment-id cmuzyipnf5y3k115c7060464k
```

**Output (2026-10-08):**

```
local_appointment {
  id: 'cmuzyipnf5y3k115c7060464k',
  workspaceId: 'ws_1',
  status: 'scheduled',
  startsAt: '2026-10-19T17:00:00.000Z',
  endsAt: '2026-10-19T17:30:00.000Z',
  timezone: 'America/New_York',
  ...
}
ar_reply_session {
  id: 'cmuzyixh54t1i303r3f4g254z',
  lifecycleState: 'COMPLETED',
  lastUsedAt: '2026-10-08T19:58:17.813Z',
  hasWorkflowState: true
}
microsoft_graph_event {
  subject: 'Microsoft AR live test — Anthony  Johnson',
  start: { dateTime: '2026-10-19T17:00:00.0000000', timeZone: 'UTC' },
  end: { dateTime: '2026-10-19T17:30:00.0000000', timeZone: 'UTC' }
}
```

**Interpretation:**

| Check | Result |
|-------|--------|
| Transovo appointment time | **Mon Oct 19, 2026, 1:00 PM Eastern** (`17:00Z` = 1:00 PM EDT) |
| Microsoft Graph same event | **Same start/end** — event was **updated**, not a new fake ID |
| Session after flow | `COMPLETED`, workflow state persisted |
| **Verdict** | **PASS — real calendar move + DB move** |

---

## 3. Job queue (BullMQ / `job_queue`)

**Command:** `npx tsx scripts/ar-prod-trace-inbound-boundary.ts` (PHONE default `+15714776175`, WORKSPACE `ws_1`)

**Held inbound:** `[]` (nothing stuck in ambiguous hold for this test)

**Recent jobs (all `status: completed`):**

| Job type | providerMessageId | Customer body | Outbound body (if any) |
|----------|-------------------|---------------|-------------------------|
| `ar_process_inbound_sms` | `f1f6f484-…` | Yes | (enqueues send) |
| `ar_send_customer_sms` | `f1f6f484-…` | — | Your appointment has been rescheduled to Monday, October 19 at 1:00 PM. |
| `ar_process_inbound_sms` | `8ae1b42a-…` | Thanks | (enqueues send) |
| `ar_send_customer_sms` | `8ae1b42a-…` | — | Same confirmation text again |

Processing job IDs (examples): `cmuzykmq31c6w4l640j693g30` (Yes inbound), `cmuzykt4l5x723t5c290l5414` (Yes outbound), `cmuzyl6kw3v3q535v4k1m3e0n` (Thanks inbound), `cmuzylbov5a613p38232f705b` (Thanks outbound).

---

## 4. How to read `ar_sms_pipeline` logs

- **Search string:** `ar_sms_pipeline`
- **Filter by:** `providerMessageId`, `appointmentId`, `conversationId`, or `step`
- **Web container:** Telnyx webhook → routing → ingress (enqueue job)
- **SMS worker container:** `ar_process_inbound_sms` → Luna → `ar_send_customer_sms`
- **Bodies are not logged** — only `inboundKind` (`R`, `yes`, `natural`) and `bodyLength`

### Step glossary (expected order per inbound SMS)

| step | Meaning | Healthy signal |
|------|---------|----------------|
| `webhook_dispatch_start` | Telnyx hit web app | `channel: telnyx`, correct `providerMessageId` |
| `inbound_receipt_recorded` | Row in `ar_platform_sms_inbound_receipts` | `duplicate: false` on first delivery |
| `route_sessions_listed` | Found AR sessions for customer+sender | `sessionCount` ≥ 1; multi-appt OK |
| `route_matched` | Workspace resolved, primary session picked | `routingResolution: ar_platform_reply_resolved` |
| `ingress_accept_start` | Persist path entered | IDs match session/appt |
| `ingress_conversation_bound` | Canonical conversation | Same `conversationId` every time |
| `ingress_message_persisted` | Inbound in `conversation_message` | `conversationMessageId` set |
| `ingress_job_enqueued` | Durable `ar_process_inbound_sms` job | `processingJobId` present |
| `inbound_job_process_start` | Worker claimed job | Same `providerMessageId` |
| `inbound_job_session_verified` | Session eligible | `lifecycleState` matches flow |
| `inbound_handler_branch` | C/R/X vs Luna | `reminder_letter` / `luna_follow_up` |
| `luna_context_loaded` | Thread history for Luna | `historyTurns` grows each message |
| `luna_turn_start` / `luna_turn_completed` | Voice V3 tools + LLM | **`confirmed: true` on Yes** = Graph reschedule |
| `inbound_outbound_enqueued` | Reply SMS job queued | `outboundJobId` |
| `outbound_reply_job_start` / `outbound_reply_sent` | Telnyx outbound | `messageId` set |

---

## 5. Turn-by-turn: expected behavior + log lines

### Turn A — Customer: **R** (`59c0d003-…`)

| # | Expected | step (from logs) | PASS? |
|---|----------|------------------|-------|
| A1 | Webhook received | `webhook_dispatch_start` … `inboundKind":"R"` | ✓ |
| A2 | Durable receipt | `inbound_receipt_recorded` … `duplicate":false` | ✓ |
| A3 | 2 sessions; pick AWAITING_REPLY appt | `route_sessions_listed` … `lifecycleStates":["AWAITING_REPLY","COMPLETED"]` | ✓ |
| A4 | Route to this appointment | `route_matched` … `appointmentId":"cmuzyipnf5y3k115c7060464k"` | ✓ |
| A5 | Ingress + conversation | `ingress_conversation_bound` … `cmuzu7o2s3h1r355c3k53124b` | ✓ |
| A6 | Job queued | `ingress_job_enqueued` … `cmuzyjcno6u5i2w6n6h3m0916` | ✓ |
| A7 | Worker: letter handler | `inbound_handler_branch` … `handler":"reminder_letter","branch":"R"` | ✓ |
| A8 | Opener SMS sent | `outbound_reply_sent` (worker) … `59c0d003-…` | ✓ |

**Log lines (chronological, web + worker):**

```json
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:43.879Z","step":"webhook_dispatch_start","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","inboundKind":"R","bodyLength":1,"meta":{"toE164":"+18666020680"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:44.304Z","step":"inbound_receipt_recorded","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","duplicate":false,"meta":{"receiptId":"cmuzyjazp715f2n0h3a5g2y3k"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:44.430Z","step":"route_sessions_listed","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","sessionCount":2,"meta":{"appointmentIds":["cmuzyipnf5y3k115c7060464k","cmuzrs78n3h5h5s2o5s1j5b60"],"lifecycleStates":["AWAITING_REPLY","COMPLETED"]}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:44.674Z","step":"route_matched","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","lifecycleState":"AWAITING_REPLY","sessionCount":2,"primarySessionId":"cmuzyixh54t1i303r3f4g254z","meta":{"syncedConversation":true}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:46.413Z","step":"ingress_accepted","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","processingJobId":"cmuzyjcno6u5i2w6n6h3m0916","inboundKind":"R","bodyLength":1,"meta":{"conversationMessageId":"cmuzyjcgy3i6g683c1g670y1g"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:48.995Z","step":"inbound_handler_branch","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","inboundKind":"R","bodyLength":1,"handler":"reminder_letter","branch":"R"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:49.248Z","step":"inbound_job_completed","workspaceId":"ws_1","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","processingJobId":"cmuzyjcno6u5i2w6n6h3m0916","ok":true}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:56.371Z","step":"outbound_reply_sent","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","meta":{"messageId":"cmuzyjhac0l1h20652a4z5l6i"}}
```

---

### Turn B — Customer: **Next Monday at 1pm** (`411291fa-…`)

| # | Expected | step | PASS? |
|---|----------|------|-------|
| B1 | Route while RESCHEDULING | `route_matched` … `lifecycleState":"RESCHEDULING"` | ✓ |
| B2 | Luna loads history | `luna_context_loaded` … `historyTurns":5` | ✓ |
| B3 | Slot offer, not booked yet | `luna_turn_completed` … `"confirmed":false` | ✓ |
| B4 | Offer SMS delivered | `outbound_reply_sent` | ✓ |

**Key log lines:**

```json
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:14.290Z","step":"route_sessions_listed","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","sessionCount":2,"meta":{"appointmentIds":["cmuzyipnf5y3k115c7060464k","cmuzrs78n3h5h5s2o5s1j5b60"],"lifecycleStates":["RESCHEDULING","COMPLETED"]}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:18.752Z","step":"luna_context_loaded","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","inboundKind":"natural","bodyLength":18,"meta":{"historyTurns":5}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:27.569Z","step":"luna_turn_completed","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","ok":true,"meta":{"confirmed":false,"replyLength":111}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:27.569Z","step":"inbound_handler_branch","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","inboundKind":"natural","bodyLength":18,"handler":"luna_follow_up","branch":"v3_reschedule"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:34.655Z","step":"outbound_reply_sent","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","meta":{"messageId":"cmuzykb0n550t1y400r2z0a3v"}}
```

---

### Turn C — Customer: **Yes** (`f1f6f484-…`) — **calendar commit**

| # | Expected | step | PASS? |
|---|----------|------|-------|
| C1 | Ingress on worker | `inbound_job_process_start` … `inboundKind":"yes"` | ✓ |
| C2 | Session RESCHEDULING | `inbound_job_session_verified` … `lifecycleState":"RESCHEDULING"` | ✓ |
| C3 | More history | `luna_context_loaded` … `historyTurns":7` | ✓ |
| C4 | **Graph reschedule** | `luna_turn_completed` … **`"confirmed":true`** | ✓ |
| C5 | Confirmation SMS | `outbound_reply_sent` (web + worker paths) | ✓ |

**Key log lines (worker — authoritative for Luna on this turn):**

```json
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:46.906Z","step":"inbound_job_process_start","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","inboundKind":"yes","bodyLength":3}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:49.121Z","step":"luna_context_loaded","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","inboundKind":"yes","bodyLength":3,"meta":{"historyTurns":7}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:54.038Z","step":"luna_turn_completed","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","ok":true,"meta":{"confirmed":true,"replyLength":71}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:54.289Z","step":"inbound_job_completed","workspaceId":"ws_1","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","processingJobId":"cmuzykmq31c6w4l640j693g30","ok":true}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:01.328Z","step":"outbound_reply_sent","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","meta":{"messageId":"cmuzykvad655v116j551x6i3a"}}
```

**After this turn:** DB + Microsoft Graph both show **2026-10-19T17:00:00Z** (Section 2).

---

### Turn D — Customer: **Thanks** (`8ae1b42a-…`) — cosmetic duplicate

| # | Expected | Actual | Note |
|---|----------|--------|------|
| D1 | Optional no-op or polite reply | Luna ran again with `historyTurns":9` | Improvement: skip Luna after COMPLETED for chit-chat |
| D2 | Should not change calendar | `confirmed:true` again but times already correct | No second Graph change required |
| D3 | Duplicate SMS | Second `outbound_reply_sent` | Same confirmation text |

**Key log lines:**

```json
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:10.265Z","step":"route_matched","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","lifecycleState":"COMPLETED","sessionCount":2,"primarySessionId":"cmuzyixh54t1i303r3f4g254z","meta":{"syncedConversation":true}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:14.238Z","step":"luna_context_loaded","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","inboundKind":"natural","bodyLength":6,"meta":{"historyTurns":9}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:18.056Z","step":"luna_turn_completed","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","ok":true,"meta":{"confirmed":true,"replyLength":71}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:24.988Z","step":"outbound_reply_sent","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","meta":{"messageId":"cmuzylduw2a6p6p144t716b10"}}
```

---

## 6. Multi-appointment routing (2 sessions, 1 conversation)

Logs consistently show:

- `sessionCount":2`
- `appointmentIds":["cmuzyipnf5y3k115c7060464k","cmuzrs78n3h5h5s2o5s1j5b60"]`
- **No** `route_ambiguous_workspace` / **no** held message
- `primarySessionId":"cmuzyixh54t1i303r3f4g254z"` on the active Oct 14 → Oct 19 appointment
- Same `conversationId":"cmuzu7o2s3h1r355c3k53124b"` on every turn (`syncedConversation":true`)

**Verdict:** PASS — persistent conversation + primary session selection (not `lastUsedAt` winner + expire).

---

## 7. Overall certification

| Area | Status |
|------|--------|
| Telnyx webhook → receipt → route → ingress | **PASS** |
| Durable jobs (`ar_process_inbound_sms`, `ar_send_customer_sms`) | **PASS** (all completed) |
| R → letter handler | **PASS** |
| Natural language → Luna + history | **PASS** (turns 5 → 7 → 9) |
| Yes → `confirmed: true` | **PASS** |
| Transovo DB appointment time | **PASS** (Oct 19 1:00 PM ET) |
| Microsoft Graph event time | **PASS** (matches DB) |
| Multi-appointment same sender | **PASS** (no ambiguous hold) |
| Post-complete “Thanks” | **Minor** — duplicate confirmation SMS only |

---

## 8. Line-by-line log verification (77 events, chronological)

Every production `ar_sms_pipeline` line for this test, sorted by `at`. Use the **OK** column while auditing; all rows should be **✓** unless noted for Turn D (duplicate SMS is expected behavior gap, not a pipeline failure).

| # | When · source | step | provider msg | OK | What to verify |
|---:|---|---|---|:---:|---|
| 1 | 2026-10-08T19:56:43.879Z · ar-pipeline-web:1 | `webhook_dispatch_start` | 59c0d003… | ✓ | Telnyx webhook received; providerMessageId + inboundKind match customer text |
| 2 | 2026-10-08T19:56:44.304Z · ar-pipeline-web:2 | `inbound_receipt_recorded` | 59c0d003… | ✓ | Durable receipt row; duplicate:false on first delivery |
| 3 | 2026-10-08T19:56:44.430Z · ar-pipeline-web:3 | `route_sessions_listed` | — | ✓ | AR sessions found for customer+platform sender; sessionCount expected ≥1 |
| 4 | 2026-10-08T19:56:44.674Z · ar-pipeline-web:4 | `route_matched` | — | ✓ | Workspace + primary session + conversationId resolved |
| 5 | 2026-10-08T19:56:44.674Z · ar-pipeline-web:5 | `route_matched` | 59c0d003… | ✓ | Workspace + primary session + conversationId resolved |
| 6 | 2026-10-08T19:56:44.675Z · ar-pipeline-web:6 | `ingress_accept_start` | 59c0d003… | ✓ | Ingress path entered for matched session |
| 7 | 2026-10-08T19:56:45.922Z · ar-pipeline-web:7 | `ingress_conversation_bound` | — | ✓ | Same conversationId on every turn of this test |
| 8 | 2026-10-08T19:56:46.164Z · ar-pipeline-web:8 | `ingress_message_persisted` | 59c0d003… | ✓ | Inbound stored in conversation_message |
| 9 | 2026-10-08T19:56:46.413Z · ar-pipeline-web:9 | `ingress_accepted` | 59c0d003… | ✓ | Ingress OK; processingJobId assigned |
| 10 | 2026-10-08T19:56:46.413Z · ar-pipeline-web:10 | `ingress_job_enqueued` | 59c0d003… | ✓ | ar_process_inbound_sms job durable |
| 11 | 2026-10-08T19:56:47.726Z · ar-pipeline-web:11 | `inbound_job_process_start` | 59c0d003… | ✓ | Worker processing inbound |
| 12 | 2026-10-08T19:56:47.873Z · ar-pipeline-web:12 | `inbound_job_session_verified` | 59c0d003… | ✓ | Session lifecycle allows this handler |
| 13 | 2026-10-08T19:56:48.995Z · ar-pipeline-web:13 | `inbound_handler_branch` | 59c0d003… | ✓ | R→reminder_letter; natural/yes→luna_follow_up |
| 14 | 2026-10-08T19:56:49.248Z · ar-pipeline-web:14 | `inbound_job_completed` | 59c0d003… | ✓ | ok:true |
| 15 | 2026-10-08T19:56:49.248Z · ar-pipeline-web:15 | `inbound_outbound_enqueued` | 59c0d003… | ✓ | ar_send_customer_sms queued |
| 16 | 2026-10-08T19:56:49.396Z · ar-pipeline-worker:1 | `outbound_reply_job_start` | 59c0d003… | ✓ | Outbound send job running |
| 17 | 2026-10-08T19:56:56.371Z · ar-pipeline-worker:2 | `outbound_reply_sent` | — | ✓ | SMS delivered; messageId set |
| 18 | 2026-10-08T19:57:13.757Z · ar-pipeline-web:16 | `webhook_dispatch_start` | 411291fa… | ✓ | Telnyx webhook received; providerMessageId + inboundKind match customer text |
| 19 | 2026-10-08T19:57:14.159Z · ar-pipeline-web:17 | `inbound_receipt_recorded` | 411291fa… | ✓ | Durable receipt row; duplicate:false on first delivery |
| 20 | 2026-10-08T19:57:14.290Z · ar-pipeline-web:18 | `route_sessions_listed` | — | ✓ | AR sessions found for customer+platform sender; sessionCount expected ≥1 |
| 21 | 2026-10-08T19:57:14.553Z · ar-pipeline-web:19 | `route_matched` | — | ✓ | Workspace + primary session + conversationId resolved |
| 22 | 2026-10-08T19:57:14.553Z · ar-pipeline-web:20 | `route_matched` | 411291fa… | ✓ | Workspace + primary session + conversationId resolved |
| 23 | 2026-10-08T19:57:14.554Z · ar-pipeline-web:21 | `ingress_accept_start` | 411291fa… | ✓ | Ingress path entered for matched session |
| 24 | 2026-10-08T19:57:15.680Z · ar-pipeline-web:22 | `ingress_conversation_bound` | — | ✓ | Same conversationId on every turn of this test |
| 25 | 2026-10-08T19:57:15.958Z · ar-pipeline-web:23 | `ingress_message_persisted` | 411291fa… | ✓ | Inbound stored in conversation_message |
| 26 | 2026-10-08T19:57:16.206Z · ar-pipeline-web:24 | `ingress_accepted` | 411291fa… | ✓ | Ingress OK; processingJobId assigned |
| 27 | 2026-10-08T19:57:16.206Z · ar-pipeline-web:25 | `ingress_job_enqueued` | 411291fa… | ✓ | ar_process_inbound_sms job durable |
| 28 | 2026-10-08T19:57:16.211Z · ar-pipeline-web:26 | `inbound_job_process_start` | 411291fa… | ✓ | Worker processing inbound |
| 29 | 2026-10-08T19:57:16.336Z · ar-pipeline-web:27 | `inbound_job_session_verified` | 411291fa… | ✓ | Session lifecycle allows this handler |
| 30 | 2026-10-08T19:57:18.752Z · ar-pipeline-web:28 | `luna_context_loaded` | 411291fa… | ✓ | historyTurns grows (5→7→9 in this test) |
| 31 | 2026-10-08T19:57:18.871Z · ar-pipeline-web:29 | `luna_turn_start` | 411291fa… | ✓ | Luna V3 turn began |
| 32 | 2026-10-08T19:57:27.569Z · ar-pipeline-web:30 | `inbound_handler_branch` | 411291fa… | ✓ | R→reminder_letter; natural/yes→luna_follow_up |
| 33 | 2026-10-08T19:57:27.569Z · ar-pipeline-web:31 | `luna_turn_completed` | 411291fa… | ✓ | confirmed:false=offer; confirmed:true=Graph reschedule |
| 34 | 2026-10-08T19:57:27.823Z · ar-pipeline-web:32 | `inbound_job_completed` | 411291fa… | ✓ | ok:true |
| 35 | 2026-10-08T19:57:27.823Z · ar-pipeline-web:33 | `inbound_outbound_enqueued` | 411291fa… | ✓ | ar_send_customer_sms queued |
| 36 | 2026-10-08T19:57:27.846Z · ar-pipeline-web:34 | `outbound_reply_job_start` | 411291fa… | ✓ | Outbound send job running |
| 37 | 2026-10-08T19:57:34.655Z · ar-pipeline-web:35 | `outbound_reply_sent` | — | ✓ | SMS delivered; messageId set |
| 38 | 2026-10-08T19:57:43.710Z · ar-pipeline-web:36 | `webhook_dispatch_start` | f1f6f484… | ✓ | Telnyx webhook received; providerMessageId + inboundKind match customer text |
| 39 | 2026-10-08T19:57:44.133Z · ar-pipeline-web:37 | `inbound_receipt_recorded` | f1f6f484… | ✓ | Durable receipt row; duplicate:false on first delivery |
| 40 | 2026-10-08T19:57:44.259Z · ar-pipeline-web:38 | `route_sessions_listed` | — | ✓ | AR sessions found for customer+platform sender; sessionCount expected ≥1 |
| 41 | 2026-10-08T19:57:44.509Z · ar-pipeline-web:39 | `ingress_accept_start` | f1f6f484… | ✓ | Ingress path entered for matched session |
| 42 | 2026-10-08T19:57:44.509Z · ar-pipeline-web:40 | `route_matched` | — | ✓ | Workspace + primary session + conversationId resolved |
| 43 | 2026-10-08T19:57:44.509Z · ar-pipeline-web:41 | `route_matched` | f1f6f484… | ✓ | Workspace + primary session + conversationId resolved |
| 44 | 2026-10-08T19:57:45.618Z · ar-pipeline-web:42 | `ingress_conversation_bound` | — | ✓ | Same conversationId on every turn of this test |
| 45 | 2026-10-08T19:57:45.866Z · ar-pipeline-web:43 | `ingress_message_persisted` | f1f6f484… | ✓ | Inbound stored in conversation_message |
| 46 | 2026-10-08T19:57:46.131Z · ar-pipeline-web:44 | `ingress_accepted` | f1f6f484… | ✓ | Ingress OK; processingJobId assigned |
| 47 | 2026-10-08T19:57:46.131Z · ar-pipeline-web:45 | `ingress_job_enqueued` | f1f6f484… | ✓ | ar_process_inbound_sms job durable |
| 48 | 2026-10-08T19:57:46.906Z · ar-pipeline-worker:3 | `inbound_job_process_start` | f1f6f484… | ✓ | Worker processing inbound |
| 49 | 2026-10-08T19:57:47.035Z · ar-pipeline-worker:4 | `inbound_job_session_verified` | f1f6f484… | ✓ | Session lifecycle allows this handler |
| 50 | 2026-10-08T19:57:49.121Z · ar-pipeline-worker:5 | `luna_context_loaded` | f1f6f484… | ✓ | historyTurns grows (5→7→9 in this test) |
| 51 | 2026-10-08T19:57:49.241Z · ar-pipeline-worker:6 | `luna_turn_start` | f1f6f484… | ✓ | Luna V3 turn began |
| 52 | 2026-10-08T19:57:54.038Z · ar-pipeline-worker:7 | `luna_turn_completed` | f1f6f484… | ✓ | confirmed:false=offer; confirmed:true=Graph reschedule |
| 53 | 2026-10-08T19:57:54.039Z · ar-pipeline-worker:8 | `inbound_handler_branch` | f1f6f484… | ✓ | R→reminder_letter; natural/yes→luna_follow_up |
| 54 | 2026-10-08T19:57:54.289Z · ar-pipeline-worker:9 | `inbound_job_completed` | f1f6f484… | ✓ | ok:true |
| 55 | 2026-10-08T19:57:54.289Z · ar-pipeline-worker:10 | `inbound_outbound_enqueued` | f1f6f484… | ✓ | ar_send_customer_sms queued |
| 56 | 2026-10-08T19:57:54.291Z · ar-pipeline-web:46 | `outbound_reply_job_start` | f1f6f484… | ✓ | Outbound send job running |
| 57 | 2026-10-08T19:58:01.328Z · ar-pipeline-web:47 | `outbound_reply_sent` | — | ✓ | SMS delivered; messageId set |
| 58 | 2026-10-08T19:58:09.491Z · ar-pipeline-web:48 | `webhook_dispatch_start` | 8ae1b42a… | ✓ | Telnyx webhook received; providerMessageId + inboundKind match customer text |
| 59 | 2026-10-08T19:58:09.896Z · ar-pipeline-web:49 | `inbound_receipt_recorded` | 8ae1b42a… | ✓ | Durable receipt row; duplicate:false on first delivery |
| 60 | 2026-10-08T19:58:10.020Z · ar-pipeline-web:50 | `route_sessions_listed` | — | ✓ | AR sessions found for customer+platform sender; sessionCount expected ≥1 |
| 61 | 2026-10-08T19:58:10.265Z · ar-pipeline-web:51 | `ingress_accept_start` | 8ae1b42a… | ✓ | Ingress path entered for matched session |
| 62 | 2026-10-08T19:58:10.265Z · ar-pipeline-web:52 | `route_matched` | — | ✓ | Workspace + primary session + conversationId resolved |
| 63 | 2026-10-08T19:58:10.265Z · ar-pipeline-web:53 | `route_matched` | 8ae1b42a… | ✓ | Workspace + primary session + conversationId resolved |
| 64 | 2026-10-08T19:58:11.347Z · ar-pipeline-web:54 | `ingress_conversation_bound` | — | ✓ | Same conversationId on every turn of this test |
| 65 | 2026-10-08T19:58:11.599Z · ar-pipeline-web:55 | `ingress_message_persisted` | 8ae1b42a… | ✓ | Inbound stored in conversation_message |
| 66 | 2026-10-08T19:58:11.836Z · ar-pipeline-web:56 | `ingress_accepted` | 8ae1b42a… | ✓ | Ingress OK; processingJobId assigned |
| 67 | 2026-10-08T19:58:11.836Z · ar-pipeline-web:57 | `ingress_job_enqueued` | 8ae1b42a… | ✓ | ar_process_inbound_sms job durable |
| 68 | 2026-10-08T19:58:11.841Z · ar-pipeline-web:58 | `inbound_job_process_start` | 8ae1b42a… | ✓ | Worker processing inbound |
| 69 | 2026-10-08T19:58:11.992Z · ar-pipeline-web:59 | `inbound_job_session_verified` | 8ae1b42a… | ✓ | Session lifecycle allows this handler |
| 70 | 2026-10-08T19:58:14.238Z · ar-pipeline-web:60 | `luna_context_loaded` | 8ae1b42a… | ✓ | historyTurns grows (5→7→9 in this test) |
| 71 | 2026-10-08T19:58:14.360Z · ar-pipeline-web:61 | `luna_turn_start` | 8ae1b42a… | ✓ | Luna V3 turn began |
| 72 | 2026-10-08T19:58:18.056Z · ar-pipeline-web:62 | `inbound_handler_branch` | 8ae1b42a… | ✓ | R→reminder_letter; natural/yes→luna_follow_up |
| 73 | 2026-10-08T19:58:18.056Z · ar-pipeline-web:63 | `luna_turn_completed` | 8ae1b42a… | ✓ | confirmed:false=offer; confirmed:true=Graph reschedule |
| 74 | 2026-10-08T19:58:18.346Z · ar-pipeline-web:64 | `inbound_job_completed` | 8ae1b42a… | ✓ | ok:true |
| 75 | 2026-10-08T19:58:18.346Z · ar-pipeline-web:65 | `inbound_outbound_enqueued` | 8ae1b42a… | ✓ | ar_send_customer_sms queued |
| 76 | 2026-10-08T19:58:18.348Z · ar-pipeline-worker:11 | `outbound_reply_job_start` | 8ae1b42a… | ✓ | Outbound send job running |
| 77 | 2026-10-08T19:58:24.988Z · ar-pipeline-worker:12 | `outbound_reply_sent` | — | ✓ | SMS delivered; messageId set |

---

## 9. Appendix — full raw log export (production)

**Source:** Coolify containers, `docker logs … | grep ar_sms_pipeline`, 2026-10-08 ~19:56–19:58 UTC.  
**Also on disk:** `docs/artifacts/ar-pipeline-web.log`, `ar-pipeline-worker.log`, `ar-pipeline-merged-chronological.log`.

Re-fetch from production:

```bash
docker logs --since 4h <web-container> 2>&1 | grep ar_sms_pipeline | grep -E 'cmuzyipnf5y3k115c7060464k|cmuzyixh54t1i303r3f4g254z|cmuzu7o2s3h1r355c3k53124b|59c0d003|411291fa|f1f6f484|8ae1b42a'
docker logs --since 4h <sms-worker-container> 2>&1 | grep ar_sms_pipeline | grep -E '59c0d003|411291fa|f1f6f484|8ae1b42a'
```

### 9a. Web container — 65 JSON lines

```
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:43.879Z","step":"webhook_dispatch_start","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","inboundKind":"R","bodyLength":1,"meta":{"toE164":"+18666020680"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:44.304Z","step":"inbound_receipt_recorded","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","duplicate":false,"meta":{"receiptId":"cmuzyjazp715f2n0h3a5g2y3k"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:44.430Z","step":"route_sessions_listed","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","sessionCount":2,"meta":{"appointmentIds":["cmuzyipnf5y3k115c7060464k","cmuzrs78n3h5h5s2o5s1j5b60"],"lifecycleStates":["AWAITING_REPLY","COMPLETED"]}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:44.674Z","step":"route_matched","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","lifecycleState":"AWAITING_REPLY","sessionCount":2,"primarySessionId":"cmuzyixh54t1i303r3f4g254z","meta":{"syncedConversation":true}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:44.674Z","step":"route_matched","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","inboundKind":"R","bodyLength":1,"lifecycleState":"AWAITING_REPLY","routingResolution":"ar_platform_reply_resolved"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:44.675Z","step":"ingress_accept_start","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","channel":"telnyx","inboundKind":"R","bodyLength":1}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:45.922Z","step":"ingress_conversation_bound","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:46.164Z","step":"ingress_message_persisted","workspaceId":"ws_1","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","meta":{"conversationMessageId":"cmuzyjcgy3i6g683c1g670y1g"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:46.413Z","step":"ingress_accepted","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","processingJobId":"cmuzyjcno6u5i2w6n6h3m0916","inboundKind":"R","bodyLength":1,"meta":{"conversationMessageId":"cmuzyjcgy3i6g683c1g670y1g"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:46.413Z","step":"ingress_job_enqueued","workspaceId":"ws_1","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","processingJobId":"cmuzyjcno6u5i2w6n6h3m0916"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:47.726Z","step":"inbound_job_process_start","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","inboundKind":"R","bodyLength":1}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:47.873Z","step":"inbound_job_session_verified","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","lifecycleState":"AWAITING_REPLY"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:48.995Z","step":"inbound_handler_branch","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","inboundKind":"R","bodyLength":1,"handler":"reminder_letter","branch":"R"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:49.248Z","step":"inbound_job_completed","workspaceId":"ws_1","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","processingJobId":"cmuzyjcno6u5i2w6n6h3m0916","ok":true}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:49.248Z","step":"inbound_outbound_enqueued","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","processingJobId":"cmuzyjcno6u5i2w6n6h3m0916","outboundJobId":"cmuzyjexs6x4q3t4j5q6l0u38","meta":{"replyLength":84}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:13.757Z","step":"webhook_dispatch_start","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","inboundKind":"natural","bodyLength":18,"meta":{"toE164":"+18666020680"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:14.159Z","step":"inbound_receipt_recorded","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","duplicate":false,"meta":{"receiptId":"cmuzyjy1k5q0a4i4p1u0z0w3t"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:14.290Z","step":"route_sessions_listed","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","sessionCount":2,"meta":{"appointmentIds":["cmuzyipnf5y3k115c7060464k","cmuzrs78n3h5h5s2o5s1j5b60"],"lifecycleStates":["RESCHEDULING","COMPLETED"]}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:14.553Z","step":"route_matched","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","lifecycleState":"RESCHEDULING","sessionCount":2,"primarySessionId":"cmuzyixh54t1i303r3f4g254z","meta":{"syncedConversation":true}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:14.553Z","step":"route_matched","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","inboundKind":"natural","bodyLength":18,"lifecycleState":"RESCHEDULING","routingResolution":"ar_platform_reply_resolved"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:14.554Z","step":"ingress_accept_start","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","channel":"telnyx","inboundKind":"natural","bodyLength":18}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:15.680Z","step":"ingress_conversation_bound","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:15.958Z","step":"ingress_message_persisted","workspaceId":"ws_1","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","meta":{"conversationMessageId":"cmuzyjzfl0z4q5n574e2l3a5x"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:16.206Z","step":"ingress_accepted","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","processingJobId":"cmuzyjznb5a564c444t2a0t2m","inboundKind":"natural","bodyLength":18,"meta":{"conversationMessageId":"cmuzyjzfl0z4q5n574e2l3a5x"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:16.206Z","step":"ingress_job_enqueued","workspaceId":"ws_1","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","processingJobId":"cmuzyjznb5a564c444t2a0t2m"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:16.211Z","step":"inbound_job_process_start","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","inboundKind":"natural","bodyLength":18}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:16.336Z","step":"inbound_job_session_verified","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","lifecycleState":"RESCHEDULING"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:18.752Z","step":"luna_context_loaded","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","inboundKind":"natural","bodyLength":18,"meta":{"historyTurns":5}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:18.871Z","step":"luna_turn_start","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","meta":{"historyTurns":5}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:27.569Z","step":"inbound_handler_branch","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","inboundKind":"natural","bodyLength":18,"handler":"luna_follow_up","branch":"v3_reschedule"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:27.569Z","step":"luna_turn_completed","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","ok":true,"meta":{"confirmed":false,"replyLength":111}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:27.823Z","step":"inbound_job_completed","workspaceId":"ws_1","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","processingJobId":"cmuzyjznb5a564c444t2a0t2m","ok":true}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:27.823Z","step":"inbound_outbound_enqueued","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","processingJobId":"cmuzyjznb5a564c444t2a0t2m","outboundJobId":"cmuzyk8p80f1i021e37160v13","meta":{"replyLength":111}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:27.846Z","step":"outbound_reply_job_start","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","meta":{"replyLength":111}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:34.655Z","step":"outbound_reply_sent","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","meta":{"messageId":"cmuzykb0n550t1y400r2z0a3v"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:43.710Z","step":"webhook_dispatch_start","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","inboundKind":"yes","bodyLength":3,"meta":{"toE164":"+18666020680"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:44.133Z","step":"inbound_receipt_recorded","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","duplicate":false,"meta":{"receiptId":"cmuzykl5o2v5r4x6q3r6b2s6h"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:44.259Z","step":"route_sessions_listed","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","sessionCount":2,"meta":{"appointmentIds":["cmuzyipnf5y3k115c7060464k","cmuzrs78n3h5h5s2o5s1j5b60"],"lifecycleStates":["RESCHEDULING","COMPLETED"]}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:44.509Z","step":"ingress_accept_start","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","channel":"telnyx","inboundKind":"yes","bodyLength":3}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:44.509Z","step":"route_matched","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","lifecycleState":"RESCHEDULING","sessionCount":2,"primarySessionId":"cmuzyixh54t1i303r3f4g254z","meta":{"syncedConversation":true}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:44.509Z","step":"route_matched","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","inboundKind":"yes","bodyLength":3,"lifecycleState":"RESCHEDULING","routingResolution":"ar_platform_reply_resolved"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:45.618Z","step":"ingress_conversation_bound","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:45.866Z","step":"ingress_message_persisted","workspaceId":"ws_1","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","meta":{"conversationMessageId":"cmuzykmj61u1r6j5e2z4h6104"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:46.131Z","step":"ingress_accepted","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","processingJobId":"cmuzykmq31c6w4l640j693g30","inboundKind":"yes","bodyLength":3,"meta":{"conversationMessageId":"cmuzykmj61u1r6j5e2z4h6104"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:46.131Z","step":"ingress_job_enqueued","workspaceId":"ws_1","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","processingJobId":"cmuzykmq31c6w4l640j693g30"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:54.291Z","step":"outbound_reply_job_start","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","meta":{"replyLength":71}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:01.328Z","step":"outbound_reply_sent","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","meta":{"messageId":"cmuzykvad655v116j551x6i3a"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:09.491Z","step":"webhook_dispatch_start","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","inboundKind":"natural","bodyLength":6,"meta":{"toE164":"+18666020680"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:09.896Z","step":"inbound_receipt_recorded","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","duplicate":false,"meta":{"receiptId":"cmuzyl51r3a4o4f460s1m006m"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:10.020Z","step":"route_sessions_listed","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","sessionCount":2,"meta":{"appointmentIds":["cmuzyipnf5y3k115c7060464k","cmuzrs78n3h5h5s2o5s1j5b60"],"lifecycleStates":["COMPLETED","COMPLETED"]}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:10.265Z","step":"ingress_accept_start","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","channel":"telnyx","inboundKind":"natural","bodyLength":6}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:10.265Z","step":"route_matched","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","lifecycleState":"COMPLETED","sessionCount":2,"primarySessionId":"cmuzyixh54t1i303r3f4g254z","meta":{"syncedConversation":true}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:10.265Z","step":"route_matched","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","inboundKind":"natural","bodyLength":6,"lifecycleState":"COMPLETED","routingResolution":"ar_platform_reply_resolved"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:11.347Z","step":"ingress_conversation_bound","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:11.599Z","step":"ingress_message_persisted","workspaceId":"ws_1","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","meta":{"conversationMessageId":"cmuzyl6dv26583e4u314a501g"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:11.836Z","step":"ingress_accepted","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","processingJobId":"cmuzyl6kw3v3q535v4k1m3e0n","inboundKind":"natural","bodyLength":6,"meta":{"conversationMessageId":"cmuzyl6dv26583e4u314a501g"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:11.836Z","step":"ingress_job_enqueued","workspaceId":"ws_1","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","processingJobId":"cmuzyl6kw3v3q535v4k1m3e0n"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:11.841Z","step":"inbound_job_process_start","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","inboundKind":"natural","bodyLength":6}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:11.992Z","step":"inbound_job_session_verified","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","lifecycleState":"COMPLETED"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:14.238Z","step":"luna_context_loaded","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","inboundKind":"natural","bodyLength":6,"meta":{"historyTurns":9}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:14.360Z","step":"luna_turn_start","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","meta":{"historyTurns":9}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:18.056Z","step":"inbound_handler_branch","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","inboundKind":"natural","bodyLength":6,"handler":"luna_follow_up","branch":"v3_reschedule"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:18.056Z","step":"luna_turn_completed","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","ok":true,"meta":{"confirmed":true,"replyLength":71}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:18.346Z","step":"inbound_job_completed","workspaceId":"ws_1","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","processingJobId":"cmuzyl6kw3v3q535v4k1m3e0n","ok":true}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:18.346Z","step":"inbound_outbound_enqueued","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","processingJobId":"cmuzyl6kw3v3q535v4k1m3e0n","outboundJobId":"cmuzylbov5a613p38232f705b","meta":{"replyLength":71}}
```

### 9b. SMS worker container — 12 JSON lines

```
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:49.396Z","step":"outbound_reply_job_start","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","meta":{"replyLength":84}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:56.371Z","step":"outbound_reply_sent","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","meta":{"messageId":"cmuzyjhac0l1h20652a4z5l6i"}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:46.906Z","step":"inbound_job_process_start","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","inboundKind":"yes","bodyLength":3}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:47.035Z","step":"inbound_job_session_verified","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","lifecycleState":"RESCHEDULING"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:49.121Z","step":"luna_context_loaded","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","inboundKind":"yes","bodyLength":3,"meta":{"historyTurns":7}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:49.241Z","step":"luna_turn_start","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","meta":{"historyTurns":7}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:54.038Z","step":"luna_turn_completed","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","ok":true,"meta":{"confirmed":true,"replyLength":71}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:54.039Z","step":"inbound_handler_branch","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","inboundKind":"yes","bodyLength":3,"handler":"luna_follow_up","branch":"v3_reschedule"}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:54.289Z","step":"inbound_job_completed","workspaceId":"ws_1","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","processingJobId":"cmuzykmq31c6w4l640j693g30","ok":true}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:54.289Z","step":"inbound_outbound_enqueued","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","processingJobId":"cmuzykmq31c6w4l640j693g30","outboundJobId":"cmuzykt4l5x723t5c290l5414","meta":{"replyLength":71}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:18.348Z","step":"outbound_reply_job_start","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","meta":{"replyLength":71}}
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:24.988Z","step":"outbound_reply_sent","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","meta":{"messageId":"cmuzylduw2a6p6p144t716b10"}}
```

### 9c. Merged chronological (comment headers + JSON) — 77 events

```
# 2026-10-08T19:56:43.879Z | ar-pipeline-web.log:1 | webhook_dispatch_start
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:43.879Z","step":"webhook_dispatch_start","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","inboundKind":"R","bodyLength":1,"meta":{"toE164":"+18666020680"}}

# 2026-10-08T19:56:44.304Z | ar-pipeline-web.log:2 | inbound_receipt_recorded
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:44.304Z","step":"inbound_receipt_recorded","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","duplicate":false,"meta":{"receiptId":"cmuzyjazp715f2n0h3a5g2y3k"}}

# 2026-10-08T19:56:44.430Z | ar-pipeline-web.log:3 | route_sessions_listed
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:44.430Z","step":"route_sessions_listed","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","sessionCount":2,"meta":{"appointmentIds":["cmuzyipnf5y3k115c7060464k","cmuzrs78n3h5h5s2o5s1j5b60"],"lifecycleStates":["AWAITING_REPLY","COMPLETED"]}}

# 2026-10-08T19:56:44.674Z | ar-pipeline-web.log:4 | route_matched
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:44.674Z","step":"route_matched","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","lifecycleState":"AWAITING_REPLY","sessionCount":2,"primarySessionId":"cmuzyixh54t1i303r3f4g254z","meta":{"syncedConversation":true}}

# 2026-10-08T19:56:44.674Z | ar-pipeline-web.log:5 | route_matched
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:44.674Z","step":"route_matched","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","inboundKind":"R","bodyLength":1,"lifecycleState":"AWAITING_REPLY","routingResolution":"ar_platform_reply_resolved"}

# 2026-10-08T19:56:44.675Z | ar-pipeline-web.log:6 | ingress_accept_start
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:44.675Z","step":"ingress_accept_start","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","channel":"telnyx","inboundKind":"R","bodyLength":1}

# 2026-10-08T19:56:45.922Z | ar-pipeline-web.log:7 | ingress_conversation_bound
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:45.922Z","step":"ingress_conversation_bound","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51"}

# 2026-10-08T19:56:46.164Z | ar-pipeline-web.log:8 | ingress_message_persisted
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:46.164Z","step":"ingress_message_persisted","workspaceId":"ws_1","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","meta":{"conversationMessageId":"cmuzyjcgy3i6g683c1g670y1g"}}

# 2026-10-08T19:56:46.413Z | ar-pipeline-web.log:9 | ingress_accepted
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:46.413Z","step":"ingress_accepted","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","processingJobId":"cmuzyjcno6u5i2w6n6h3m0916","inboundKind":"R","bodyLength":1,"meta":{"conversationMessageId":"cmuzyjcgy3i6g683c1g670y1g"}}

# 2026-10-08T19:56:46.413Z | ar-pipeline-web.log:10 | ingress_job_enqueued
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:46.413Z","step":"ingress_job_enqueued","workspaceId":"ws_1","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","processingJobId":"cmuzyjcno6u5i2w6n6h3m0916"}

# 2026-10-08T19:56:47.726Z | ar-pipeline-web.log:11 | inbound_job_process_start
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:47.726Z","step":"inbound_job_process_start","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","inboundKind":"R","bodyLength":1}

# 2026-10-08T19:56:47.873Z | ar-pipeline-web.log:12 | inbound_job_session_verified
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:47.873Z","step":"inbound_job_session_verified","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","lifecycleState":"AWAITING_REPLY"}

# 2026-10-08T19:56:48.995Z | ar-pipeline-web.log:13 | inbound_handler_branch
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:48.995Z","step":"inbound_handler_branch","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","inboundKind":"R","bodyLength":1,"handler":"reminder_letter","branch":"R"}

# 2026-10-08T19:56:49.248Z | ar-pipeline-web.log:14 | inbound_job_completed
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:49.248Z","step":"inbound_job_completed","workspaceId":"ws_1","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","processingJobId":"cmuzyjcno6u5i2w6n6h3m0916","ok":true}

# 2026-10-08T19:56:49.248Z | ar-pipeline-web.log:15 | inbound_outbound_enqueued
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:49.248Z","step":"inbound_outbound_enqueued","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","processingJobId":"cmuzyjcno6u5i2w6n6h3m0916","outboundJobId":"cmuzyjexs6x4q3t4j5q6l0u38","meta":{"replyLength":84}}

# 2026-10-08T19:56:49.396Z | ar-pipeline-worker.log:1 | outbound_reply_job_start
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:49.396Z","step":"outbound_reply_job_start","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"59c0d003-2c1f-45cb-8ede-93c1e87ac410","meta":{"replyLength":84}}

# 2026-10-08T19:56:56.371Z | ar-pipeline-worker.log:2 | outbound_reply_sent
{"event":"ar_sms_pipeline","at":"2026-10-08T19:56:56.371Z","step":"outbound_reply_sent","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","meta":{"messageId":"cmuzyjhac0l1h20652a4z5l6i"}}

# 2026-10-08T19:57:13.757Z | ar-pipeline-web.log:16 | webhook_dispatch_start
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:13.757Z","step":"webhook_dispatch_start","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","inboundKind":"natural","bodyLength":18,"meta":{"toE164":"+18666020680"}}

# 2026-10-08T19:57:14.159Z | ar-pipeline-web.log:17 | inbound_receipt_recorded
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:14.159Z","step":"inbound_receipt_recorded","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","duplicate":false,"meta":{"receiptId":"cmuzyjy1k5q0a4i4p1u0z0w3t"}}

# 2026-10-08T19:57:14.290Z | ar-pipeline-web.log:18 | route_sessions_listed
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:14.290Z","step":"route_sessions_listed","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","sessionCount":2,"meta":{"appointmentIds":["cmuzyipnf5y3k115c7060464k","cmuzrs78n3h5h5s2o5s1j5b60"],"lifecycleStates":["RESCHEDULING","COMPLETED"]}}

# 2026-10-08T19:57:14.553Z | ar-pipeline-web.log:19 | route_matched
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:14.553Z","step":"route_matched","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","lifecycleState":"RESCHEDULING","sessionCount":2,"primarySessionId":"cmuzyixh54t1i303r3f4g254z","meta":{"syncedConversation":true}}

# 2026-10-08T19:57:14.553Z | ar-pipeline-web.log:20 | route_matched
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:14.553Z","step":"route_matched","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","inboundKind":"natural","bodyLength":18,"lifecycleState":"RESCHEDULING","routingResolution":"ar_platform_reply_resolved"}

# 2026-10-08T19:57:14.554Z | ar-pipeline-web.log:21 | ingress_accept_start
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:14.554Z","step":"ingress_accept_start","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","channel":"telnyx","inboundKind":"natural","bodyLength":18}

# 2026-10-08T19:57:15.680Z | ar-pipeline-web.log:22 | ingress_conversation_bound
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:15.680Z","step":"ingress_conversation_bound","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51"}

# 2026-10-08T19:57:15.958Z | ar-pipeline-web.log:23 | ingress_message_persisted
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:15.958Z","step":"ingress_message_persisted","workspaceId":"ws_1","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","meta":{"conversationMessageId":"cmuzyjzfl0z4q5n574e2l3a5x"}}

# 2026-10-08T19:57:16.206Z | ar-pipeline-web.log:24 | ingress_accepted
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:16.206Z","step":"ingress_accepted","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","processingJobId":"cmuzyjznb5a564c444t2a0t2m","inboundKind":"natural","bodyLength":18,"meta":{"conversationMessageId":"cmuzyjzfl0z4q5n574e2l3a5x"}}

# 2026-10-08T19:57:16.206Z | ar-pipeline-web.log:25 | ingress_job_enqueued
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:16.206Z","step":"ingress_job_enqueued","workspaceId":"ws_1","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","processingJobId":"cmuzyjznb5a564c444t2a0t2m"}

# 2026-10-08T19:57:16.211Z | ar-pipeline-web.log:26 | inbound_job_process_start
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:16.211Z","step":"inbound_job_process_start","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","inboundKind":"natural","bodyLength":18}

# 2026-10-08T19:57:16.336Z | ar-pipeline-web.log:27 | inbound_job_session_verified
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:16.336Z","step":"inbound_job_session_verified","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","lifecycleState":"RESCHEDULING"}

# 2026-10-08T19:57:18.752Z | ar-pipeline-web.log:28 | luna_context_loaded
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:18.752Z","step":"luna_context_loaded","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","inboundKind":"natural","bodyLength":18,"meta":{"historyTurns":5}}

# 2026-10-08T19:57:18.871Z | ar-pipeline-web.log:29 | luna_turn_start
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:18.871Z","step":"luna_turn_start","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","meta":{"historyTurns":5}}

# 2026-10-08T19:57:27.569Z | ar-pipeline-web.log:30 | inbound_handler_branch
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:27.569Z","step":"inbound_handler_branch","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","inboundKind":"natural","bodyLength":18,"handler":"luna_follow_up","branch":"v3_reschedule"}

# 2026-10-08T19:57:27.569Z | ar-pipeline-web.log:31 | luna_turn_completed
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:27.569Z","step":"luna_turn_completed","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","ok":true,"meta":{"confirmed":false,"replyLength":111}}

# 2026-10-08T19:57:27.823Z | ar-pipeline-web.log:32 | inbound_job_completed
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:27.823Z","step":"inbound_job_completed","workspaceId":"ws_1","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","processingJobId":"cmuzyjznb5a564c444t2a0t2m","ok":true}

# 2026-10-08T19:57:27.823Z | ar-pipeline-web.log:33 | inbound_outbound_enqueued
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:27.823Z","step":"inbound_outbound_enqueued","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","processingJobId":"cmuzyjznb5a564c444t2a0t2m","outboundJobId":"cmuzyk8p80f1i021e37160v13","meta":{"replyLength":111}}

# 2026-10-08T19:57:27.846Z | ar-pipeline-web.log:34 | outbound_reply_job_start
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:27.846Z","step":"outbound_reply_job_start","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"411291fa-0a0d-4d32-a1c9-f1b9c014f8d1","meta":{"replyLength":111}}

# 2026-10-08T19:57:34.655Z | ar-pipeline-web.log:35 | outbound_reply_sent
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:34.655Z","step":"outbound_reply_sent","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","meta":{"messageId":"cmuzykb0n550t1y400r2z0a3v"}}

# 2026-10-08T19:57:43.710Z | ar-pipeline-web.log:36 | webhook_dispatch_start
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:43.710Z","step":"webhook_dispatch_start","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","inboundKind":"yes","bodyLength":3,"meta":{"toE164":"+18666020680"}}

# 2026-10-08T19:57:44.133Z | ar-pipeline-web.log:37 | inbound_receipt_recorded
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:44.133Z","step":"inbound_receipt_recorded","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","duplicate":false,"meta":{"receiptId":"cmuzykl5o2v5r4x6q3r6b2s6h"}}

# 2026-10-08T19:57:44.259Z | ar-pipeline-web.log:38 | route_sessions_listed
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:44.259Z","step":"route_sessions_listed","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","sessionCount":2,"meta":{"appointmentIds":["cmuzyipnf5y3k115c7060464k","cmuzrs78n3h5h5s2o5s1j5b60"],"lifecycleStates":["RESCHEDULING","COMPLETED"]}}

# 2026-10-08T19:57:44.509Z | ar-pipeline-web.log:39 | ingress_accept_start
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:44.509Z","step":"ingress_accept_start","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","channel":"telnyx","inboundKind":"yes","bodyLength":3}

# 2026-10-08T19:57:44.509Z | ar-pipeline-web.log:40 | route_matched
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:44.509Z","step":"route_matched","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","lifecycleState":"RESCHEDULING","sessionCount":2,"primarySessionId":"cmuzyixh54t1i303r3f4g254z","meta":{"syncedConversation":true}}

# 2026-10-08T19:57:44.509Z | ar-pipeline-web.log:41 | route_matched
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:44.509Z","step":"route_matched","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","inboundKind":"yes","bodyLength":3,"lifecycleState":"RESCHEDULING","routingResolution":"ar_platform_reply_resolved"}

# 2026-10-08T19:57:45.618Z | ar-pipeline-web.log:42 | ingress_conversation_bound
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:45.618Z","step":"ingress_conversation_bound","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51"}

# 2026-10-08T19:57:45.866Z | ar-pipeline-web.log:43 | ingress_message_persisted
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:45.866Z","step":"ingress_message_persisted","workspaceId":"ws_1","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","meta":{"conversationMessageId":"cmuzykmj61u1r6j5e2z4h6104"}}

# 2026-10-08T19:57:46.131Z | ar-pipeline-web.log:44 | ingress_accepted
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:46.131Z","step":"ingress_accepted","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","processingJobId":"cmuzykmq31c6w4l640j693g30","inboundKind":"yes","bodyLength":3,"meta":{"conversationMessageId":"cmuzykmj61u1r6j5e2z4h6104"}}

# 2026-10-08T19:57:46.131Z | ar-pipeline-web.log:45 | ingress_job_enqueued
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:46.131Z","step":"ingress_job_enqueued","workspaceId":"ws_1","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","processingJobId":"cmuzykmq31c6w4l640j693g30"}

# 2026-10-08T19:57:46.906Z | ar-pipeline-worker.log:3 | inbound_job_process_start
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:46.906Z","step":"inbound_job_process_start","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","inboundKind":"yes","bodyLength":3}

# 2026-10-08T19:57:47.035Z | ar-pipeline-worker.log:4 | inbound_job_session_verified
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:47.035Z","step":"inbound_job_session_verified","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","lifecycleState":"RESCHEDULING"}

# 2026-10-08T19:57:49.121Z | ar-pipeline-worker.log:5 | luna_context_loaded
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:49.121Z","step":"luna_context_loaded","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","inboundKind":"yes","bodyLength":3,"meta":{"historyTurns":7}}

# 2026-10-08T19:57:49.241Z | ar-pipeline-worker.log:6 | luna_turn_start
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:49.241Z","step":"luna_turn_start","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","meta":{"historyTurns":7}}

# 2026-10-08T19:57:54.038Z | ar-pipeline-worker.log:7 | luna_turn_completed
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:54.038Z","step":"luna_turn_completed","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","ok":true,"meta":{"confirmed":true,"replyLength":71}}

# 2026-10-08T19:57:54.039Z | ar-pipeline-worker.log:8 | inbound_handler_branch
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:54.039Z","step":"inbound_handler_branch","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","inboundKind":"yes","bodyLength":3,"handler":"luna_follow_up","branch":"v3_reschedule"}

# 2026-10-08T19:57:54.289Z | ar-pipeline-worker.log:9 | inbound_job_completed
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:54.289Z","step":"inbound_job_completed","workspaceId":"ws_1","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","processingJobId":"cmuzykmq31c6w4l640j693g30","ok":true}

# 2026-10-08T19:57:54.289Z | ar-pipeline-worker.log:10 | inbound_outbound_enqueued
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:54.289Z","step":"inbound_outbound_enqueued","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","processingJobId":"cmuzykmq31c6w4l640j693g30","outboundJobId":"cmuzykt4l5x723t5c290l5414","meta":{"replyLength":71}}

# 2026-10-08T19:57:54.291Z | ar-pipeline-web.log:46 | outbound_reply_job_start
{"event":"ar_sms_pipeline","at":"2026-10-08T19:57:54.291Z","step":"outbound_reply_job_start","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"f1f6f484-568f-45f4-8554-c7e68440cb98","meta":{"replyLength":71}}

# 2026-10-08T19:58:01.328Z | ar-pipeline-web.log:47 | outbound_reply_sent
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:01.328Z","step":"outbound_reply_sent","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","meta":{"messageId":"cmuzykvad655v116j551x6i3a"}}

# 2026-10-08T19:58:09.491Z | ar-pipeline-web.log:48 | webhook_dispatch_start
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:09.491Z","step":"webhook_dispatch_start","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","inboundKind":"natural","bodyLength":6,"meta":{"toE164":"+18666020680"}}

# 2026-10-08T19:58:09.896Z | ar-pipeline-web.log:49 | inbound_receipt_recorded
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:09.896Z","step":"inbound_receipt_recorded","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","duplicate":false,"meta":{"receiptId":"cmuzyl51r3a4o4f460s1m006m"}}

# 2026-10-08T19:58:10.020Z | ar-pipeline-web.log:50 | route_sessions_listed
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:10.020Z","step":"route_sessions_listed","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","sessionCount":2,"meta":{"appointmentIds":["cmuzyipnf5y3k115c7060464k","cmuzrs78n3h5h5s2o5s1j5b60"],"lifecycleStates":["COMPLETED","COMPLETED"]}}

# 2026-10-08T19:58:10.265Z | ar-pipeline-web.log:51 | ingress_accept_start
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:10.265Z","step":"ingress_accept_start","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","channel":"telnyx","inboundKind":"natural","bodyLength":6}

# 2026-10-08T19:58:10.265Z | ar-pipeline-web.log:52 | route_matched
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:10.265Z","step":"route_matched","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","lifecycleState":"COMPLETED","sessionCount":2,"primarySessionId":"cmuzyixh54t1i303r3f4g254z","meta":{"syncedConversation":true}}

# 2026-10-08T19:58:10.265Z | ar-pipeline-web.log:53 | route_matched
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:10.265Z","step":"route_matched","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51","channel":"telnyx","inboundKind":"natural","bodyLength":6,"lifecycleState":"COMPLETED","routingResolution":"ar_platform_reply_resolved"}

# 2026-10-08T19:58:11.347Z | ar-pipeline-web.log:54 | ingress_conversation_bound
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:11.347Z","step":"ingress_conversation_bound","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","platformPhoneNumberId":"cmtoszkn26t6z485u3d2w3c51"}

# 2026-10-08T19:58:11.599Z | ar-pipeline-web.log:55 | ingress_message_persisted
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:11.599Z","step":"ingress_message_persisted","workspaceId":"ws_1","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","meta":{"conversationMessageId":"cmuzyl6dv26583e4u314a501g"}}

# 2026-10-08T19:58:11.836Z | ar-pipeline-web.log:56 | ingress_accepted
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:11.836Z","step":"ingress_accepted","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","processingJobId":"cmuzyl6kw3v3q535v4k1m3e0n","inboundKind":"natural","bodyLength":6,"meta":{"conversationMessageId":"cmuzyl6dv26583e4u314a501g"}}

# 2026-10-08T19:58:11.836Z | ar-pipeline-web.log:57 | ingress_job_enqueued
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:11.836Z","step":"ingress_job_enqueued","workspaceId":"ws_1","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","processingJobId":"cmuzyl6kw3v3q535v4k1m3e0n"}

# 2026-10-08T19:58:11.841Z | ar-pipeline-web.log:58 | inbound_job_process_start
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:11.841Z","step":"inbound_job_process_start","workspaceId":"ws_1","contactId":"cmsdkphjd6t12365p2g301r5o","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","inboundKind":"natural","bodyLength":6}

# 2026-10-08T19:58:11.992Z | ar-pipeline-web.log:59 | inbound_job_session_verified
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:11.992Z","step":"inbound_job_session_verified","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","lifecycleState":"COMPLETED"}

# 2026-10-08T19:58:14.238Z | ar-pipeline-web.log:60 | luna_context_loaded
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:14.238Z","step":"luna_context_loaded","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","inboundKind":"natural","bodyLength":6,"meta":{"historyTurns":9}}

# 2026-10-08T19:58:14.360Z | ar-pipeline-web.log:61 | luna_turn_start
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:14.360Z","step":"luna_turn_start","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","meta":{"historyTurns":9}}

# 2026-10-08T19:58:18.056Z | ar-pipeline-web.log:62 | inbound_handler_branch
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:18.056Z","step":"inbound_handler_branch","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","inboundKind":"natural","bodyLength":6,"handler":"luna_follow_up","branch":"v3_reschedule"}

# 2026-10-08T19:58:18.056Z | ar-pipeline-web.log:63 | luna_turn_completed
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:18.056Z","step":"luna_turn_completed","workspaceId":"ws_1","appointmentId":"cmuzyipnf5y3k115c7060464k","replySessionId":"cmuzyixh54t1i303r3f4g254z","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","ok":true,"meta":{"confirmed":true,"replyLength":71}}

# 2026-10-08T19:58:18.346Z | ar-pipeline-web.log:64 | inbound_job_completed
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:18.346Z","step":"inbound_job_completed","workspaceId":"ws_1","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","processingJobId":"cmuzyl6kw3v3q535v4k1m3e0n","ok":true}

# 2026-10-08T19:58:18.346Z | ar-pipeline-web.log:65 | inbound_outbound_enqueued
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:18.346Z","step":"inbound_outbound_enqueued","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","processingJobId":"cmuzyl6kw3v3q535v4k1m3e0n","outboundJobId":"cmuzylbov5a613p38232f705b","meta":{"replyLength":71}}

# 2026-10-08T19:58:18.348Z | ar-pipeline-worker.log:11 | outbound_reply_job_start
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:18.348Z","step":"outbound_reply_job_start","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","providerMessageId":"8ae1b42a-11b7-4d6c-b10e-2db8d5a1027d","meta":{"replyLength":71}}

# 2026-10-08T19:58:24.988Z | ar-pipeline-worker.log:12 | outbound_reply_sent
{"event":"ar_sms_pipeline","at":"2026-10-08T19:58:24.988Z","step":"outbound_reply_sent","workspaceId":"ws_1","replySessionId":"cmuzyixh54t1i303r3f4g254z","conversationId":"cmuzu7o2s3h1r355c3k53124b","meta":{"messageId":"cmuzylduw2a6p6p144t716b10"}}
```

---

## 10. Re-run commands (production web container)

```bash
# DB + Microsoft Graph
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/ar-prod-verify-reschedule.ts --appointment-id cmuzyipnf5y3k115c7060464k

# Jobs + held messages
PHONE=+15714776175 WORKSPACE_ID=ws_1 \
  NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/ar-prod-trace-inbound-boundary.ts
```

**Production health at time of test:** `GET https://transovo.ai/api/health` → `commitSha` `886cb13e92b3fcdc6edbc7c0148de8598ef4b7a5`

---

## 11. Plain-language Context Agent (advisory notes) — 2026-10-09

**Code:** `430d3a46df63236a27b532ccb4444f9be79bb0ae` (`refactor(ar): Context Agent outputs plain advisory notes` + ops inject script).

**Deploy parity:** Web and SMS worker both on `430d3a46d` (`GET /api/health`, worker `:8082/health`).

**Session under test:** `cmv07ink76f5z5x221p6e6539` · appointment `cmv07ieef4s526f1w1g2v170b` · conversation `cmuzu7o2s3h1r355c3k53124b`.

| Boundary | Result | Evidence |
|----------|--------|----------|
| Ingress → BullMQ `ar_process_inbound_sms` | PASS | `ingress_job_enqueued` / `processingJobId` `cmv08xsfx4p0n173o403m2d2l` |
| Context Agent (plain text, no JSON schema) | PASS | `context_agent_completed` `ok:true` `notesLength:417` (and 325 / 295 on follow-up turns) |
| Appointment Agent (Luna + tools) | PASS | `luna_turn_completed` `ok:true`; no OpenAI `response_format` / Zod parse failures |
| Outbound SMS | PASS | `outbound_reply_sent` for each turn |
| Calendar mutation on “Thanks” while `RESCHEDULING` | PASS (no write) | `startsAt` unchanged `2026-10-21T18:00:00.000Z` before/after `Thanks` inject |
| Full reschedule confirm (`confirmed:true`) in this thread | **Not re-certified** | `Yes` and `Next Monday at 1pm` left `confirmed:false`; session stayed `RESCHEDULING` — needs customer-aligned slot confirmation on phone or explicit offer text in inject |

**Inject (worker container):**

```bash
REPLY_SESSION_ID=cmv07ink76f5z5x221p6e6539 BODY="Next Monday at 1pm" \
  NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/ar-prod-inject-inbound-sms.ts
```

**Sample worker log lines:**

```
context_agent_completed … "meta":{"notesLength":417}
luna_turn_completed … "meta":{"confirmed":false,"replyLength":107}
inbound_job_completed … "ok":true
outbound_reply_sent …
```
