# AR SMS live reschedule verification — Anthony / ws_1 (2026-10-09)

**Customer:** +15714776175 (Anthony)  
**Platform sender:** +18666020680 (Telnyx)  
**Workspace:** `ws_1`  
**Production code (web + worker at time of test):** `430d3a46df63236a27b532ccb4444f9be79bb0ae` (plain-language Context Agent notes)

## Customer thread (what you saw on your phone)

1. Reminder: Microsoft AR live test — **Monday, Oct 12 at 10:00 AM** (Reply C / R / X).
2. Customer: **R**
3. Assistant: reschedule opener (what day/time works better).
4. Customer: **Let's say next Friday at 1pm**
5. Assistant: **Next Friday, October 16 at 1:00 PM** is available — confirm reschedule?
6. Customer: **Yes**
7. Assistant: **Your appointment has been rescheduled to Friday, October 16 at 1:00 PM.**
8. Customer: **Thanks**

---

## Verdict: reschedule PASS

| Step | Backend result |
|------|----------------|
| Reminder → Mon Oct 12, 10:00 AM | Appointment `cmv09s62s4n0z0509472u2v3m` + confirmation SMS |
| **R** | Routed → `reminder_letter` branch → reschedule opener |
| **Next Friday at 1pm** | Context Agent notes → Luna → FIND_AVAILABILITY → offer Oct 16 1pm |
| **Yes** | RESCHEDULE_APPOINTMENT SUCCEEDED → `confirmed:true` → confirmation SMS |
| Calendar | DB + Microsoft Graph both **2026-10-16 17:00:00 UTC** (1:00 PM Eastern) |

---

## Correlation IDs

| Role | ID |
|------|-----|
| Appointment | `cmv09s62s4n0z0509472u2v3m` |
| AR reply session | `cmv09sf9s0e3s4j3o182o5m6e` |
| Conversation | `cmuzu7o2s3h1r355c3k53124b` |
| Contact | `cmsdkphjd6t12365p2g301r5o` |
| Platform phone row | `cmtoszkn26t6z485u3d2w3c51` |
| Microsoft connection | `cmu1uq7f15s1o5s4f6c5b6a57` |
| Graph event id (suffix) | `…FQ21QoAAAA=` |

### Telnyx `providerMessageId` per customer message

| Customer text | providerMessageId |
|---------------|-------------------|
| R | `ad99ac64-a720-4183-9844-c12917cd5a9e` |
| Let's say next Friday at 1pm | `ec3307c6-5978-455f-ad6c-842de28aaebd` |
| Yes | `97c0b363-9539-4627-93c3-988eb27b3a0a` |
| Thanks | `165a4eda-df3f-46b1-a0bb-fa2e718caa11` |

### Processing jobs (sample)

| Turn | processingJobId |
|------|-----------------|
| R | `cmv09t6dw153v3w4f3y4x0s5d` |
| Friday preference | `cmv09tza66f2x6x2j5m056l45` |
| Yes | `cmv09upce1p2n544q40010b2g` |

### Reschedule operation

| Field | Value |
|-------|--------|
| Operation id | `rsc_cmv09uvw35u283x465j1e5355` |
| Type | `RESCHEDULE_APPOINTMENT` |
| Status | `SUCCEEDED` |
| Workflow phase | `RESCHEDULE_CONFIRMED` |

---

## Authoritative calendar proof

