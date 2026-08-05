# Appointment Booking — Integration Test Checklist

Architecture is locked. This is the proof ladder for Maya.

```
Phone Number
     │
     ▼
Inbound Call Trigger   ← owns the DID
     │
     ▼
Workflow Execution     ← one run per call (debuggable)
     │
     ▼
Run Voice Agent        ← Telnyx owns live audio
     │
     ▼
Call Outcome
     │
     ▼
Next nodes…
```

The phone number never belongs to the agent. It belongs to the trigger.
The workflow is the template. The **execution** is one run.

---

## Stage 1 — Resave Maya

- [ ] Resave in the appointment wizard (or `POST /api/agents/backfill-appointment-workflows`)
- [ ] Exactly **one** primary workflow (`ownershipKind=agent_workflow`)
- [ ] No duplicate flows on repeated saves
- [ ] Nodes present: Inbound Call · Run Voice Agent · Call Outcome · End

## Stage 2 — Trigger config

Open the primary workflow builder. On **Inbound Call**:

- [ ] Correct `phoneNumberId` / E.164
- [ ] Workspace owns the number
- [ ] `routingMode` = every_call (for first test)
- [ ] `mode` = live (or test intentionally)
- [ ] Schedule = always (first test)
- [ ] Pause fallback chosen

If the number is missing → stop. Status must stay Draft / Not Ready.

## Stage 3 — Activate

- [ ] Publish / Activate from wizard or workflow
- [ ] `TriggerDeployment` row exists: status `live`
- [ ] `providerConfig.telnyxPublished` = true
- [ ] Telnyx DID actually points at TeXML → Maya’s assistant (provider console, not only DB)
- [ ] On Telnyx failure: workflow is **not** ACTIVE; error visible; prior routing intact

## Stage 4 — Live call (first true runtime)

Call the number.

Expected:

```
Phone → Telnyx → Maya answers immediately
```

Not voicemail, not old webhook path, not silence.

- [ ] First assistant audio heard
- [ ] Diagnostics: assistant launch / Telnyx routing layers ok

## Stage 5 — Execution started

- [ ] Open workflow → **Executions** tab
- [ ] New row: `Execution #XXXXXX`, status Running/Waiting
- [ ] Phone matches caller
- [ ] Current node = Run Voice Agent or Call Outcome
- [ ] Open detail: call bound (`pendingCallId` / Call section Connected)

If Stage 4 worked but no execution → deployment works, enroll/engine does not.

## Stage 6 — Book + resume + branch

- [ ] Book an appointment on the call
- [ ] End call
- [ ] Calendar / `VoiceAppointment` exists
- [ ] Booking tool appears under execution Call → Tool calls
- [ ] Execution resumes; Call Outcome branch recorded (e.g. `booked`)
- [ ] Downstream nodes run if configured
- [ ] Paste `callId` into diagnostics test checks — no silent Pass

## Negative cases

- [ ] Invalid / missing number → cannot activate
- [ ] Conflicting live trigger on same DID → 409
- [ ] Telnyx publish failure → not ACTIVE
- [ ] Pause → fallback applied; number not dark
- [ ] Caller hangup → outcome / branch controlled
- [ ] Booking tool fails → visible in execution logs
- [ ] No appointment booked → non-booked branch
- [ ] Duplicate webhook → one execution (idempotent)
- [ ] Repeated agent save → no duplicate flows/nodes

## Where to look

| Question | Place |
|----------|--------|
| Is routing live? | My Numbers + TriggerDeployment + diagnostics |
| Did the call create a run? | `/automations/{flowId}?tab=executions` |
| What node / branch / tools? | `/automations/{flowId}/executions/{id}` |
| Did Telnyx get the assistant? | Diagnostics + Telnyx console |