**Command (production web container):**

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/ar-prod-verify-reschedule.ts --appointment-id cmv09s62s4n0z0509472u2v3m
```

**Output (2026-10-09):**

```
local_appointment {
  id: 'cmv09s62s4n0z0509472u2v3m',
  workspaceId: 'ws_1',
  status: 'scheduled',
  startsAt: '2026-10-16T17:00:00.000Z',
  endsAt: '2026-10-16T17:30:00.000Z',
  timezone: 'America/New_York',
  ...
}
ar_reply_session {
  id: 'cmv09sf9s0e3s4j3o182o5m6e',
  lifecycleState: 'COMPLETED',
  lastUsedAt: '2026-10-09T01:13:43.204Z',
  hasWorkflowState: true
}
microsoft_graph_event {
  subject: 'Microsoft AR live test — Anthony  Johnson',
  start: { dateTime: '2026-10-16T17:00:00.0000000', timeZone: 'UTC' },
  end: { dateTime: '2026-10-16T17:30:00.0000000', timeZone: 'UTC' }
}
```

---

## Pipeline boundaries (PASS / notes)

| Boundary | Result | Evidence |
|----------|--------|----------|
| Telnyx webhook → receipt | PASS | `webhook_dispatch_start` + `inbound_receipt_recorded` on web |
| Route to active AR session | PASS | `route_matched` … `lifecycleState: AWAITING_REPLY` (R) / `RESCHEDULING` (follow-ups) |
| Ingress → BullMQ `ar_process_inbound_sms` | PASS | `ingress_job_enqueued` / `inbound_job_completed` `ok:true` |
| Context Agent (plain advisory notes) | PASS | `context_agent_completed` `ok:true`, `notesLength` 312 / 379 (no JSON schema errors) |
| Appointment Agent (Luna + tools) | PASS | `luna_turn_completed` `ok:true`; Yes turn `confirmed:true` |
| FIND availability | PASS | `FIND_AVAILABILITY` SUCCEEDED in workflow; offer Oct 16 1pm |
| Graph reschedule commit | PASS | `RESCHEDULE_COMMIT_SENT`, `RESCHEDULE_CONFIRMED`, operation SUCCEEDED |
| Outbound SMS | PASS | `outbound_reply_sent` for each assistant turn |
| **Thanks** after session COMPLETED | **HELD (ambiguous)** | `route_ambiguous_appointment` — 3 COMPLETED sessions on same platform sender; no extra calendar write |

---

## Sample worker log lines (SMS worker)

**R (no Luna — letter branch):**

```
inbound_job_process_start … providerMessageId":"ad99ac64-a720-4183-9844-c12917cd5a9e" … inboundKind":"R"
inbound_handler_branch … handler":"reminder_letter" branch":"R"
inbound_job_completed … ok":true
```

**Friday preference (context + Luna):**

```
context_agent_completed … providerMessageId":"ec3307c6-5978-455f-ad6c-842de28aaebd" ok":true meta":{"notesLength":312}
luna_turn_completed … confirmed":false replyLength":111
inbound_handler_branch … handler":"luna_follow_up" branch":"v3_reschedule"
```

**Yes (reschedule commit):**

```
context_agent_completed … providerMessageId":"97c0b363-9539-4627-93c3-988eb27b3a0a" ok":true meta":{"notesLength":379}
RESCHEDULE_REQUESTED
RESCHEDULE_REVALIDATION_STARTED
RESCHEDULE_COMMIT_SENT
RESCHEDULE_CONFIRMED
luna_turn_completed … confirmed":true replyLength":71
inbound_job_completed … ok":true
```

---

## Context Agent notes (stored on session — advisory only)

Example from workflow `lastContextNotes` on **Yes** turn:

```
CONTEXT AGENT NOTES

- “Yes” accepts the immediately preceding offer to reschedule the appointment to Friday, October 16 at 1:00 PM. This is authorization for that proposed change.
- The verified current appointment is Monday, October 12 at 10:00 AM. Prior assistant messages mention other appointment times, so verify against the authoritative appointment state before updating.
```

---

## Thanks — routing edge case

**Thanks** (`165a4eda-df3f-46b1-a0bb-fa2e718caa11`) at `2026-10-09T01:13:55Z`:

- Web: `route_ambiguous_appointment` with `holdReason: ambiguous_ar_appointment_on_platform_sender`
- Three COMPLETED sessions listed: `cmv09s62s4n0z0509472u2v3m`, `cmuzyipnf5y3k115c7060464k`, `cmuzrs78n3h5h5s2o5s1j5b60`
- **No** second calendar mutation (correct)
- Customer may not receive a “you’re welcome” SMS until routing is improved (e.g. prefer most recently completed session for same contact)

---

## Re-run / debug commands (production)

```bash
# DB + Microsoft Graph for this appointment
WORKSPACE_ID=ws_1 \
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
npx tsx scripts/ar-prod-verify-reschedule.ts --appointment-id cmv09s62s4n0z0509472u2v3m

# Recent sessions + messages for your phone
WORKSPACE_ID=ws_1 PHONE=+15714776175 \
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
npx tsx scripts/ar-prod-last-inbound-r.ts

# Worker logs (replace container name from docker ps)
docker logs --since 2h <sms-worker-container> 2>&1 | grep cmv09sf9s0e3s4j3o182o5m6e
```

---

## Bottom line

- **Reschedule flow you tested:** reminder → **R** → natural language new time → **Yes** → **real Microsoft move** + confirmation SMS — **works as designed** with two-agent architecture and plain-language Context Agent notes.
- **Thanks** after completion with multiple historical AR sessions on one platform number: **ambiguous routing** (documented above); not a failed reschedule.
